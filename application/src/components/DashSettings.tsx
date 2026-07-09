import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal, { Confirm } from './Modal.jsx';
import Icon from './Icon.jsx';
import { Toggle } from './ui.jsx';
import { repo } from '../data/repo.js';
import { useAsyncAction } from '../hooks/useAsyncAction.js';
import { memberList } from '../lib/dashboards.js';

const LAYER_LABELS = [['raw', 'Raw daily'], ['projection', 'Projected range'], ['ideal', 'Ideal line'], ['goal', 'Goal band']];

export default function DashSettings({ dashboard, profiles = {}, meUid, onClose, onEditGoals, onManageSharing }) {
  const nav = useNavigate();
  const members = memberList(dashboard, profiles);
  const initial = dashboard.settings || {};
  const [name, setName] = useState(dashboard.name || '');
  const [layers, setLayers] = useState(() => ({ raw: true, projection: true, ideal: true, goal: true, ...initial.layers }));
  const [shown, setShown] = useState(() => Object.fromEntries(members.map((m) => [m.uid, initial.shown?.[m.uid] ?? true])));
  const [dangerAction, setDangerAction] = useState(null); // 'delete' | 'leave'
  const { run, busy, error } = useAsyncAction();
  const { run: runDanger, busy: dangerBusy, error: dangerError } = useAsyncAction();
  const isOwner = dashboard.ownerUid === meUid;

  const save = async () => {
    try {
      await run(() => repo.updateDashboard(dashboard.id, { name: name.trim() || dashboard.name, settings: { layers, shown } }));
    } catch { return; }
    onClose();
  };
  const confirmDanger = async () => {
    try {
      if (dangerAction === 'delete') await runDanger(() => repo.deleteDashboard(dashboard.id));
      else await runDanger(() => repo.removeMember(dashboard.id, meUid));
    } catch { return; }
    nav('/');
  };

  return (
    <Modal title="Dashboard settings" sub={dashboard.name} width={520} onClose={onClose}
      footer={<><button className="btn" onClick={onClose} disabled={busy}>Cancel</button><button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></>}>
      <div className="col" style={{ gap: 20 }}>
        {error && <p className="small" style={{ color: 'var(--rose)', margin: 0 }}>{error}</p>}
        <div>
          <label className="field-label">Dashboard name</label>
          <input className="input" value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label className="field-label">Default chart layers</label>
          <p className="muted small" style={{ margin: '0 0 8px' }}>Which layers show when the dashboard opens. (Smoothing lives on the chart itself.)</p>
          <div className="layer-toggles">
            {LAYER_LABELS.map(([k, l]) => (
              <button key={k} className={'toggle' + (layers[k] ? ' on' : '')} aria-pressed={!!layers[k]} onClick={() => setLayers((s) => ({ ...s, [k]: !s[k] }))}>
                {layers[k] ? <Icon name="check" size={12} color="var(--accent-dark)" /> : <span style={{ width: 8, height: 8, borderRadius: 8, background: 'var(--muted)' }} />}{l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="field-label">People shown by default</label>
          <div className="col" style={{ gap: 0 }}>
            {members.map((m, i) => (
              <div key={m.uid} className="row between" style={{ padding: '10px 0', borderBottom: i < members.length - 1 ? '1px solid var(--border)' : 0 }}>
                <span className="row" style={{ gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 5, background: m.color }} />{m.name}</span>
                <Toggle on={shown[m.uid]} label={`Show ${m.name} by default`} onClick={() => setShown((s) => ({ ...s, [m.uid]: !s[m.uid] }))} />
              </div>
            ))}
          </div>
        </div>

        <div className="row between">
          <div className="col"><span style={{ fontWeight: 500 }}>Units</span><span className="muted small">Kilograms · meters (fixed)</span></div>
          <span className="pill gray">kg · m</span>
        </div>

        <div className="divider" />
        <div className="row" style={{ gap: 10 }}>
          <button className="btn" onClick={onEditGoals}><Icon name="target" color="var(--text-2)" />Edit goals</button>
          <button className="btn" onClick={onManageSharing}><Icon name="share" color="var(--text-2)" />Manage sharing</button>
        </div>

        <div className="divider" />
        <div>
          <label className="field-label" style={{ color: 'var(--rose)' }}>Danger zone</label>
          <div className="row" style={{ gap: 10, marginTop: 8 }}>
            {isOwner ? (
              <button className="btn danger" onClick={() => setDangerAction('delete')}><Icon name="trash" color="#fff" />Delete dashboard</button>
            ) : (
              <button className="btn danger" onClick={() => setDangerAction('leave')}><Icon name="logout" color="#fff" />Leave dashboard</button>
            )}
          </div>
        </div>
      </div>

      {dangerAction && (
        <Confirm
          title={dangerAction === 'delete' ? 'Delete this dashboard?' : 'Leave this dashboard?'}
          message={dangerAction === 'delete'
            ? `“${dashboard.name}” and everyone’s shared goals, habits, and wins on it will be permanently removed. Your own weight history is unaffected. This can’t be undone.`
            : `You’ll lose access to “${dashboard.name}”. Anyone still on it keeps their data — you can be re-invited later.`}
          confirmLabel={dangerAction === 'delete' ? 'Delete' : 'Leave'} danger busy={dangerBusy} error={dangerError}
          onCancel={() => setDangerAction(null)} onConfirm={confirmDanger}
        />
      )}
    </Modal>
  );
}
