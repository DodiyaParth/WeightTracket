import React, { useState } from 'react';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';

// Create a NEW dashboard: name + optional first goal + optional invite (D1).
export default function CreateDashboard({ onClose }) {
  const [invite, setInvite] = useState(false);
  return (
    <Modal title="Create a dashboard" sub="Track a shared goal with someone. You can invite them now or later." width={480} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={onClose}><Icon name="plus" color="#fff" />Create</button></>}>
      <div className="col" style={{ gap: 16 }}>
        <div>
          <label className="field-label">Dashboard name</label>
          <input className="input" placeholder="e.g. Parth & Priya" autoFocus />
        </div>
        <div>
          <label className="field-label">Shared team goal <span className="muted" style={{ fontWeight: 400 }}>· optional</span></label>
          <input className="input" placeholder="e.g. Lose 15 kg together" />
        </div>
        {invite ? (
          <div>
            <label className="field-label">Invite someone <span className="muted" style={{ fontWeight: 400 }}>· optional</span></label>
            <input className="input" placeholder="name@email.com" />
            <p className="muted small" style={{ marginTop: 8 }}>They’ll get a request — once accepted, it appears in both accounts.</p>
          </div>
        ) : (
          <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setInvite(true)}><Icon name="plus" color="var(--text-2)" />Invite someone</button>
        )}
        <div className="tip"><Icon name="users" size={16} color="var(--accent-dark)" />Your own weight stays yours — collaborators share the goal and habits, not each other’s numbers.</div>
      </div>
    </Modal>
  );
}
