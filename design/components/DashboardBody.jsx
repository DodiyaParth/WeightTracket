import React, { useState } from 'react';
import Icon, { Avatar } from './Icon.jsx';
import WeightChart from './Chart.jsx';
import MotivationCard from './MotivationCard.jsx';
import HabitsSection from './HabitsSection.jsx';
import { useQuickLog } from './QuickLog.jsx';
import {
  statsFor, goalFor, STATUS, teamGoal, bmiValue, bmiCategory, healthyRange, nsvSeed, getDashboard,
} from '../data.js';

const Skel = ({ w = '100%', h = 16, r = 6, mt = 0 }) => <div className="skel" style={{ width: w, height: h, borderRadius: r, marginTop: mt }} />;

function EmptyCard({ title, heading, text, icon, cta }) {
  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 8 }}>{title}</div>
      <div className="empty-inline">
        <span className="empty-ic"><Icon name={icon} size={26} color="var(--accent-dark)" /></span>
        <h3>{heading}</h3>
        <p className="t2">{text}</p>
        {cta}
      </div>
    </div>
  );
}

function Tile({ label, value, unit, sub, subTone, pill }) {
  return (
    <div className="card stat-tile">
      <span className="label">{label}</span>
      <span><span className="value">{value}</span>{unit && <span className="unit"> {unit}</span>}</span>
      {pill || (sub && <span className={'small ' + (subTone || 't2')}>{sub}</span>)}
    </div>
  );
}

function StatTiles({ s, days, away, verdict }) {
  const lockProj = days < 14;
  return (
    <div className="grid-4">
      <Tile label="Current weight" value={s.current} unit="kg" sub={`trend ${s.trend}`} />
      <Tile label="Total change" value={(s.total > 0 ? '+' : '−') + Math.abs(s.total)} unit="kg" sub={`since ${s.sinceDate}`} subTone={s.total <= 0 ? 'delta-up' : 'delta-down'} />
      <Tile label="Weekly rate" value={(s.weekly > 0 ? '+' : '−') + Math.abs(s.weekly)} unit="kg/wk"
        pill={<span className={'pill ' + (s.safe ? '' : 'amber')} style={{ marginTop: 4, alignSelf: 'flex-start' }}>{s.safe ? 'within safe range' : 'faster than safe pace'}</span>} />
      {lockProj
        ? <Tile label="Projected goal" value="—" pill={<span className="pill gray" style={{ marginTop: 4, alignSelf: 'flex-start' }}>need more data</span>} />
        : away
          ? <Tile label="Projected goal" value="No estimate" pill={<span className="pill amber" style={{ marginTop: 4, alignSelf: 'flex-start' }}>trend moving away</span>} />
          : <div className="card stat-tile"><span className="label">Projected goal</span><span style={{ fontSize: 18, fontWeight: 600 }}>{s.projRange}</span><span className="small delta-up">{verdict} vs ideal</span></div>}
    </div>
  );
}

function Progress({ s, days, away, verdict }) {
  const mins = { '1d': 1, '7d': 7, '14d': 14, '28d': 28 };
  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 14 }}>Progress &amp; prediction</div>
      <div className="grid-4">
        {s.deltas.map((d) => {
          const ok = days >= mins[d.window];
          return (
            <div key={d.window} className="col" style={{ gap: 4 }}>
              <span className="muted small">{d.window}</span>
              {ok
                ? <><span style={{ fontSize: 20, fontWeight: 600, color: d.value <= 0 ? 'var(--accent-dark)' : 'var(--rose)' }}>{d.value > 0 ? '+' : ''}{d.value}</span><span className="muted small">kg</span></>
                : <><Icon name="lock" size={16} color="var(--muted)" /><span className="muted small">need {mins[d.window]}d</span></>}
            </div>
          );
        })}
      </div>
      <div className="divider" style={{ margin: '16px 0' }} />
      <div className="row between">
        <span className="t2 small">Projected goal date</span>
        {days < 14
          ? <span className="pill gray">need more data</span>
          : away
            ? <span className="pill amber">trend moving away — no estimate</span>
            : <span><b>{s.projRange}</b> · <span className="pill">{verdict} vs ideal</span></span>}
      </div>
    </div>
  );
}

function GoalRow({ person }) {
  const g = goalFor(person.id);
  const pct = Math.min(1, (g.start - g.current) / (g.start - g.target || 1));
  return (
    <div className="col" style={{ gap: 9 }}>
      <div className="row between">
        <div className="row" style={{ gap: 9 }}>
          <Avatar size={26} color={person.color}>{person.initial}</Avatar>
          <span style={{ fontWeight: 600 }}>{person.name}</span>
          <span className="pill gray">{g.targetDate ? `by ${g.targetDate}` : 'no date · safe-pace ETA'}</span>
        </div>
        <span className="t2 small">{g.current} → <b style={{ color: 'var(--text)' }}>{g.target} kg</b></span>
      </div>
      <div className="progress"><span style={{ width: `${pct * 100}%`, background: person.color }} /></div>
    </div>
  );
}

