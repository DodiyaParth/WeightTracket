import React, { useState } from 'react';
import Modal, { Confirm } from './Modal.jsx';
import Icon, { Avatar } from './Icon.jsx';
import { repo } from '../data/repo.js';
import { useAsyncAction } from '../hooks/useAsyncAction.js';
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
          {hasDate
            ? <input className="input" type="date" min={todayISO()} value={g.targetISO!} onChange={(e) => onChange({ targetISO: e.target.value })} />
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
  const [team, setTeam] = useState<{ label: string; target: number | string }>(() => ({ label: dashboard.teamGoal?.label || '', target: dashboard.teamGoal?.target || '' }));
  const [confirmClearTeam, setConfirmClearTeam] = useState(false);
  const { run, busy, error } = useAsyncAction();

  const setGoal = (uid: string, patch: Partial<Goal>) => setGoals((g) => ({ ...g, [uid]: { ...g[uid], ...patch } }));
  const doSave = async () => {
    try {
      await run(() => repo.updateDashboard(dashboard.id, {
        goals,
        teamGoal: team.label.trim() ? { label: team.label.trim(), target: Number(team.target) || 10 } : null,
      }));
    } catch { return; }
    setConfirmClearTeam(false);
    onClose();
  };
  // Clearing the team-goal label is easy to do by accident while editing —
  // confirm before actually removing an existing team goal (DEV-12).
  const save = () => {
    if (dashboard.teamGoal && !team.label.trim()) { setConfirmClearTeam(true); return; }
    doSave();
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
        <div className="divider" />
        <div className="col" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 8, fontWeight: 600 }}><Icon name="target" color="var(--accent-dark)" />Shared team goal</div>
          <div className="grid-2">
            <div><label className="field-label">Goal</label><input className="input" placeholder="Lose 15 kg together" value={team.label} onChange={(e) => setTeam((t) => ({ ...t, label: e.target.value }))} /></div>
            <div><label className="field-label">Target (kg combined)</label><input className="input" inputMode="decimal" value={team.target} onChange={(e) => setTeam((t) => ({ ...t, target: e.target.value }))} /></div>
          </div>
        </div>
        <div className="tip"><Icon name="warn" size={16} color="var(--accent-dark)" />A healthy rate is 0.5–1.0 kg/week. We’ll warn on faster targets — but it’s your call.</div>
      </div>

      {confirmClearTeam && (
        <Confirm
          title="Remove the team goal?" message={`“${dashboard.teamGoal?.label}” will be removed for everyone on this dashboard.`}
          confirmLabel="Remove" danger busy={busy} error={error}
          onCancel={() => setConfirmClearTeam(false)} onConfirm={doSave}
        />
      )}
    </Modal>
  );
}
