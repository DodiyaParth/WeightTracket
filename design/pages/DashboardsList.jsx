import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Icon, { AvatarStack } from '../components/Icon.jsx';
import { RoleBadge } from '../components/ui.jsx';
import { Sparkline } from '../components/Chart.jsx';
import CreateDashboard from '../components/CreateDashboard.jsx';
import { collaborating, viewOnly, pendingInvites, ACCESS, spark } from '../data.js';

function DashCard({ d, onOpen }) {
  const view = !ACCESS[d.access].editable;
  return (
    <div className="card dash-card" onClick={onOpen} style={{ cursor: 'pointer' }}>
      <div className="row between"><span className="card-title">{d.name}</span><RoleBadge access={d.access} /></div>
      <Sparkline data={spark(d.members[0].id)} color={view ? 'var(--muted)' : 'var(--accent)'} />
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <div className="row" style={{ gap: 7, alignItems: 'baseline' }}>
          <span className="stat" style={{ color: view ? 'var(--text)' : 'var(--accent-dark)' }}>{d.stat}</span>
          <span className="t2 small">together</span>
        </div>
        <AvatarStack members={d.members} size={28} />
      </div>
      <div className="col" style={{ gap: 8 }}>
        <div className="row between small"><span className="t2">{d.goalLabel}</span><span style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>{Math.round(d.goalPct * 100)}%</span></div>
        <div className="progress"><span style={{ width: `${d.goalPct * 100}%`, background: view ? 'var(--muted)' : 'var(--accent)' }} /></div>
      </div>
      <span className="muted small">{d.updatedLabel}</span>
    </div>
  );
}

function Invites({ invites, act }) {
  if (!invites.length) return null;
  return (
    <div className="col" style={{ gap: 12 }}>
      <span className="list-section-label">Pending invites</span>
      {invites.map((inv) => (
        <div key={inv.id} className="invite-card">
          <span className="avatar" style={{ width: 40, height: 40, fontSize: 15, background: 'var(--p3)' }}>{inv.fromInitial}</span>
          <div className="grow">
            <div style={{ fontWeight: 600 }}>{inv.from} invited you to “{inv.dashboardName}”</div>
            <div className="t2 small">{inv.members} people · sent {inv.when} · you’ll be an editor</div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn sm" onClick={() => act(inv.id)}>Decline</button>
            <button className="btn primary sm" onClick={() => act(inv.id)}><Icon name="check" size={16} color="#fff" />Accept</button>
          </div>
        </div>
      ))}
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
  const [demo, setDemo] = useState('populated');
  const [invites, setInvites] = useState(pendingInvites);
  const [creating, setCreating] = useState(false);
  const collab = collaborating();
  const views = viewOnly();
  const act = (id) => setInvites((v) => v.filter((x) => x.id !== id));
  const labels = { populated: `${collab.length} collaborating · ${views.length} view only`, empty: 'New account', loading: 'Loading…', error: 'Connection error' };

  return (
    <Layout title="Dashboards" sub="Everything you’re tracking, shared or your own"
      primary={<button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" color="#fff" />New dashboard</button>}>
      <div className="row between">
        <span className="muted small">{labels[demo]}</span>
        <div className="range-tabs" title="Prototype preview">
          {[['populated', 'Populated'], ['empty', 'Empty'], ['loading', 'Loading'], ['error', 'Error']].map(([k, l]) => (
            <button key={k} className={demo === k ? 'on' : ''} onClick={() => setDemo(k)}>{l}</button>
          ))}
        </div>
      </div>

      {demo === 'loading' && <ListSkeleton />}
      {demo === 'error' && (
        <div className="empty">
          <span className="empty-ic" style={{ background: 'var(--amber-tint)' }}><Icon name="warn" size={26} color="#b9742a" /></span>
          <h2>Couldn’t load your dashboards</h2><p className="t2">Check your connection and try again. Nothing has been lost.</p>
          <button className="btn primary" onClick={() => setDemo('populated')}>Try again</button>
        </div>
      )}

      {(demo === 'populated' || demo === 'empty') && <Invites invites={invites} act={act} />}

      {demo === 'empty' && (
        <div className="empty">
          <span className="empty-ic"><Icon name="chart" size={30} color="var(--accent-dark)" /></span>
          <h2>No dashboards yet</h2>
          <p className="t2">Create a dashboard to track your weight, or accept an invite from someone who wants to track with you.</p>
          <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
            <button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" color="#fff" />Create dashboard</button>
          </div>
        </div>
      )}

      {demo === 'populated' && (
        <>
          <div className="col" style={{ gap: 14 }}>
            <div className="section-head"><h2>Collaborating</h2><span className="muted small">You can edit shared goals &amp; habits — everyone logs their own weight</span></div>
            <div className="grid-3">
              {collab.map((d) => <DashCard key={d.id} d={d} onOpen={() => nav(`/dashboard/${d.id}`)} />)}
              <div className="card create-card" onClick={() => setCreating(true)} style={{ cursor: 'pointer' }}>
                <span className="ci"><Icon name="plus" color="var(--accent-dark)" /></span>
                <div><div style={{ fontWeight: 600 }}>Create new dashboard</div><div className="muted small" style={{ marginTop: 4 }}>Invite someone to track together</div></div>
              </div>
            </div>
          </div>
          <div className="col" style={{ gap: 14 }}>
            <div className="section-head"><h2>View only</h2><span className="muted small">Shared with you to follow — read only</span></div>
            <div className="grid-3">{views.map((d) => <DashCard key={d.id} d={d} onOpen={() => nav(`/dashboard/${d.id}`)} />)}</div>
          </div>
        </>
      )}

      {creating && <CreateDashboard onClose={() => setCreating(false)} />}
    </Layout>
  );
}