function BmiRow({ person }) {
  const cur = statsFor(person.id).current;
  const bmi = bmiValue(cur, person.heightM);
  if (bmi == null) {
    return (
      <div className="row between">
        <span className="row" style={{ gap: 8 }}><Avatar size={22} color={person.color}>{person.initial}</Avatar>{person.name}</span>
        <span className="muted small">Add height in Profile to see BMI</span>
      </div>
    );
  }
  const cat = bmiCategory(bmi);
  const [lo, hi] = healthyRange(person.heightM);
  const pos = Math.max(0, Math.min(100, ((bmi - 17) / (32 - 17)) * 100));
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row between">
        <span className="row" style={{ gap: 8 }}><Avatar size={22} color={person.color}>{person.initial}</Avatar>{person.name}</span>
        <span><b>{bmi}</b> <span className="muted small">{cat}</span></span>
      </div>
      <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'linear-gradient(90deg,#7fb2e8 0 22%,#2aa897 22% 52%,#e69a3b 52% 78%,#e5786f 78% 100%)' }} />
      <div style={{ position: 'relative', height: 0 }}>
        <span style={{ position: 'absolute', left: `${pos}%`, top: -14, transform: 'translateX(-50%)', width: 2, height: 14, background: 'var(--text)' }} />
      </div>
      <span className="muted small">Healthy band {lo}–{hi} kg</span>
    </div>
  );
}

function Wins({ readOnly, isNew }) {
  const [notes, setNotes] = useState(isNew ? [] : nsvSeed);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const today = 'Jun 30';
  const save = () => { if (text.trim()) setNotes((n) => [{ date: today, text: text.trim() }, ...n]); setText(''); setAdding(false); };
  return (
    <div className="card">
      <div className="section-head" style={{ marginBottom: 12 }}>
        <span className="card-title">Wins this month</span>
        {!readOnly && <button className="btn ghost sm" onClick={() => setAdding(true)}><Icon name="plus" color="var(--text-2)" />Add</button>}
      </div>
      {adding && !readOnly && (
        <div className="nsv-compose">
          <span className="pill gray">{today}</span>
          <input className="input" placeholder="e.g. rings feel looser…" value={text} autoFocus onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
          <button className="btn primary sm" onClick={save}>Save</button>
        </div>
      )}
      {notes.length === 0 && !adding
        ? <p className="muted small" style={{ margin: 0 }}>No wins logged yet — add the first one. Small non-scale wins keep you going.</p>
        : <div className="col" style={{ gap: 12, marginTop: adding ? 12 : 0 }}>
          {notes.map((n, i) => (
            <div key={i} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <span className="muted small" style={{ width: 48, flex: 'none' }}>{n.date}</span>
              <span className="small">{n.text}</span>
            </div>
          ))}
        </div>}
    </div>
  );
}

const Disclaimer = () => <p className="disclaimer" style={{ textAlign: 'left' }}>Not medical advice. Healthy loss is 0.5–1.0 kg/week.</p>;

function LoadingState() {
  return (
    <>
      <div className="grid-4">{[0, 1, 2, 3].map((i) => <div key={i} className="card stat-tile"><Skel w="50%" h={12} /><Skel w="70%" h={26} mt={8} /><Skel w="40%" h={12} mt={8} /></div>)}</div>
      <div className="content-2col">
        <div className="col" style={{ gap: 24 }}><div className="card"><Skel w="30%" h={16} /><Skel h={240} mt={16} r={10} /></div></div>
        <div className="col" style={{ gap: 24 }}><div className="card"><Skel w="50%" h={16} /><Skel h={90} mt={14} r={8} /></div><div className="card"><Skel w="50%" h={16} /><Skel h={70} mt={14} r={8} /></div></div>
      </div>
    </>
  );
}

