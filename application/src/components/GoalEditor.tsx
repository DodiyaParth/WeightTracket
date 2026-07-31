import React, { useState } from 'react';
import Modal from './Modal.jsx';
import Icon, { Avatar } from './Icon.jsx';
import { useUpdateDashboard } from '../hooks/mutations.js';
import { memberList } from '../lib/dashboards.js';
import { paceCheck } from '../lib/health.js';
import { currentWeight } from '../lib/stats.js';
import { todayISO, addDays } from '../lib/date.js';
import type { Dashboard, EnrichedMember, Goal, Profile, SeriesPoint } from '../types.js';

interface PersonGoalProps {
  person: EnrichedMember;
  currentKg: number | null;
  g: Goal;
  onChange: (patch: Partial<Goal>) => void;
}

function PersonGoal({ person, currentKg, g, onChange }: PersonGoalProps) {
  const target = g.targetKg ?? '';
  const hasDate = !!g.targetISO;
  const pace = paceCheck({ current: currentKg ?? 0, target: Number(target || 0), targetISO: g.targetISO });

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 9 }}>
        <Avatar size={24} color={person.color}>{person.initial}</Avatar>
        <span style={{ fontWeight: 600 }}>{person.name}</span>
        <span className="muted small">now {currentKg != null ? `${currentKg} kg` : '—'}</span>
      </div>
      <div className="grid-2">
        <div>
          <label className="field-label">Target weight (kg)</label>
          <input className="input" inputMode="decimal" value={target} onChange={(e) => onChange({ targetKg: e.target.value === '' ? null : +e.target.value })} />
        </div>
        <div>
          <label className="field-label">Target date</label>
          {g.targetISO
            ? <input className="input" type="date" min={todayISO()} value={g.targetISO} onChange={(e) => onChange({ targetISO: e.target.value })} />
            : <button className="input date-field row between muted" onClick={() => onChange({ targetISO: addDays(todayISO(), 90) })}><span>No date set</span><Icon name="calendar" color="var(--muted)" /></button>}
        </div>
      </div>
      <div className="row between">
        <span className="small" style={pace.tone === 'warn' ? { color: '#b9742a', display: 'flex', gap: 6, alignItems: 'center' } : { color: 'var(--muted)' }}>
          {pace.tone === 'warn' && <Icon name="warn" size={15} color="#b9742a" />}{pace.line}
        </span>
        {hasDate && <button className="btn ghost sm" onClick={() => onChange({ targetISO: null })}>Remove date</button>}
      </div>
    </div>
  );
}

interface GoalEditorProps {
  dashboard: Dashboard;
  series?: Record<string, SeriesPoint[]>;
  profiles?: Record<string, Profile>;
  onClose: () => void;
}

export default function GoalEditor({ dashboard, series, profiles = {}, onClose }: GoalEditorProps) {
  const members = memberList(dashboard, profiles);
  const [goals, setGoals] = useState<Record<string, Goal>>(() => ({ ...dashboard.goals }));
  const { run, busy, error } = useUpdateDashboard();

  // Spreads the existing goal (incl. startISO) so editing a target/date here
  // never drops the journey start the wizard set — the team goal is derived
  // (lib/dashboards.deriveTeamGoal), so there's nothing team-related to edit.
  const setGoal = (uid: string, patch: Partial<Goal>) => setGoals((g) => ({ ...g, [uid]: { ...g[uid], ...patch } }));
  const save = async () => {
    try {
      await run(dashboard.id, { goals });
    } catch { return; }
    onClose();
  };

  return (
    <Modal title="Edit goals" sub="Targets are dashboard content — any editor can adjust them." width={560} onClose={onClose}
      footer={<><button className="btn" onClick={onClose} disabled={busy}>Cancel</button><button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save goals'}</button></>}>
      <div className="col" style={{ gap: 20 }}>
        {error && <p className="small" style={{ color: 'var(--rose)', margin: 0 }}>{error}</p>}
        {members.map((m, i) => (
          <React.Fragment key={m.uid}>
            {i > 0 && <div className="divider" />}
            <PersonGoal person={m} currentKg={currentWeight(series?.[m.uid] || [])} g={goals[m.uid] || {}} onChange={(p) => setGoal(m.uid, p)} />
          </React.Fragment>
        ))}
        <div className="tip"><Icon name="target" size={16} color="var(--accent-dark)" />The shared team goal adds up everyone’s targets automatically — no need to set it here.</div>
      </div>
    </Modal>
  );
}
