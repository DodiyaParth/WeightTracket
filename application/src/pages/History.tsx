import React, { useMemo, useState } from 'react';
import Layout from '../components/Layout.jsx';
import Icon from '../components/Icon.jsx';
import { Confirm } from '../components/Modal.jsx';
import { RetryCard, SegRadio } from '../components/ui.jsx';
import { useQuickLog } from '../components/QuickLog.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useWeights } from '../hooks/useData.js';
import { useAsyncAction } from '../hooks/useAsyncAction.js';
import { repo } from '../data/repo.js';
import { todayISO, fmtLong } from '../lib/date.js';
import { fmtKg } from '../lib/format.js';

const VIEW_OPTIONS = [['list', 'List'], ['calendar', 'Calendar']];

const monthKey = (dateIso) => dateIso.slice(0, 7);
const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const addMonths = (key, n) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

function ListView({ entries, onEdit, onDelete }) {
  const groups = useMemo(() => {
    const m = new Map();
    entries.forEach((e) => {
      const k = monthKey(e.date);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(e);
    });
    return Array.from(m.entries());
  }, [entries]);

  if (!entries.length) return <p className="muted small" style={{ margin: 0 }}>No entries yet — log your first weigh-in to see it here.</p>;

  return (
    <div className="col" style={{ gap: 22 }}>
      {groups.map(([key, rows]) => (
        <div key={key}>
          <div className="list-section-label" style={{ marginBottom: 6 }}>{monthLabel(key)}</div>
          <div className="entry-list">
            {rows.map((e) => (
              <div key={e.id} className="entry-row">
                <div className="col"><span style={{ fontWeight: 600 }}>{fmtKg(e.kg)} kg</span><span className="muted small">{fmtLong(e.date)}{e.note ? ` · ${e.note}` : ''}</span></div>
                <div className="row entry-actions">
                  <button className="icon-btn ghost-ib" title="Edit" aria-label={`Edit entry on ${fmtLong(e.date)}`} onClick={() => onEdit(e)}><Icon name="edit" size={16} color="var(--muted)" /></button>
                  <button className="icon-btn ghost-ib" title="Delete" aria-label={`Delete entry on ${fmtLong(e.date)}`} onClick={() => onDelete(e)}><Icon name="trash" size={16} color="var(--muted)" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarView({ byDate, month, onMonth, onDay }) {
  const [y, m] = month.split('-').map(Number);
  const startWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  const today = todayISO();
  const atCurrentMonth = month >= monthKey(today);

  return (
    <div>
      <div className="row between" style={{ marginBottom: 12 }}>
        <button className="icon-btn ghost-ib" aria-label="Previous month" onClick={() => onMonth(addMonths(month, -1))}><Icon name="chevronL" size={16} color="var(--text-2)" /></button>
        <span style={{ fontWeight: 600 }}>{monthLabel(month)}</span>
        <button className="icon-btn ghost-ib" aria-label="Next month" disabled={atCurrentMonth} onClick={() => onMonth(addMonths(month, 1))}><Icon name="chevron" size={16} color="var(--text-2)" /></button>
      </div>
      <div className="cal-grid" role="grid" aria-label={monthLabel(month)}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="muted small" style={{ textAlign: 'center' }} aria-hidden="true">{d[0]}</div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`} />;
          const e = byDate.get(date);
          const future = date > today;
          const label = e ? `${fmtLong(date)}, ${fmtKg(e.kg)} kg — edit` : `${fmtLong(date)} — add a weigh-in`;
          return (
            <button key={date} className={'cal-day' + (e ? ' has-entry' : '')} disabled={future} aria-label={label} onClick={() => onDay(date, e)}>
              <span className="cal-daynum">{Number(date.slice(-2))}</span>
              {e && <span className="cal-kg">{fmtKg(e.kg)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function History() {
  const { user } = useAuth();
  const { data: entries, loading, error, reload } = useWeights(user?.uid);
  const quick = useQuickLog();
  const [view, setView] = useState('list');
  const [month, setMonth] = useState(() => monthKey(todayISO()));
  const [del, setDel] = useState(null);
  const { run: runDelete, busy: deleting, error: deleteError } = useAsyncAction();

  const byDate = useMemo(() => new Map((entries || []).map((e) => [e.date, e])), [entries]);
  const confirmDelete = async () => {
    try { await runDelete(() => repo.deleteWeight(user.uid, del.id)); } catch { return; }
    setDel(null);
  };

  return (
    <Layout title="History" sub="Your full weigh-in history — browse, edit, or fill in a missed day" primary={null}>
      <div className="row between">
        <SegRadio value={view} onChange={setView} options={VIEW_OPTIONS} ariaLabel="History view" />
      </div>

      {loading && !entries && <div className="skel" style={{ height: 200, borderRadius: 12 }} />}

      {!loading && error && (
        <RetryCard title="Couldn’t load your history" message="Check your connection and try again." onRetry={reload} />
      )}

      {!loading && !error && (
        <div className="card">
          {view === 'list'
            ? <ListView entries={entries || []} onEdit={(e) => quick.open(e)} onDelete={setDel} />
            : <CalendarView byDate={byDate} month={month} onMonth={setMonth} onDay={(date, e) => quick.open(e || { date })} />}
        </div>
      )}

      {del && (
        <Confirm
          title="Delete this entry?"
          message={`${fmtKg(del.kg)} kg on ${fmtLong(del.date)} will be removed from your history. This can’t be undone.`}
          confirmLabel="Delete" danger busy={deleting} error={deleteError}
          onCancel={() => setDel(null)} onConfirm={confirmDelete}
        />
      )}
    </Layout>
  );
}