export default function DashboardBody({ readOnly = false, proto = false, members, onEditGoals = () => {} }) {
  const mem = members || getDashboard('d1').members;
  const quick = useQuickLog();
  const [dataState, setDataState] = useState('populated');
  const [focus, setFocus] = useState(mem[0].id);
  const [stateBy, setStateBy] = useState(() => Object.fromEntries(mem.map((p) => [p.id, statsFor(p.id).state])));
  const [banner, setBanner] = useState(true);

  const days = dataState === 'new' ? 0 : dataState === 'few' ? 9 : 120;
  const isNew = dataState === 'new';
  const focusPerson = mem.find((p) => p.id === focus) || mem[0];
  const fStats = statsFor(focus);
  const fState = stateBy[focus];
  const away = STATUS[fState].away && dataState === 'populated';
  const verdict = STATUS[fState].label;
  const chartPeople = mem.map((p) => ({ id: p.id, name: p.name, color: p.color }));

  const Controls = proto && (
    <div className="proto-controls">
      <span className="proto-label">Prototype preview</span>
      <span className="muted small">Data state:</span>
      <div className="range-tabs">
        {[['populated', 'Populated'], ['new', 'New'], ['few', 'Few days'], ['loading', 'Loading'], ['error', 'Error']].map(([k, l]) => (
          <button key={k} className={dataState === k ? 'on' : ''} onClick={() => setDataState(k)}>{l}</button>
        ))}
      </div>
      <span className="muted small" style={{ marginLeft: 'auto' }}>Per-person motivation state → in the card</span>
    </div>
  );

  if (dataState === 'loading') return <>{Controls}<LoadingState /></>;
  if (dataState === 'error') return (
    <>{Controls}
      <div className="empty">
        <span className="empty-ic" style={{ background: 'var(--amber-tint)' }}><Icon name="warn" size={26} color="#b9742a" /></span>
        <h2>Couldn’t load this dashboard</h2>
        <p className="t2">Something went wrong fetching the latest data. Your entries are safe.</p>
        <button className="btn primary" onClick={() => setDataState('populated')}>Try again</button>
      </div>
    </>
  );

  if (isNew) return (
    <>{Controls}
      <div className="empty">
        <span className="empty-ic"><Icon name="scale" size={28} color="var(--accent-dark)" /></span>
        <h2>No weigh-ins yet</h2>
        <p className="t2">Add your first weigh-in to start the trend — it fills in from there.</p>
        {!readOnly && <button className="btn primary" onClick={() => quick.open()}><Icon name="plus" color="#fff" />Log my weight</button>}
      </div>
      <div className="content-2col">
        <EmptyCard title="Goals" heading="No goals set yet" icon="target"
          text="Set a target weight and a shared team goal to unlock the ideal line and pace check."
          cta={!readOnly && <button className="btn primary" onClick={onEditGoals}><Icon name="target" color="#fff" />Set a goal</button>} />
        <EmptyCard title="Habits" heading="No habits yet" icon="habits"
          text="Add the first thing you’ll both do daily toward your goal."
          cta={!readOnly && <button className="btn primary"><Icon name="plus" color="#fff" />Add habit</button>} />
      </div>
    </>
  );

  return (
    <>
      {Controls}
      {fState === 'milestone' && banner && (
        <div className="celebrate">
          <span style={{ fontSize: 22 }}>🎉</span>
          <div className="grow"><b>{focusPerson.name} reached a milestone — 5% of body weight!</b> <span className="t2 small">That’s −{fStats.milestone5} kg. Consistency is paying off.</span></div>
          <button className="icon-btn ghost-ib" onClick={() => setBanner(false)}><Icon name="close" color="var(--accent-dark)" /></button>
        </div>
      )}

      <div className="row between" style={{ alignItems: 'center' }}>
        <span className="muted small">Showing {focusPerson.name}’s stats, goal &amp; motivation</span>
        <div className="seg">
          {mem.map((p) => (
            <button key={p.id} className={focus === p.id ? 'on' : ''} onClick={() => setFocus(p.id)}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: p.color, display: 'inline-block', marginRight: 6 }} />{p.name}
            </button>
          ))}
        </div>
      </div>

      <StatTiles s={fStats} days={days} away={away} verdict={verdict} />

      <div className="content-2col">
        <div className="col" style={{ gap: 24 }}>
          <div className="card">
            <WeightChart people={chartPeople} focusId={focus} goal={days < 14 ? null : goalFor(focus)} away={away} status={STATUS[fState].label} enoughData={days >= 14} />
          </div>
          <Progress s={fStats} days={days} away={away} verdict={verdict} />
          <div className="card">
            <div className="section-head" style={{ marginBottom: 16 }}>
              <span className="card-title">Goals</span>
              {!readOnly && <button className="btn ghost sm" onClick={onEditGoals}><Icon name="edit" color="var(--text-2)" />Edit</button>}
            </div>
            <div className="col" style={{ gap: 18 }}>
              {mem.map((p) => <GoalRow key={p.id} person={p} />)}
              <div className="divider" />
              <div className="col" style={{ gap: 9 }}>
                <div className="row between">
                  <span className="row" style={{ gap: 8, fontWeight: 600 }}><Icon name="target" color="var(--accent-dark)" />Team goal · {teamGoal.label}</span>
                  <span className="t2 small">{teamGoal.lost} / {teamGoal.target} kg</span>
                </div>
                <div className="progress"><span style={{ width: `${teamGoal.pct * 100}%` }} /></div>
              </div>
            </div>
          </div>
        </div>

        <div className="col" style={{ gap: 24 }}>
          <MotivationCard person={focusPerson} state={fState} stats={fStats} proto={proto} onState={(v) => setStateBy((s) => ({ ...s, [focus]: v }))} />
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>BMI &amp; healthy range</div>
            <div className="col" style={{ gap: 18 }}>{mem.map((p) => <BmiRow key={p.id} person={p} />)}</div>
          </div>
          <Wins readOnly={readOnly} />
          <Disclaimer />
        </div>
      </div>

      <HabitsSection readOnly={readOnly} />
    </>
  );
}
