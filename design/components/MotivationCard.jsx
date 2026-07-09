import React from 'react';
import Icon from './Icon.jsx';
import { motivationStates, MOTIV_ORDER } from '../data.js';

// Per-person motivation. Self-anchored only — no partner cadence, no claps (§6.4).
export default function MotivationCard({ person, state, stats, proto, onState }) {
  const m = motivationStates[state] || motivationStates.onTrack;
  const body = m.body.replace('{kg}', stats.milestone5).replace('{name}', person.name);
  const p = stats.milestoneProgress;

  return (
    <div className="card" style={{ background: 'linear-gradient(160deg,#effaf8,#ffffff)' }}>
      <div className="row between" style={{ marginBottom: 4 }}>
        <span className="card-title">For {person.name}</span>
        {proto && (
          <select className="proto-select" value={state} onChange={(e) => onState(e.target.value)} title="Prototype: preview each state">
            {MOTIV_ORDER.map((k) => <option key={k} value={k}>{motivationStates[k].label}</option>)}
          </select>
        )}
      </div>

      <div className="motiv">
        <span className="emoji">{m.emoji}</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{m.title}</div>
          <p className="t2 small" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>{body}</p>
        </div>
      </div>

      <div className="milestone-track" style={{ marginTop: 14 }}>
        <div className="milestone done"><span className="dot"><Icon name="check" size={14} color="#fff" /></span><span className="ml">5% · −{stats.milestone5}kg</span></div>
        <div className="milestone-bar" style={{ background: `linear-gradient(90deg,var(--accent) ${p * 100}%,var(--track) ${p * 100}%)` }} />
        <div className="milestone"><span className="dot">10%</span><span className="ml">10% · −{stats.milestone10}kg</span></div>
      </div>
      <p className="muted small" style={{ margin: '10px 0 0' }}>Next milestone: 10% of body weight (−{stats.milestone10} kg)</p>
    </div>
  );
}
