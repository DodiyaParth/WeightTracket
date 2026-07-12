import { useState } from 'react';
import Icon from './Icon.jsx';
import { Confirm } from './Modal.jsx';
import { useAsyncAction } from '../hooks/useAsyncAction.js';
import { useSetHabitMark, useUpdateDashboard } from '../hooks/mutations.js';
import { todayISO, addDays, isoToMs } from '../lib/date.js';
import { currentStreak, wasRepaired, gridDays, GRACE } from '../lib/habits.js';
import type { Dashboard, EnrichedMember, Habit, HabitLog, HabitMark } from '../types.js';

const DAYS = 28;

// Habit logs scoped to a single dashboard: uid -> habitId -> (date -> mark).
type DashboardLogs = Record<string, Record<string, HabitLog>>;

function dayLabel(offset: number): string {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Yesterday';
  const ms = isoToMs(addDays(todayISO(), -offset));
  return new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

interface ChecklistProps {
  dashboardId: string;
  habits: Habit[];
  logs: DashboardLogs;
  meUid: string;
  meName: string;
  readOnly: boolean;
  setHabitMark: (id: string, uid: string, habitId: string, date: string, value: HabitMark | 0 | null | undefined) => Promise<void>;
  onAddHabit: () => void;
  onRename: (id: string, label: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}

function Checklist({ dashboardId, habits, logs, meUid, meName, readOnly, setHabitMark, onAddHabit, onRename, onDelete }: ChecklistProps) {
  const [offset, setOffset] = useState(0);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [failedId, setFailedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Habit | null>(null);
  const { run: runEdit, busy: editBusy, error: editError } = useAsyncAction();
  const { run: runDelete, busy: deleteBusy, error: deleteError } = useAsyncAction();
  const date = addDays(todayISO(), -offset);
  const myLogs = logs[meUid] || {};
  const isDone = (h: Habit) => !!myLogs[h.id]?.[date];
  const count = habits.filter(isDone).length;

  const toggle = async (h: Habit) => {
    if (readOnly || pendingIds.has(h.id)) return;
    setPendingIds((s) => new Set(s).add(h.id));
    setFailedId(null);
    try {
      await setHabitMark(dashboardId, meUid, h.id, date, isDone(h) ? 0 : 1);
    } catch {
      setFailedId(h.id);
    } finally {
      setPendingIds((s) => { const n = new Set(s); n.delete(h.id); return n; });
    }
  };

  const startEdit = (h: Habit) => { setEditingId(h.id); setEditLabel(h.label); };
  const saveEdit = async () => {
    if (!editLabel.trim() || !editingId) { setEditingId(null); return; }
    try {
      await runEdit(() => onRename(editingId, editLabel.trim()));
    } catch { return; }
    setEditingId(null);
  };
  const confirmDelete = async (target: Habit) => {
    try {
      await runDelete(() => onDelete(target.id));
    } catch { return; }
    setDeleteTarget(null);
  };

  return (
    <div className="card">
      <div className="section-head" style={{ marginBottom: 6 }}>
        <span className="card-title">{readOnly ? `${meName}’s checklist` : 'My checklist'}</span>
        <span className="pill">{count}/{habits.length} done</span>
      </div>
      <div className="day-stepper">
        <button className="icon-btn ghost-ib" onClick={() => setOffset((o) => Math.min(DAYS - 1, o + 1))} aria-label="Previous day"><Icon name="chevronL" size={16} color="var(--text-2)" /></button>
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{dayLabel(offset)}</span>
        <button className="icon-btn ghost-ib" disabled={offset === 0} style={{ opacity: offset === 0 ? 0.35 : 1 }} onClick={() => setOffset((o) => Math.max(0, o - 1))} aria-label="Next day"><Icon name="chevron" size={16} color="var(--text-2)" /></button>
      </div>
      {habits.length === 0 && <p className="muted small" style={{ margin: '0 0 8px' }}>No habits yet — add the first thing you’ll do daily toward your goal.</p>}
      {habits.map((h) => {
        const done = isDone(h);
        const streak = currentStreak(myLogs[h.id] || {});
        const repaired = wasRepaired(myLogs[h.id] || {});
        const pending = pendingIds.has(h.id);
        const editing = editingId === h.id;
        return (
          <div key={h.id} className="col" style={{ gap: 2 }}>
            <div className="habit-row">
              {readOnly
                ? <span className={'habit-check' + (done ? ' on' : '')}>{done && <Icon name="check" size={16} color="#fff" />}</span>
                : <button className={'habit-check' + (done ? ' on' : '')} disabled={pending} onClick={() => toggle(h)} aria-label={h.label}>{done && <Icon name="check" size={16} color="#fff" />}</button>}
              <span style={{ fontSize: 18 }}>{h.emoji}</span>
              {editing ? (
                <input
                  className="input" style={{ flex: 1, padding: '4px 8px' }} value={editLabel} disabled={editBusy} autoFocus
                  onChange={(e) => setEditLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !editBusy) saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                  onBlur={saveEdit}
                />
              ) : (
                <span style={{ flex: 1, fontWeight: 500 }}>{h.label}</span>
              )}
              <span className="muted small">🔥 {streak} day{repaired ? ' · repaired' : ''}</span>
              {!readOnly && !editing && (
                <span className="row" style={{ gap: 2 }}>
                  <button className="icon-btn ghost-ib" title="Rename" aria-label={`Rename ${h.label}`} onClick={() => startEdit(h)}><Icon name="edit" size={14} color="var(--muted)" /></button>
                  <button className="icon-btn ghost-ib" title="Delete" aria-label={`Delete ${h.label}`} onClick={() => setDeleteTarget(h)}><Icon name="trash" size={14} color="var(--muted)" /></button>
                </span>
              )}
            </div>
            {failedId === h.id && <span className="small" style={{ color: 'var(--rose)', marginLeft: 40 }}>Couldn’t save — try again.</span>}
            {editing && editError && <span className="small" style={{ color: 'var(--rose)', marginLeft: 40 }}>{editError}</span>}
          </div>
        );
      })}
      {!readOnly && <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={onAddHabit}><Icon name="plus" color="var(--text-2)" />Add habit</button>}

      {deleteTarget && (
        <Confirm
          title="Delete this habit?" message={`“${deleteTarget.label}” and its streak history will be removed for everyone on this dashboard.`}
          confirmLabel="Delete" danger busy={deleteBusy} error={deleteError}
          onCancel={() => setDeleteTarget(null)} onConfirm={() => confirmDelete(deleteTarget)}
        />
      )}
    </div>
  );
}

interface StreakGridProps {
  members: EnrichedMember[];
  habits: Habit[];
  logs: DashboardLogs;
  meUid: string;
  readOnly: boolean;
  dashboardId: string;
  teamLabel?: string;
  setHabitMark: (id: string, uid: string, habitId: string, date: string, value: HabitMark | 0 | null | undefined) => Promise<void>;
}

function StreakGrid({ members, habits, logs, meUid, readOnly, dashboardId, teamLabel, setHabitMark }: StreakGridProps) {
  const [span, setSpan] = useState('Month');
  const [scope, setScope] = useState('all');
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const n = span === 'Week' ? 7 : DAYS;
  const days = gridDays(n);

  const cellKind = (h: Habit, date: string): string => {
    if (scope !== 'all') { const v = logs[scope]?.[h.id]?.[date]; return v === GRACE ? 'grace' : v ? 'both' : 'none'; }
    const vals = members.map((m) => logs[m.uid]?.[h.id]?.[date]);
    if (vals.some((v) => v === GRACE)) return 'grace';
    const done = vals.filter(Boolean).length;
    if (done === 0) return 'none';
    if (done === members.length) return 'both';
    return 'one';
  };
  const cls = (k: string) => 'streak-cell' + (k === 'both' ? ' on' : k === 'one' ? ' on l2' : k === 'grace' ? ' grace' : '');
  const canEdit = !readOnly && scope === meUid;
  const toggleCell = async (h: Habit, date: string) => {
    const key = `${h.id}_${date}`;
    if (!canEdit || pendingKey === key) return;
    setPendingKey(key);
    setFailedKey(null);
    const cur = logs[meUid]?.[h.id]?.[date];
    try {
      await setHabitMark(dashboardId, meUid, h.id, date, cur ? 0 : 1);
    } catch {
      setFailedKey(key);
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <div className="card">
      <div className="section-head" style={{ marginBottom: 14 }}>
        <span className="card-title">Streak grid</span>
        <div className="row" style={{ gap: 8 }}>
          <div className="seg">
            <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>All</button>
            {members.map((m) => <button key={m.uid} className={scope === m.uid ? 'on' : ''} onClick={() => setScope(m.uid)}>{m.name}</button>)}
          </div>
          <div className="range-tabs">{['Week', 'Month'].map((s) => <button key={s} className={span === s ? 'on' : ''} onClick={() => setSpan(s)}>{s}</button>)}</div>
        </div>
      </div>
      {canEdit && <p className="muted small" style={{ margin: '0 0 12px' }}>Tap a day to toggle — fix a missed check-off any time.</p>}
      {failedKey && <p className="small" style={{ color: 'var(--rose)', margin: '0 0 12px' }}>Couldn’t save that day — try again.</p>}
      {habits.length === 0 && <p className="muted small" style={{ margin: 0 }}>Add a habit to start building streaks toward {teamLabel ? `“${teamLabel}”` : 'your goal'}.</p>}
      <div className="col" style={{ gap: 16 }}>
        {habits.map((h) => {
          const streakUid = scope === 'all' ? meUid : scope;
          const repaired = wasRepaired(logs[streakUid]?.[h.id] || {});
          return (
            <div key={h.id} className="col" style={{ gap: 8 }}>
              <div className="row between">
                <span className="row" style={{ gap: 8 }}><span>{h.emoji}</span><span style={{ fontWeight: 500 }}>{h.label}</span></span>
                {repaired ? <span className="pill amber">streak repaired</span> : <span className="muted small">🔥 {currentStreak(logs[streakUid]?.[h.id] || {})} day streak</span>}
              </div>
              <div className="streak-grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
                {days.map((date) => {
                  const k = cellKind(h, date);
                  const key = `${h.id}_${date}`;
                  return canEdit
                    ? <button key={date} className={cls(k)} disabled={pendingKey === key} style={{ border: 0, padding: 0, cursor: 'pointer' }} onClick={() => toggleCell(h, date)} aria-label={date} />
                    : <span key={date} className={cls(k)} title={date} />;
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="row" style={{ gap: 14, marginTop: 16, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <span className="row muted small" style={{ gap: 6 }}><span className="streak-cell" style={{ width: 12, height: 12 }} />Missed</span>
        {scope === 'all' && members.length > 1 && <span className="row muted small" style={{ gap: 6 }}><span className="streak-cell on l2" style={{ width: 12, height: 12 }} />Some</span>}
        <span className="row muted small" style={{ gap: 6 }}><span className="streak-cell on" style={{ width: 12, height: 12 }} />{scope === 'all' && members.length > 1 ? 'Everyone' : 'Done'}</span>
        <span className="row muted small" style={{ gap: 6 }}><span className="streak-cell grace" style={{ width: 12, height: 12 }} />Grace day</span>
      </div>
    </div>
  );
}

interface HabitsSectionProps {
  dashboard: Dashboard;
  members: EnrichedMember[];
  logs: DashboardLogs;
  meUid: string;
  readOnly: boolean;
}

export default function HabitsSection({ dashboard, members, logs, meUid, readOnly }: HabitsSectionProps) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  // Independent mutation-hook instances (not shared) so add/rename/delete keep
  // the same independent busy/error tracking they had before this migration —
  // e.g. renaming a habit must not disable the unrelated "add habit" input.
  const { run, busy, error } = useUpdateDashboard();
  const { run: runUpdateHabit } = useUpdateDashboard();
  const { run: runSetHabitMark } = useSetHabitMark();
  const habits = dashboard.habits || [];
  const meName = members.find((m) => m.uid === meUid)?.name || 'You';

  const addHabit = async () => {
    if (!label.trim()) { setAdding(false); return; }
    const id = `h_${Math.random().toString(36).slice(2, 7)}`;
    try {
      await run(dashboard.id, { habits: [...habits, { id, label: label.trim(), emoji: '⭐' }] });
    } catch { return; }
    setLabel(''); setAdding(false);
  };
  const renameHabit = (id: string, newLabel: string) =>
    runUpdateHabit(dashboard.id, { habits: habits.map((h) => (h.id === id ? { ...h, label: newLabel } : h)) });
  const deleteHabit = (id: string) =>
    runUpdateHabit(dashboard.id, { habits: habits.filter((h) => h.id !== id) });

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row between">
        <span className="card-title">Daily habits</span>
        <span className="muted small">{dashboard.teamGoal?.label ? `The daily behaviors toward “${dashboard.teamGoal.label}”` : 'Daily behaviors toward your goal'}</span>
      </div>
      {adding && !readOnly && (
        <div className="col" style={{ gap: 6 }}>
          <div className="nsv-compose">
            <input className="input" placeholder="New habit — e.g. 10k steps" value={label} disabled={busy} autoFocus onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !busy && addHabit()} />
            <button className="btn primary sm" onClick={addHabit} disabled={busy}>{busy ? 'Adding…' : 'Add'}</button>
            <button className="btn ghost sm" onClick={() => { setAdding(false); setLabel(''); }} disabled={busy}>Cancel</button>
          </div>
          {error && <span className="small" style={{ color: 'var(--rose)' }}>{error}</span>}
        </div>
      )}
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Checklist
          dashboardId={dashboard.id} habits={habits} logs={logs} meUid={meUid} meName={meName} readOnly={readOnly} setHabitMark={runSetHabitMark}
          onAddHabit={() => setAdding(true)} onRename={renameHabit} onDelete={deleteHabit}
        />
        <StreakGrid members={members} habits={habits} logs={logs} meUid={meUid} readOnly={readOnly} dashboardId={dashboard.id} teamLabel={dashboard.teamGoal?.label} setHabitMark={runSetHabitMark} />
      </div>
    </div>
  );
}
