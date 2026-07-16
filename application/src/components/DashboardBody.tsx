import { useState, type ReactNode } from 'react';
import Icon, { Avatar } from './Icon.jsx';
import WeightChart from './Chart.jsx';
import MotivationCard from './MotivationCard.jsx';
import HabitsSection from './HabitsSection.jsx';
import { useQuickLog } from './QuickLog.jsx';
import { Confirm } from './Modal.jsx';
import { ChangeText } from './ui.jsx';
import { useAddNsv, useDeleteNsv } from '../hooks/mutations.js';
import { memberList } from '../lib/dashboards.js';
import { summarize, currentWeight, spanDays, togetherChange, type Summary, type Projection } from '../lib/stats.js';
import { computeState, STATUS, milestones, milestoneProgress } from '../lib/motivation.js';
import { bmiValue, bmiCategory, healthyRange, isSafePace, goalProgress, verdictVsIdeal } from '../lib/health.js';
import { fmtDate, todayISO } from '../lib/date.js';
import { fmtKg, formatChange } from '../lib/format.js';
import type { Dashboard, EnrichedMember, Goal, HabitLog, Nsv, Profile, SeriesPoint } from '../types.js';

// A dashboard's per-person goal resolved for display: stored goal fields with a
// starting weight backfilled from the first weigh-in when unset. Shape-compatible
// with the domain Goal so it can flow into summarize/computeState unchanged.
type ResolvedGoal = { startKg: number | null; targetKg: number | null; targetISO: string | null };

function goalFor(dashboard: Dashboard, series: Record<string, SeriesPoint[]>, uid: string): ResolvedGoal {
  const g: Goal = dashboard.goals?.[uid] || {};
  const entries = series[uid] || [];
  // No stored startKg (see types.ts Goal) — the baseline is always the
  // person's first weigh-in, so it can never drift from what's actually on
  // the chart.
  const startKg = entries[0]?.kg ?? null;
  return { startKg, targetKg: g.targetKg ?? null, targetISO: g.targetISO ?? null };
}

interface TileProps {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  sub?: ReactNode;
  subTone?: string;
  pill?: ReactNode;
}

function Tile({ label, value, unit, sub, subTone, pill }: TileProps) {
  return (
    <div className="card stat-tile">
      <span className="label">{label}</span>
      <span><span className="value">{value}</span>{unit && <span className="unit"> {unit}</span>}</span>
      {pill || (sub && <span className={'small ' + (subTone || 't2')}>{sub}</span>)}
    </div>
  );
}

interface StatsPanelProps {
  s: Summary;
  days: number;
  proj: Projection;
  verdict: string | null;
  verdictTone: string;
  away: boolean;
  // False when the focused person has no targetKg set (see goalFor) — the
  // projection math still runs (it also reports pure trend direction), but
  // without a target there is nothing to project a date *toward*, so the
  // tile/panel must say so explicitly instead of rendering a blank value.
  hasGoal: boolean;
}

function StatTiles({ s, days, proj, verdict, verdictTone, away, hasGoal }: StatsPanelProps) {
  const lockProj = days < 14;
  const totalC = formatChange(s.total);
  const weeklyC = formatChange(s.weekly, { unit: 'kg/wk' });
  return (
    <div className="grid-4">
      <Tile label="Current weight" value={s.current != null ? fmtKg(s.current) : '—'} unit="kg" sub={s.trend != null ? `trend ${fmtKg(s.trend)}` : ''} />
      <Tile label="Total change" value={<ChangeText change={totalC} />} sub="since start" />
      <Tile label="Weekly rate" value={<ChangeText change={weeklyC} />}
        pill={<span className={'pill ' + (isSafePace(s.weekly) ? '' : 'amber')} style={{ marginTop: 4, alignSelf: 'flex-start' }}>{isSafePace(s.weekly) ? 'within safe range' : 'faster than safe pace'}</span>} />
      {lockProj
        ? <Tile label="Projected goal" value="—" pill={<span className="pill gray" style={{ marginTop: 4, alignSelf: 'flex-start' }}>need more data</span>} />
        : !hasGoal
          ? <Tile label="Projected goal" value="—" pill={<span className="pill gray" style={{ marginTop: 4, alignSelf: 'flex-start' }}>set a goal</span>} />
          : away || proj.status !== 'ok'
            ? <Tile label="Projected goal" value="No estimate" pill={<span className="pill amber" style={{ marginTop: 4, alignSelf: 'flex-start' }}>trend moving away</span>} />
            : <div className="card stat-tile"><span className="label">Projected goal</span><span className="num-md">{proj.rangeLabel}</span>{verdict && <span className={'small ' + verdictTone}>{verdict} vs ideal</span>}</div>}
    </div>
  );
}

