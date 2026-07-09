import React, { useState } from 'react';
import Modal from './Modal.jsx';
import Icon, { Avatar } from './Icon.jsx';
import { me, partner, goals } from '../data.js';

const TODAY = new Date('2026-06-30');
const WEEK = 7 * 24 * 3600 * 1000;

function PersonGoal({ person, g, defISO }) {
  const [target, setTarget] = useState(g.target);
  const [hasDate, setHasDate] = useState(!!g.targetDate);
  const [date, setDate] = useState(defISO);

  const lose = Math.max(0, g.current - Number(target || 0));
  let line, tone = 't2';
  if (lose <= 0) {
    line = 'Maintain — already at or below target.';
  } else if (hasDate) {
    const weeks = Math.max(0.5, (new Date(date) - TODAY) / WEEK);
    const pace = lose / weeks;
    if (pace > 1.0) { tone = 'warn'; line = `This needs ~${pace.toFixed(1)} kg/wk — faster than the safe 0.5–1.0 range.`; }
    else line = `~${pace.toFixed(2)} kg/wk — within the safe range. ✓`;
  } else {
    const weeks = Math.round(lose / 0.75);
    line = `No date — safe-pace ETA ≈ ${weeks} weeks at 0.5–1.0 kg/wk.`;
  }

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 9 }}>
        <Avatar size={24} color={person.color}>{person.initial}</Avatar>
        <span style={{ fontWeight: 600 }}>{person.name}</span>
        <span className="muted small">now {g.current} kg</span>
      </div>
      <div className="grid-2">
        <div>
          <label className="field-label">Target weight (kg)</label>
          <input className="input" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Target date</label>
          {hasDate
            ? <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            : <div className="input row between muted" onClick={() => setHasDate(true)} style={{ cursor: 'pointer' }}><span>No date set</span><Icon name="calendar" color="var(--muted)" /></div>}
        </div>
      </div>
      <div className="row between">
        <span className={'small ' + (tone === 'warn' ? '' : 'muted')} style={tone === 'warn' ? { color: '#b9742a', display: 'flex', gap: 6, alignItems: 'center' } : {}}>
          {tone === 'warn' && <Icon name="warn" size={15} color="#b9742a" />}{line}
        </span>
        <button className="btn ghost sm" onClick={() => setHasDate((v) => !v)}>{hasDate ? 'Remove date' : 'Add date'}</button>
      </div>
    </div>
  );
}

export default function GoalEditor({ onClose }) {
  return (
    <Modal title="Edit goals" sub="Targets are dashboard content — any editor can adjust them." width={560} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={onClose}>Save goals</button></>}>
      <div className="col" style={{ gap: 20 }}>
        <PersonGoal person={me} g={goals.parth} defISO="2026-09-30" />
        <div className="divider" />
        <PersonGoal person={partner} g={goals.priya} defISO="2026-11-15" />
        <div className="divider" />
        <div className="col" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 8, fontWeight: 600 }}><Icon name="target" color="var(--accent-dark)" />Shared team goal</div>
          <div className="grid-2">
            <div><label className="field-label">Goal</label><input className="input" defaultValue="Lose 15 kg together" /></div>
            <div><label className="field-label">Target (kg combined)</label><input className="input" defaultValue="15" /></div>
          </div>
        </div>
        <div className="tip"><Icon name="warn" size={16} color="var(--accent-dark)" />A healthy rate is 0.5–1.0 kg/week. We’ll warn on faster targets — but it’s your call.</div>
      </div>
    </Modal>
  );
}
