import React, { useState } from 'react';
import Icon from './Icon.jsx';
import { habits } from '../data.js';

const DAYS = 28;
const dayLabel = (offset) => {
  const d = new Date('2026-06-30'); d.setDate(d.getDate() - offset);
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

function Checklist({ readOnly }) {
  const [offset, setOffset] = useState(0); // 0 = today; back-date by stepping
  const [marks, setMarks] = useState({}); // `${id}:${col}` overrides
  const col = DAYS - 1 - offset;
  const isDone = (h) => { const k = `${h.id}:${col}`; return k in marks ? marks[k] : h.me[col] === 1; };
  const toggle = (h) => { const k = `${h.id}:${col}`; setMarks((m) => ({ ...m, [k]: !isDone(h) })); };
  const count = habits.filter(isDone).length;

  return (
    <div className="card">
      <div className="section-head" style={{ marginBottom: 6 }}>
        <span className="card-title">My checklist</span>
        <span className="pill">{count}/{habits.length} done</span>
      </div>
      {/* any-date stepper (B4) */}
      <div className="day-stepper">
        <button className="icon-btn ghost-ib" onClick={() => setOffset((o) => Math.min(DAYS - 1, o + 1))}><Icon name="chevronL" size={16} color="var(--text-2)" /></button>
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{dayLabel(offset)}</span>
        <button className="icon-btn ghost-ib" disabled={offset === 0} style={{ opacity: offset === 0 ? 0.35 : 1 }} onClick={() => setOffset((o) => Math.max(0, o - 1))}><Icon name="chevron" size={16} color="var(--text-2)" /></button>
      </div>
      {habits.map((h) => {
        const done = isDone(h);
        return (
          <div key={h.id} className="habit-row">
            {readOnly
              ? <span className={'habit-check' + (done ? ' on' : '')}>{done && <Icon name="check" size={16} color="#fff" />}</span>
              : <button className={'habit-check' + (done ? ' on' : '')} onClick={() => toggle(h)}>{done && <Icon name="check" size={16} color="#fff" />}</button>}
            <span style={{ fontSize: 18 }}>{h.emoji}</span>
            <span style={{ flex: 1, fontWeight: 500 }}>{h.label}</span>
            <span className="muted small">🔥 {h.meStreak} day{h.repaired ? ' · repaired' : ''}</span>
          </div>
        );
      })}
      {!readOnly && <button className="btn ghost sm" style={{ marginTop: 12 }}><Icon name="plus" color="var(--text-2)" />Add habit</button>}
    </div>
  );
}

function StreakGrid({ readOnly }) {
  const [span, setSpan] = useState('Month');
  const [who, setWho] = useState('Both');
  const [edits, setEdits] = useState({});
  const n = span === 'Week' ? 7 : DAYS;
  const sliceStart = DAYS - n;

  const val = (h, key, i) => { const k = `${h.id}:${key}:${i}`; return k in edits ? edits[k] : h[key][sliceStart + i]; };
  const toggleCell = (h, i) => { if (readOnly || who === 'Both') return; const key = who === 'You' ? 'me' : 'partner'; const k = `${h.id}:${key}:${i}`; const cur = val(h, key, i); setEdits((e) => ({ ...e, [k]: cur ? 0 : 1 })); };

  const kind = (h, i) => {
    const a = val(h, 'me', i), b = val(h, 'partner', i);
    if (who === 'You') return a === 2 ? 'grace' : a ? 'both' : 'none';
    if (who === 'Priya') return b === 2 ? 'grace' : b ? 'both' : 'none';
    if (a === 2 || b === 2) return 'grace';
    if (a && b) return 'both';
    if (a || b) return 'one';
    return 'none';
  };

  return (
    <div className="card">
      <div className="section-head" style={{ marginBottom: 14 }}>
        <span className="card-title">Streak grid</span>
        <div className="row" style={{ gap: 8 }}>
          <div className="seg">{['Both', 'You', 'Priya'].map((w) => <button key={w} className={who === w ? 'on' : ''} onClick={() => setWho(w)}>{w}</button>)}</div>
          <div className="range-tabs">{['Week', 'Month'].map((s) => <button key={s} className={span === s ? 'on' : ''} onClick={() => setSpan(s)}>{s}</button>)}</div>
        </div>
      </div>
      {!readOnly && who !== 'Both' && <p className="muted small" style={{ margin: '0 0 12px' }}>Tap a day to toggle — fix a missed check-off any time.</p>}
      <div className="col" style={{ gap: 16 }}>
        {habits.map((h) => (
          <div key={h.id} className="col" style={{ gap: 8 }}>
            <div className="row between">
              <span className="row" style={{ gap: 8 }}><span>{h.emoji}</span><span style={{ fontWeight: 500 }}>{h.label}</span></span>
              {h.repaired ? <span className="pill amber">streak repaired</span> : <span className="muted small">🔥 {who === 'Priya' ? h.partnerStreak : h.meStreak} day streak</span>}
            </div>
            <div className="streak-grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
              {Array.from({ length: n }, (_, i) => {
                const k = kind(h, i);
                const cls = 'streak-cell' + (k === 'both' ? ' on' : k === 'one' ? ' on l2' : k === 'grace' ? ' grace' : '');
                return readOnly || who === 'Both'
                  ? <span key={i} className={cls} />
                  : <button key={i} className={cls} style={{ border: 0, padding: 0, cursor: 'pointer' }} onClick={() => toggleCell(h, i)} />;
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 14, marginTop: 16, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <span className="row muted small" style={{ gap: 6 }}><span className="streak-cell" style={{ width: 12, height: 12 }} />Missed</span>
        {who === 'Both' && <span className="row muted small" style={{ gap: 6 }}><span className="streak-cell on l2" style={{ width: 12, height: 12 }} />One of you</span>}
        <span className="row muted small" style={{ gap: 6 }}><span className="streak-cell on" style={{ width: 12, height: 12 }} />{who === 'Both' ? 'Both done' : 'Done'}</span>
        <span className="row muted small" style={{ gap: 6 }}><span className="streak-cell grace" style={{ width: 12, height: 12 }} />Grace day</span>
      </div>
    </div>
  );
}

export default function HabitsSection({ readOnly }) {
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row between">
        <span className="card-title">Daily habits</span>
        <span className="muted small">The daily behaviors toward “Lose 15 kg together”</span>
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Checklist readOnly={readOnly} />
        <StreakGrid readOnly={readOnly} />
      </div>
    </div>
  );
}
