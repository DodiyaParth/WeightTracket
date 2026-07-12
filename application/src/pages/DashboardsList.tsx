import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Icon, { AvatarStack } from '../components/Icon.jsx';
import { RoleBadge, ChangeText, RetryCard } from '../components/ui.jsx';
import { Confirm } from '../components/Modal.jsx';
import Sparkline from '../components/Sparkline.jsx';
import CreateDashboard from '../components/CreateDashboard.jsx';
import { useAuthedUser } from '../auth/useAuthedUser.js';
import { useDashboards, useInvites, useDashboardSeries, useProfiles } from '../hooks/useData.js';
import { useAcceptInvite, useDeclineInvite } from '../hooks/mutations.js';
import { collaborating, viewOnly, accessFor, isEditable, memberList } from '../lib/dashboards.js';
import { initials } from '../lib/colors.js';
import { togetherChange } from '../lib/stats.js';
import { fmtDate } from '../lib/date.js';
import { formatChange } from '../lib/format.js';
import type { AuthUser, Dashboard, Invite, SeriesPoint } from '../types.js';

function teamStat(series: Record<string, SeriesPoint[]> | undefined, trackedUids: string[], target?: number) {
  const lost = togetherChange(series || {}, trackedUids);
  return { lost, pct: target ? Math.min(1, Math.max(0, lost / target)) : 0 };
}

function DashCard({ d, uid, onOpen }: { d: Dashboard; uid: string | undefined; onOpen: () => void }) {
  const { data: series } = useDashboardSeries(d.id);
  const { data: profiles } = useProfiles(d.memberUids || []);
  const view = !isEditable(d, uid);
  const tracked = d.trackedUids || [];
  const spark = (series?.[tracked[0]] || []).map((e) => e.kg);
  const { lost, pct } = teamStat(series, tracked, d.teamGoal?.target);
  const members = memberList(d, profiles || {});
  const goalLabel = d.teamGoal?.label || 'No team goal yet';

  return (
    <div className="card dash-card" role="button" tabIndex={0} aria-label={`Open ${d.name}`} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }} style={{ cursor: 'pointer' }}>
      <div className="row between"><span className="card-title">{d.name}</span><RoleBadge access={accessFor(d, uid)} /></div>
      <Sparkline data={spark} color={view ? 'var(--muted)' : 'var(--accent)'} />
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <div className="row" style={{ gap: 7, alignItems: 'baseline' }}>
          <ChangeText change={formatChange(-lost)} style={{ fontSize: 26, fontWeight: 600, color: view ? 'var(--text)' : undefined }} />
          <span className="t2 small">together</span>
        </div>
        <AvatarStack members={members} size={28} />
      </div>
      <div className="col" style={{ gap: 8 }}>
        <div className="row between small"><span className="t2">{goalLabel}</span><span style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>{Math.round(pct * 100)}%</span></div>
        <div className="progress"><span style={{ width: `${pct * 100}%`, background: view ? 'var(--muted)' : 'var(--accent)' }} /></div>
      </div>
      <span className="muted small">Updated {fmtDate(d.updatedAt)}</span>
    </div>
  );
}