function Progress({ s, days, proj, verdict, verdictTone, away, hasGoal }: StatsPanelProps) {
  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 14 }}>Progress &amp; prediction</div>
      <div className="grid-4">
        {s.deltas.map((d) => (
          <div key={d.window} className="col" style={{ gap: 4 }}>
            <span className="muted small">{d.window}d</span>
            {d.value != null
              ? <ChangeText change={formatChange(d.value)} className="num-lg" />
              : <><Icon name="lock" size={16} color="var(--muted)" /><span className="muted small">need {d.window}d</span></>}
          </div>
        ))}
      </div>
      <div className="divider" style={{ margin: '16px 0' }} />
      <div className="row between">
        <span className="t2 small">Projected goal date</span>
        {days < 14
          ? <span className="pill gray">need more data</span>
          : !hasGoal
            ? <span className="pill gray">set a goal to see an estimate</span>
            : away || proj.status !== 'ok'
              ? <span className="pill amber">trend moving away — no estimate</span>
              : <span><b>{proj.rangeLabel}</b>{verdict ? <> · <span className={'pill' + (verdictTone === 'change-bad' ? ' amber' : '')}>{verdict} vs ideal</span></> : null}</span>}
      </div>
    </div>
  );
}

interface GoalRowProps {
  person: EnrichedMember;
  g: ResolvedGoal;
  currentKg: number | null;
}

function GoalRow({ person, g, currentKg }: GoalRowProps) {
  if (g.targetKg == null) {
    return (
      <div className="row between">
        <span className="row" style={{ gap: 9 }}><Avatar size={26} color={person.color}>{person.initial}</Avatar><span style={{ fontWeight: 600 }}>{person.name}</span></span>
        <span className="muted small">No goal set</span>
      </div>
    );
  }
  // null coerces to 0 in the arithmetic goalProgress does, so ?? 0 is behaviour-identical.
  const pct = goalProgress({ start: g.startKg ?? currentKg ?? 0, current: currentKg ?? 0, target: g.targetKg });
  return (
    <div className="col" style={{ gap: 9 }}>
      <div className="row between">
        <div className="row" style={{ gap: 9 }}>
          <Avatar size={26} color={person.color}>{person.initial}</Avatar>
          <span style={{ fontWeight: 600 }}>{person.name}</span>
          <span className="pill gray">{g.targetISO ? `by ${fmtDate(g.targetISO)}` : 'no date · safe-pace ETA'}</span>
        </div>
        <span className="t2 small">{currentKg ?? '—'} → <b style={{ color: 'var(--text)' }}>{g.targetKg} kg</b></span>
      </div>
      <div className="progress"><span style={{ width: `${pct * 100}%`, background: person.color }} /></div>
    </div>
  );
}

function BmiRow({ person, currentKg }: { person: EnrichedMember; currentKg: number | null }) {
  const bmi = bmiValue(currentKg, person.heightM);
  if (bmi == null) {
    return (
      <div className="row between">
        <span className="row" style={{ gap: 8 }}><Avatar size={22} color={person.color}>{person.initial}</Avatar>{person.name}</span>
        <span className="muted small">Add height in Profile to see BMI</span>
      </div>
    );
  }
  const cat = bmiCategory(bmi);
  // bmi != null guarantees a valid heightM, so healthyRange never returns null here.
  const [lo, hi] = healthyRange(person.heightM)!;
  const pos = Math.max(0, Math.min(100, ((bmi - 17) / (32 - 17)) * 100));
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row between">
        <span className="row" style={{ gap: 8 }}><Avatar size={22} color={person.color}>{person.initial}</Avatar>{person.name}</span>
        <span><b>{bmi}</b> <span className="muted small">{cat}</span></span>
      </div>
      {/* The marker lives inside the bar's own relative box (not a sibling)
          so its position is anchored directly to the 8px bar regardless of
          this column's gap — a sibling `height:0` marker container used to
          get pushed down by that gap, leaving the tick hanging below the
          bar instead of centered over it. */}
      <div className="bmi-bar" style={{ position: 'relative', height: 8, borderRadius: 4, background: 'linear-gradient(90deg,#7fb2e8 0 22%,#2aa897 22% 52%,#e69a3b 52% 78%,#e5786f 78% 100%)' }}>
        <span style={{ position: 'absolute', left: `${pos}%`, top: -3, transform: 'translateX(-50%)', width: 2, height: 14, background: 'var(--text)' }} />
      </div>
      <span className="muted small">Healthy band {lo}–{hi} kg</span>
    </div>
  );
}

interface WinsProps {
  dashboard: Dashboard;
  focusId: string;
  notes?: Nsv[];
  canAdd: boolean;
}

