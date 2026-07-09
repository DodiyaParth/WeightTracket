import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Icon, { AvatarStack } from '../components/Icon.jsx';
import DashboardBody from '../components/DashboardBody.jsx';
import GoalEditor from '../components/GoalEditor.jsx';
import DashSettings from '../components/DashSettings.jsx';
import ShareModal from '../components/ShareModal.jsx';
import { useQuickLog } from '../components/QuickLog.jsx';
import { getDashboard, ACCESS } from '../data.js';

export default function DashboardDetail() {
  const { id } = useParams();
  const quick = useQuickLog();
  const d = getDashboard(id);
  const editable = ACCESS[d.access].editable;
  const [modal, setModal] = useState(null); // 'goals' | 'settings' | 'share'

  const primary = (
    <>
      <AvatarStack members={d.members} size={32} />
      {editable ? (
        <>
          <button className="icon-btn" title="Dashboard settings" onClick={() => setModal('settings')}><Icon name="settings" /></button>
          <button className="btn" onClick={() => setModal('share')}><Icon name="share" />Share</button>
          <button className="btn primary" onClick={() => quick.open()}><Icon name="plus" color="#fff" />Log my weight</button>
        </>
      ) : (
        <span className="tag view" style={{ padding: '8px 12px' }}><Icon name="eye" size={15} color="currentColor" />View only</span>
      )}
    </>
  );

  const sub = editable
    ? `Shared dashboard · you + ${d.members.length - 1} other${d.members.length > 2 ? 's' : ''} · you can edit goals & habits`
    : `Shared with you · ${d.members.length} people · view only`;

  return (
    <Layout title={d.name} sub={sub} primary={primary}>
      <DashboardBody readOnly={!editable} proto members={d.members} onEditGoals={() => setModal('goals')} />
      {modal === 'goals' && <GoalEditor onClose={() => setModal(null)} />}
      {modal === 'settings' && <DashSettings onClose={() => setModal(null)} onEditGoals={() => setModal('goals')} onManageSharing={() => setModal('share')} />}
      {modal === 'share' && <ShareModal dashboard={d} onClose={() => setModal(null)} />}
    </Layout>
  );
}