function Invites({ invites, user }: { invites: Invite[] | undefined; user: AuthUser }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [decliningInv, setDecliningInv] = useState<Invite | null>(null);
  const { run: runAccept } = useAcceptInvite();
  const { run: runDecline, busy: declineBusy, error: declineError } = useDeclineInvite();

  const accept = async (inv: Invite) => {
    if (busyId) return;
    setBusyId(inv.id);
    setRowError(null);
    try {
      await runAccept(inv.id, user);
    } catch {
      setRowError('Couldn’t accept that invite — try again.');
    } finally {
      setBusyId(null);
    }
  };
  const confirmDecline = async (inv: Invite) => {
    try {
      await runDecline(inv.id);
      setDecliningInv(null);
    } catch { /* surfaced via declineError */ }
  };

  if (!invites?.length) return null;
  return (
    <div className="col" style={{ gap: 12 }}>
      <span className="list-section-label">Pending invites</span>
      {invites.map((inv) => (
        <div key={inv.id} className="invite-card">
          <span className="avatar" style={{ width: 40, height: 40, fontSize: 15, background: 'var(--p3)' }}>{initials(inv.fromName)}</span>
          <div className="grow">
            <div style={{ fontWeight: 600 }}>{inv.fromName} invited you to “{inv.dashboardName}”</div>
            <div className="t2 small">you’ll be {inv.role === 'viewer' ? 'a viewer' : 'an editor'}</div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn sm" disabled={busyId === inv.id} onClick={() => setDecliningInv(inv)}>Decline</button>
            <button className="btn primary sm" disabled={busyId === inv.id} onClick={() => accept(inv)}><Icon name="check" size={16} color="#fff" />{busyId === inv.id ? 'Accepting…' : 'Accept'}</button>
          </div>
        </div>
      ))}
      {rowError && <span className="small" style={{ color: 'var(--rose)' }}>{rowError}</span>}

      {decliningInv && (
        <Confirm
          title="Decline this invite?" message={`You won’t join “${decliningInv.dashboardName}”. ${decliningInv.fromName} can invite you again later.`}
          confirmLabel="Decline" danger busy={declineBusy} error={declineError}
          onCancel={() => setDecliningInv(null)} onConfirm={() => confirmDecline(decliningInv)}
        />
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="skel" style={{ width: 160, height: 18, borderRadius: 6 }} />
      <div className="grid-3">{[0, 1, 2].map((i) => (
        <div key={i} className="card" style={{ minHeight: 230 }}>
          <div className="skel" style={{ width: '60%', height: 16, borderRadius: 6 }} />
          <div className="skel" style={{ width: '100%', height: 46, borderRadius: 8, marginTop: 16 }} />
          <div className="skel" style={{ width: '40%', height: 24, borderRadius: 6, marginTop: 16 }} />
          <div className="skel" style={{ width: '100%', height: 8, borderRadius: 4, marginTop: 16 }} />
        </div>))}
      </div>
    </div>
  );
}

export default function DashboardsList() {
  const nav = useNavigate();
  const user = useAuthedUser();
  const { data: dashboards, loading, error, reload } = useDashboards(user.uid);
  const { data: invites } = useInvites(user.email);
  const [creating, setCreating] = useState(false);

  const collab = collaborating(dashboards || [], user.uid);
  const views = viewOnly(dashboards || [], user.uid);
  const empty = !loading && !error && collab.length === 0 && views.length === 0;

  return (
    <Layout
      title="Dashboards"
      sub="Everything you’re tracking, shared or your own"
      primary={<button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" color="#fff" />New dashboard</button>}
    >
      {!loading && !error && !empty && (
        <div className="row between">
          <span className="muted small">{collab.length} collaborating · {views.length} view only</span>
        </div>
      )}

      {loading && <ListSkeleton />}

      {!loading && !!error && (
        <RetryCard title="Couldn’t load your dashboards" message="Check your connection and try again." onRetry={reload} />
      )}

      <Invites invites={invites} user={user} />

      {empty && (
        <div className="empty">
          <span className="empty-ic"><Icon name="chart" size={30} color="var(--accent-dark)" /></span>
          <h2>No dashboards yet</h2>
          <p className="t2">Create a dashboard to track your weight, or accept an invite from someone who wants to track with you.</p>
          <button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" color="#fff" />Create dashboard</button>
        </div>
      )}

      {!loading && !error && !empty && (
        <>
          <div className="col" style={{ gap: 14 }}>
            <div className="section-head"><h2>Collaborating</h2><span className="muted small">You can edit shared goals &amp; habits — everyone logs their own weight</span></div>
            <div className="grid-3">
              {collab.map((d) => <DashCard key={d.id} d={d} uid={user.uid} onOpen={() => nav(`/dashboard/${d.id}`)} />)}
              <div className="card create-card" role="button" tabIndex={0} aria-label="Create new dashboard" onClick={() => setCreating(true)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCreating(true); } }} style={{ cursor: 'pointer' }}>
                <span className="ci"><Icon name="plus" color="var(--accent-dark)" /></span>
                <div><div style={{ fontWeight: 600 }}>Create new dashboard</div><div className="muted small" style={{ marginTop: 4 }}>Invite someone to track together</div></div>
              </div>
            </div>
          </div>
          {views.length > 0 && (
            <div className="col" style={{ gap: 14 }}>
              <div className="section-head"><h2>View only</h2><span className="muted small">Shared with you to follow — read only</span></div>
              <div className="grid-3">{views.map((d) => <DashCard key={d.id} d={d} uid={user.uid} onOpen={() => nav(`/dashboard/${d.id}`)} />)}</div>
            </div>
          )}
        </>
      )}

      {creating && <CreateDashboard onClose={() => setCreating(false)} />}
    </Layout>
  );
}