function Wins({ dashboard, focusId, notes, canAdd }: WinsProps) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Nsv | null>(null);
  const { run, busy, error } = useAddNsv();
  const { run: runDelete, busy: deleteBusy, error: deleteError } = useDeleteNsv();
  const save = async () => {
    if (!text.trim()) return;
    try {
      await run(dashboard.id, focusId, { date: todayISO(), text: text.trim() });
    } catch { return; }
    setText(''); setAdding(false);
  };
  const confirmDelete = async (target: Nsv) => {
    try {
      await runDelete(dashboard.id, target.id);
    } catch { return; }
    setDeleteTarget(null);
  };
  return (
    <div className="card">
      <div className="section-head" style={{ marginBottom: 12 }}>
        <span className="card-title">Wins this month</span>
        {canAdd && <button className="btn ghost sm" onClick={() => setAdding(true)}><Icon name="plus" color="var(--text-2)" />Add</button>}
      </div>
      {adding && canAdd && (
        <div className="col" style={{ gap: 6, marginBottom: 12 }}>
          <div className="nsv-compose">
            <span className="pill gray">{fmtDate(todayISO())}</span>
            <input className="input" placeholder="e.g. rings feel looser…" value={text} disabled={busy} autoFocus onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !busy && save()} />
            <button className="btn primary sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
          {error && <span className="small" style={{ color: 'var(--rose)' }}>{error}</span>}
        </div>
      )}
      {(!notes || notes.length === 0) && !adding
        ? <p className="muted small" style={{ margin: 0 }}>No wins logged yet — small non-scale wins keep you going.</p>
        : <div className="col" style={{ gap: 12 }}>
          {(notes || []).map((n) => (
            <div key={n.id} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <span className="muted small" style={{ width: 48, flex: 'none' }}>{fmtDate(n.date)}</span>
              <span className="small" style={{ flex: 1 }}>{n.text}</span>
              {canAdd && (
                <button className="icon-btn ghost-ib" title="Delete" aria-label="Delete this win" onClick={() => setDeleteTarget(n)}>
                  <Icon name="trash" size={14} color="var(--muted)" />
                </button>
              )}
            </div>
          ))}
        </div>}

      {deleteTarget && (
        <Confirm
          title="Delete this win?" message={`“${deleteTarget.text}” will be removed.`}
          confirmLabel="Delete" danger busy={deleteBusy} error={deleteError}
          onCancel={() => setDeleteTarget(null)} onConfirm={() => confirmDelete(deleteTarget)}
        />
      )}
    </div>
  );
}

function TeamGoal({ dashboard, series }: { dashboard: Dashboard; series: Record<string, SeriesPoint[]> }) {
  const tg = dashboard.teamGoal;
  if (!tg) return null;
  const lost = togetherChange(series, dashboard.trackedUids || []);
  const pct = tg.target ? Math.min(1, Math.max(0, lost / tg.target)) : 0;
  return (
    <div className="col" style={{ gap: 9 }}>
      <div className="row between">
        <span className="row" style={{ gap: 8, fontWeight: 600 }}><Icon name="target" color="var(--accent-dark)" />Team goal · {tg.label}</span>
        <span className="t2 small">{lost} / {tg.target} kg</span>
      </div>
      <div className="progress"><span style={{ width: `${pct * 100}%` }} /></div>
    </div>
  );
}

interface DashboardBodyProps {
  dashboard: Dashboard;
  series?: Record<string, SeriesPoint[]>;
  habitLogs?: Record<string, Record<string, HabitLog>>;
  nsv?: Record<string, Nsv[]>;
  // Null in the public read-only view, where there is no signed-in "me".
  meUid: string | null;
  readOnly?: boolean;
  onEditGoals?: () => void;
  profiles?: Record<string, Profile>;
}

