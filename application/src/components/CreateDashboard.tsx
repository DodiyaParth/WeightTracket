import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import { SegRadio } from './ui.jsx';
import { useAuthedUser } from '../auth/useAuthedUser.js';
import { useCreateDashboard, useCreateInvite } from '../hooks/mutations.js';
import type { Role } from '../types.js';

const ROLE_OPTIONS: [Role, string][] = [['editor', 'Can edit'], ['viewer', 'Read only']];

// Create a NEW dashboard: name + optional team goal + optional invite.
export default function CreateDashboard({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const user = useAuthedUser();
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [target, setTarget] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [busy, setBusy] = useState(false);
  const { run: runCreateDashboard } = useCreateDashboard();
  const { run: runCreateInvite } = useCreateInvite();

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const d = await runCreateDashboard(user.uid, { name: name.trim(), teamGoalLabel: goal.trim() || null, teamGoalTarget: target });
    if (showInvite && email.trim()) {
      await runCreateInvite(d.id, { fromUid: user.uid, fromName: user.displayName || 'A teammate', toEmail: email.trim(), role });
    }
    onClose();
    nav(`/dashboard/${d.id}`);
  };

  return (
    <Modal title="Create a dashboard" sub="Track a shared goal with someone. You can invite them now or later." width={480} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={create} disabled={!name.trim() || busy}><Icon name="plus" color="#fff" />Create</button></>}>
      <div className="col" style={{ gap: 16 }}>
        <div>
          <label className="field-label">Dashboard name</label>
          <input className="input" placeholder="e.g. Parth & Priya" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid-2">
          <div>
            <label className="field-label">Shared team goal <span className="muted" style={{ fontWeight: 400 }}>· optional</span></label>
            <input className="input" placeholder="e.g. Lose 15 kg together" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Target (kg) <span className="muted" style={{ fontWeight: 400 }}>· optional</span></label>
            <input className="input" inputMode="decimal" placeholder="15" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
        </div>
        {showInvite ? (
          <div>
            <label className="field-label">Invite someone <span className="muted" style={{ fontWeight: 400 }}>· optional</span></label>
            <div className="row invite-row" style={{ gap: 10 }}>
              <input className="input" placeholder="name@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <SegRadio value={role} onChange={setRole} options={ROLE_OPTIONS} ariaLabel="Invite access level" />
            </div>
            <p className="muted small" style={{ marginTop: 8 }}>They’ll get a request — once accepted, it appears in both accounts.</p>
          </div>
        ) : (
          <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShowInvite(true)}><Icon name="plus" color="var(--text-2)" />Invite someone</button>
        )}
        <div className="tip"><Icon name="users" size={16} color="var(--accent-dark)" />Your own weight stays yours — collaborators share the goal and habits, not each other’s numbers.</div>
      </div>
    </Modal>
  );
}
