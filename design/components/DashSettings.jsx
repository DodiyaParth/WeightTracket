import React, { useState } from 'react';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import { Toggle } from './ui.jsx';
import { me, partner } from '../data.js';

export default function DashSettings({ onClose, onEditGoals, onManageSharing }) {
  const [layers, setLayers] = useState({ raw: true, projection: true, ideal: true, goal: true });
  const [shown, setShown] = useState({ parth: true, priya: true });

  return (
    <Modal title="Dashboard settings" sub="Parth & Priya" width={520} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={onClose}>Save settings</button></>}>
      <div className="col" style={{ gap: 20 }}>
        <div>
          <label className="field-label">Default chart layers</label>
          <p className="muted small" style={{ margin: '0 0 8px' }}>Which layers show when the dashboard opens. (Smoothing lives on the chart itself.)</p>
          <div className="layer-toggles">
            {[['raw', 'Raw daily'], ['projection', 'Projected range'], ['ideal', 'Ideal line'], ['goal', 'Goal band']].map(([k, l]) => (
              <button key={k} className={'toggle' + (layers[k] ? ' on' : '')} onClick={() => setLayers((s) => ({ ...s, [k]: !s[k] }))}>
                <span style={{ width: 8, height: 8, borderRadius: 8, background: layers[k] ? 'var(--accent)' : 'var(--muted)' }} />{l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="field-label">People shown by default</label>
          <div className="col" style={{ gap: 0 }}>
            {[[me, 'parth'], [partner, 'priya']].map(([p, k]) => (
              <div key={k} className="row between" style={{ padding: '10px 0', borderBottom: k === 'parth' ? '1px solid var(--border)' : 0 }}>
                <span className="row" style={{ gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 5, background: p.color }} />{p.name}</span>
                <Toggle on={shown[k]} onClick={() => setShown((s) => ({ ...s, [k]: !s[k] }))} />
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
      </div>
    </Modal>
  );
}