export default function DashboardBody({ dashboard, series = {}, habitLogs = {}, nsv = {}, meUid, readOnly = false, onEditGoals = () => {}, profiles = {} }: DashboardBodyProps) {
  const quick = useQuickLog();
  const members = memberList(dashboard, profiles);
  const trackedMembers = members.filter((m) => (dashboard.trackedUids || []).includes(m.uid));
  const defaultFocus = trackedMembers.find((m) => m.uid === meUid)?.uid || trackedMembers[0]?.uid;
  const [focus, setFocus] = useState(defaultFocus);
  // Rendered stats run only after the hasAnyData early-return below, where at
  // least one tracked member exists, so a focus id is always resolved by then.
  const focusId = (trackedMembers.find((m) => m.uid === focus) ? focus : defaultFocus) as string;
  const focusPerson = trackedMembers.find((m) => m.uid === focusId) || members[0];

  const hasAnyData = trackedMembers.some((m) => (series[m.uid] || []).length > 0);

  if (!hasAnyData) {
    return (
      <>
        <div className="empty">
          <span className="empty-ic"><Icon name="scale" size={28} color="var(--accent-dark)" /></span>
          <h2>No weigh-ins yet</h2>
          <p className="t2">Add your first weigh-in to start the trend — it fills in from there.</p>
          {!readOnly && <button className="btn primary" onClick={() => quick.open()}><Icon name="plus" color="#fff" />Log my weight</button>}
        </div>
        <HabitsSection dashboard={dashboard} members={trackedMembers} logs={habitLogs} meUid={meUid ?? ''} readOnly={readOnly} />
      </>
    );
  }

  const focusEntries = series[focusId] || [];
  const g = goalFor(dashboard, series, focusId);
  const s = summarize(focusEntries, g);
  const days = spanDays(focusEntries);
  const state = computeState({ entries: focusEntries, goal: g });
  const away = STATUS[state].away;
  const dated = g.targetISO && g.targetKg != null;
  // Keep the raw verdict key (not just its label) so the tile/pill tone can
  // reflect what it actually means — "behind" must never render with the
  // same "good" styling as "ahead" (DEV-32).
  const verdictKey = dated && days >= 14
    ? verdictVsIdeal({ startKg: g.startKg, startISO: focusEntries[0]?.date, targetKg: g.targetKg, targetISO: g.targetISO, currentKg: (s.trend ?? s.current)! })
    : null;
  const verdict = verdictKey ? STATUS[verdictKey].label : null;
  const verdictTone = verdictKey === 'ahead' ? 'change-good' : verdictKey === 'behind' ? 'change-bad' : 'change-neutral';
  const ms = milestones(g.startKg ?? focusEntries[0]?.kg);
  const progress = milestoneProgress(g.startKg ?? focusEntries[0]?.kg, (s.trend ?? s.current)!);

  const chartPeople = trackedMembers.map((m) => ({ uid: m.uid, name: m.name, color: m.color }));

  return (
    <>
      <div className="row between person-focus" style={{ alignItems: 'center' }}>
        <span className="muted small">Showing {focusPerson?.name}’s stats, goal &amp; motivation</span>
        {trackedMembers.length > 1 && (
          <div className="seg">
            {trackedMembers.map((p) => (
              <button key={p.uid} className={focusId === p.uid ? 'on' : ''} onClick={() => setFocus(p.uid)}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: p.color, display: 'inline-block', marginRight: 6 }} />{p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <StatTiles s={s} days={days} proj={s.projection} verdict={verdict} verdictTone={verdictTone} away={away} hasGoal={g.targetKg != null} />

      <div className="content-2col">
        <div className="col" style={{ gap: 24 }}>
          <div className="card">
            <WeightChart people={chartPeople} series={series} focusId={focusId} goal={g} away={away} status={STATUS[state].label} enoughData={days >= 14} settings={dashboard.settings} />
          </div>
          <Progress s={s} days={days} proj={s.projection} verdict={verdict} verdictTone={verdictTone} away={away} hasGoal={g.targetKg != null} />
          <div className="card">
            <div className="section-head" style={{ marginBottom: 16 }}>
              <span className="card-title">Goals</span>
              {!readOnly && <button className="btn ghost sm" onClick={onEditGoals}><Icon name="edit" color="var(--text-2)" />Edit</button>}
            </div>
            <div className="col" style={{ gap: 18 }}>
              {trackedMembers.map((p) => <GoalRow key={p.uid} person={p} g={goalFor(dashboard, series, p.uid)} currentKg={currentWeight(series[p.uid] || [])} />)}
              {dashboard.teamGoal && <div className="divider" />}
              <TeamGoal dashboard={dashboard} series={series} />
            </div>
          </div>
        </div>

        <div className="col" style={{ gap: 24 }}>
          <MotivationCard person={focusPerson} state={state} milestone5={ms.m5} milestone10={ms.m10} progress={progress} />
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>BMI &amp; healthy range</div>
            <div className="col" style={{ gap: 18 }}>{trackedMembers.map((p) => <BmiRow key={p.uid} person={p} currentKg={currentWeight(series[p.uid] || [])} />)}</div>
          </div>
          <Wins dashboard={dashboard} focusId={focusId} notes={nsv[focusId]} canAdd={!readOnly && focusId === meUid} />
          <p className="disclaimer" style={{ textAlign: 'left' }}>Not medical advice. Healthy loss is 0.5–1.0 kg/week.</p>
        </div>
      </div>

      <HabitsSection dashboard={dashboard} members={trackedMembers} logs={habitLogs} meUid={meUid ?? ''} readOnly={readOnly} />
    </>
  );
}
