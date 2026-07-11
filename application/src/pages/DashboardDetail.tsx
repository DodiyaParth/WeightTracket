import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Icon, { AvatarStack } from '../components/Icon.jsx';
import DashboardBody from '../components/DashboardBody.jsx';
import GoalEditor from '../components/GoalEditor.jsx';
import DashSettings from '../components/DashSettings.jsx';
import ShareModal from '../components/ShareModal.jsx';
import { RetryCard } from '../components/ui.jsx';
import { Confirm } from '../components/Modal.jsx';
import { useQuickLog } from '../components/QuickLog.jsx';
import { useAuthedUser } from '../auth/useAuthedUser.js';
import { useAsyncAction } from '../hooks/useAsyncAction.js';
import { repo } from '../data/repo.js';
import { useDashboard, useDashboardSeries, useHabitLogs, useNsv, useProfiles } from '../hooks/useData.js';
import { isEditable, memberList } from '../lib/dashboards.js';
import { errorCode } from '../lib/errors.js';

export default function DashboardDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const user = useAuthedUser();
  const quick = useQuickLog();
  const { data: d, loading, error, reload } = useDashboard(id);
  const { data: series } = useDashboardSeries(id);
  const { data: habitLogs } = useHabitLogs(id);
  const { data: nsv } = useNsv(id);
  const { data: profiles } = useProfiles(d?.memberUids || []);
  const [modal, setModal] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const { run: runLeave, busy: leaveBusy, error: leaveError } = useAsyncAction();

  if (loading && !d) return <Layout title="Loading…" primary={null}><div className="skel" style={{ height: 240, borderRadius: 12 }} /></Layout>;
  // A permission-denied read means "you don't have access" (never a member, removed,
  // or the dashboard was deleted) — that's the same not-found copy below, not a
  // connectivity problem, so it falls through instead of showing the retry card.
  if (error && errorCode(error) !== 'permission-denied') {
    return (
      <Layout title="Couldn’t load dashboard" primary={null}>
        <RetryCard title="Couldn’t load this dashboard" message="Check your connection and try again." onRetry={reload} />
      </Layout>
    );
  }
  if (!d) {
    return (
      <Layout title="Dashboard not found" primary={null}>
        <div className="empty">
          <span className="empty-ic" style={{ background: 'var(--amber-tint)' }}><Icon name="warn" size={26} color="#b9742a" /></span>
          <h2>We couldn’t find this dashboard</h2>
          <p className="t2">It may have been removed, or the link is wrong.</p>
        </div>
      </Layout>
    );
  }

  const editable = isEditable(d, user.uid);
  const members = memberList(d, profiles || {});
  const isOwner = d.ownerUid === user.uid;

  const confirmLeave = async () => {
    try { await runLeave(() => repo.removeMember(d.id, user.uid)); } catch { return; }
    setLeaving(false);
    nav('/');
  };

  const primary = (
    <>
      <AvatarStack members={members} size={32} />
      {editable ? (
        <>
          {!isOwner && <button className="btn ghost sm" onClick={() => setLeaving(true)}>Leave</button>}
          <button className="icon-btn" title="Dashboard settings" aria-label="Dashboard settings" onClick={() => setModal('settings')}><Icon name="settings" /></button>
          <button className="btn" onClick={() => setModal('share')}><Icon name="share" />Share</button>
          <button className="btn primary" onClick={() => quick.open()}><Icon name="plus" color="#fff" />Log my weight</button>
        </>
      ) : (
        <>
          <span className="tag view" style={{ padding: '8px 12px' }}><Icon name="eye" size={15} color="currentColor" />View only</span>
          {!isOwner && <button className="btn ghost sm" onClick={() => setLeaving(true)}>Leave</button>}
        </>
      )}
    </>
  );

  const others = members.length - 1;
  const sub = editable
    ? `Shared dashboard · you + ${others} other${others === 1 ? '' : 's'} · you can edit goals & habits`
    : `Shared with you · ${members.length} people · view only`;

  return (
    <Layout title={d.name} sub={sub} primary={primary}>
      <DashboardBody
        dashboard={d}
        series={series || {}}
        habitLogs={habitLogs || {}}
        nsv={nsv || {}}
        meUid={user.uid}
        readOnly={!editable}
        onEditGoals={() => setModal('goals')}
        profiles={profiles || {}}
      />
      {modal === 'goals' && <GoalEditor dashboard={d} series={series || {}} profiles={profiles || {}} onClose={() => setModal(null)} />}
      {modal === 'settings' && <DashSettings dashboard={d} profiles={profiles || {}} meUid={user.uid} onClose={() => setModal(null)} onEditGoals={() => setModal('goals')} onManageSharing={() => setModal('share')} />}
      {modal === 'share' && <ShareModal dashboard={d} profiles={profiles || {}} onClose={() => setModal(null)} />}
      {leaving && (
        <Confirm
          title="Leave this dashboard?" message={`You’ll lose access to “${d.name}”. Anyone still on it keeps their data — you can be re-invited later.`}
          confirmLabel="Leave" danger busy={leaveBusy} error={leaveError}
          onCancel={() => setLeaving(false)} onConfirm={confirmLeave}
        />
      )}
    </Layout>
  );
}
