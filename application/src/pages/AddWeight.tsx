import { useState, useMemo, useEffect, useRef, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Icon from '../components/Icon.jsx';
import Modal, { Confirm } from '../components/Modal.jsx';
import { Toast } from '../components/ui.jsx';
import { useQuickLog } from '../components/QuickLog.jsx';
import { useAuthedUser } from '../auth/useAuthedUser.js';
import { useWeights } from '../hooks/useData.js';
import { useAddWeight, useAddWeights, useDeleteWeight } from '../hooks/mutations.js';
import { todayISO, addDays, fmtLong, fmtDate, DATE_FORMATS, parseDate } from '../lib/date.js';
import { parseCsv, detectColumns, suggestDateFormat, buildImport, parseWeightValue, TEMPLATE_CSV, type DetectedColumns } from '../lib/csv.js';
import { fmtKg } from '../lib/format.js';
import { classifyEntries } from '../lib/collisions.js';
import type { WeightEntry } from '../types.js';

type IncomingEntry = { date: string; kg: number; note?: string };
type ImportOutcome = { saved: number; skipped: number };
interface Batch {
  savedFresh: number;
  unchanged: Array<IncomingEntry & { prevKg: number }>;
  conflicting: Array<IncomingEntry & { prevKg: number }>;
  onDone: (r: ImportOutcome) => void;
}

// Shared by Bulk + CSV: saves the non-colliding rows immediately, then — if any
// dates collide with existing history — surfaces ONE clubbed dialog to decide
// what happens to the rest (DEV-11, user spec point 2).
function useBatchImport(uid: string, existing: WeightEntry[]) {
  const [batch, setBatch] = useState<Batch | null>(null);
  const { run, busy, error } = useAddWeights();

  const start = async (incoming: IncomingEntry[], onDone: (r: ImportOutcome) => void) => {
    const { fresh, unchanged, conflicting } = classifyEntries(incoming, existing);
    let savedFresh = 0;
    try {
      if (fresh.length) savedFresh = await run(uid, fresh);
    } catch { return; }
    if (unchanged.length || conflicting.length) setBatch({ savedFresh, unchanged, conflicting, onDone });
    else onDone({ saved: savedFresh, skipped: 0 });
  };
  const overwrite = async () => {
    if (busy || !batch) return;
    const b = batch;
    try {
      await run(uid, b.conflicting);
    } catch { return; }
    b.onDone({ saved: b.savedFresh + b.conflicting.length, skipped: b.unchanged.length });
    setBatch(null);
  };
  const skip = () => {
    if (busy || !batch) return;
    batch.onDone({ saved: batch.savedFresh, skipped: batch.unchanged.length + batch.conflicting.length });
    setBatch(null);
  };

  return { batch, start, overwrite, skip, busy, error };
}

interface BatchCollisionDialogProps {
  batch: Batch | null;
  busy: boolean;
  error: string | null;
  onOverwrite: () => void;
  onSkip: () => void;
}

function BatchCollisionDialog({ batch, busy, error, onOverwrite, onSkip }: BatchCollisionDialogProps) {
  if (!batch) return null;
  const { savedFresh, unchanged, conflicting } = batch;
  const parts: string[] = [];
  if (savedFresh) parts.push(`${savedFresh} new ${savedFresh === 1 ? 'entry' : 'entries'} saved`);
  if (unchanged.length) parts.push(`${unchanged.length} already logged with the same weight (skipped)`);
  if (conflicting.length) parts.push(`${conflicting.length} ${conflicting.length === 1 ? 'has' : 'have'} a different weight on file`);
  return (
    <Modal title="Some dates already have an entry" onClose={onSkip} busy={busy}
      footer={conflicting.length > 0 ? (
        <>
          <button className="btn" onClick={onSkip} disabled={busy}>Skip {conflicting.length === 1 ? 'it' : 'them'}</button>
          <button className="btn primary" onClick={onOverwrite} disabled={busy}>{busy ? 'Saving…' : `Overwrite ${conflicting.length}`}</button>
        </>
      ) : (
        <button className="btn primary" onClick={onSkip} disabled={busy}>OK</button>
      )}
    >
      <p className="t2 small" style={{ marginTop: 0, lineHeight: 1.6 }}>{parts.join('. ')}.</p>
      {conflicting.length > 0 && (
        <div className="col" style={{ gap: 6, marginTop: 8 }}>
          {conflicting.slice(0, 5).map((e) => (
            <div key={e.date} className="row between small muted">
              <span>{fmtLong(e.date)}</span><span>{fmtKg(e.prevKg)} kg → {fmtKg(e.kg)} kg</span>
            </div>
          ))}
          {conflicting.length > 5 && <span className="small muted">+{conflicting.length - 5} more</span>}
        </div>
      )}
      {error && <p className="small" style={{ color: 'var(--rose)', marginTop: 10 }}>{error}</p>}
    </Modal>
  );
}

interface TabProps {
  uid: string;
  existing: WeightEntry[];
  onToast: (m: string) => void;
}

function Single({ uid, existing, onToast }: TabProps) {
  const [kg, setKg] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [info, setInfo] = useState<{ kg: number; again: boolean } | null>(null);
  const [conflict, setConflict] = useState<{ kg: number; prevKg: number; again: boolean } | null>(null);
  const { run, busy, error } = useAddWeight();

  const doSave = async (v: number, again: boolean) => {
    try {
      await run(uid, { date, kg: v, note });
    } catch { return; }
    onToast(`Logged ${fmtKg(v)} kg · ${fmtLong(date)}`);
    setKg(''); setNote('');
    if (!again) setDate(todayISO());
  };

  const save = async (again: boolean) => {
    const v = parseWeightValue(kg);
    if (!v || Number.isNaN(v)) return;
    const { unchanged, conflicting } = classifyEntries([{ date, kg: v }], existing);
    if (unchanged.length) { setInfo({ kg: v, again }); return; }
    if (conflicting.length) { setConflict({ kg: v, prevKg: conflicting[0].prevKg, again }); return; }
    await doSave(v, again);
  };

  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 4 }}>Add a weigh-in</div>
      <p className="t2 small" style={{ marginTop: 0 }}>For a single date — back-date by changing the date below.</p>
      <div className="col" style={{ gap: 16, marginTop: 8 }}>
        <div>
          <label className="field-label">Weight (kg)</label>
          <div style={{ position: 'relative' }}>
            <input className="input num-hero" inputMode="decimal" placeholder="83.2" value={kg} disabled={busy} onChange={(e) => setKg(e.target.value)} style={{ padding: '16px 14px' }} />
            <span className="muted" style={{ position: 'absolute', right: 16, top: 24 }}>kg</span>
          </div>
        </div>
        <div>
          <label className="field-label">Date</label>
          <input className="input" type="date" max={todayISO()} value={date} disabled={busy} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Note (optional)</label>
          <input className="input" placeholder="e.g. morning, after travel…" value={note} disabled={busy} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="tip"><Icon name="bell" size={18} color="var(--accent-dark)" />Weigh first thing in the morning, after the toilet, same conditions — for consistent data.</div>
        {error && <p className="small" style={{ color: 'var(--rose)', margin: 0 }}>{error}</p>}
        <div className="row" style={{ gap: 10 }}>
          <button className="btn primary" onClick={() => save(false)} disabled={busy}><Icon name="check" color="#fff" />{busy ? 'Saving…' : 'Save entry'}</button>
          <button className="btn" onClick={() => save(true)} disabled={busy}>Save &amp; add another</button>
        </div>
      </div>

      {info && (
        <Confirm
          title="Already logged" message={`You already logged ${fmtKg(info.kg)} kg for ${fmtLong(date)}.`}
          confirmLabel="OK" onCancel={() => setInfo(null)} onConfirm={() => setInfo(null)}
        />
      )}
      {conflict && (
        <Confirm
          title="Overwrite this entry?"
          message={`An entry for ${fmtLong(date)} already exists (${fmtKg(conflict.prevKg)} kg). Overwrite it with ${fmtKg(conflict.kg)} kg?`}
          confirmLabel="Overwrite" busy={busy} error={error}
          onCancel={() => setConflict(null)} onConfirm={() => { const c = conflict; setConflict(null); doSave(c.kg, c.again); }}
        />
      )}
    </div>
  );
}

interface Row { id: string; date: string; kg: string; note: string; }

function Bulk({ uid, existing, onToast }: TabProps) {
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 7 }, (_, i) => ({ id: `r${i}`, date: addDays(todayISO(), -i), kg: '', note: '' })));
  const { batch, start, overwrite, skip, busy, error } = useBatchImport(uid, existing);
  const setRow = (id: string, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const weightOf = (r: Row) => parseWeightValue(r.kg);
  const filled = rows.filter((r) => r.kg && !Number.isNaN(weightOf(r)));
  const invalidCount = rows.filter((r) => r.kg && Number.isNaN(weightOf(r))).length;

  // Pre-fill any row whose date already has a logged weight — so backfilling
  // shows what's already there instead of a blank box you'd otherwise
  // overwrite (or skip) without knowing. Runs once existing weights have
  // loaded, and only touches rows the user hasn't already typed into.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !existing.length) return;
    prefilled.current = true;
    const byDate = new Map(existing.map((e): [string, WeightEntry] => [e.date, e]));
    setRows((rs) => rs.map((r) => {
      if (r.kg) return r;
      const e = byDate.get(r.date);
      return e ? { ...r, kg: String(e.kg), note: r.note || e.note || '' } : r;
    }));
  }, [existing]);
  const save = () => {
    if (!filled.length) return;
    start(filled.map((r) => ({ date: r.date, kg: weightOf(r), note: r.note })), ({ saved, skipped }) => {
      onToast(`Saved ${saved} ${saved === 1 ? 'entry' : 'entries'}${skipped ? ` · ${skipped} skipped` : ''}`);
      setRows((r) => r.map((x) => ({ ...x, kg: '', note: '' })));
    });
  };
  return (
    <div className="card">
      <div className="card-title">Backfill past entries</div>
      <p className="t2 small" style={{ marginTop: 4 }}>Catch up on the last week or two of your own weigh-ins. Leave blanks for missed days — gaps are fine.</p>
      <div className="tbl-wrap">
        <table className="tbl" style={{ marginTop: 8 }}>
          <thead><tr><th>Date</th><th>Weight (kg)</th><th>Note</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const invalid = !!r.kg && Number.isNaN(weightOf(r));
              return (
                <tr key={r.id}>
                  <td style={{ width: 130 }}>{fmtLong(r.date)}</td>
                  <td style={{ width: 150 }}>
                    <input className="input" inputMode="decimal" placeholder="—" value={r.kg} disabled={busy}
                      style={invalid ? { borderColor: 'var(--rose)' } : undefined}
                      aria-invalid={invalid} onChange={(e) => setRow(r.id, { kg: e.target.value })} />
                    {invalid && <span className="small" style={{ color: 'var(--rose)' }}>Not a number</span>}
                  </td>
                  <td><input className="input" placeholder="—" value={r.note} disabled={busy} onChange={(e) => setRow(r.id, { note: e.target.value })} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {invalidCount > 0 && <p className="small" style={{ color: 'var(--rose)', marginTop: 8 }}>{invalidCount} row{invalidCount > 1 ? 's' : ''} won’t be saved — fix the highlighted weight{invalidCount > 1 ? 's' : ''}.</p>}
      <div className="row" style={{ gap: 10, marginTop: 16 }}>
        <button className="btn ghost" disabled={busy} onClick={() => setRows((r) => {
          const date = addDays(r[r.length - 1].date, -1);
          const e = existing.find((x) => x.date === date);
          return [...r, { id: `r${Date.now()}`, date, kg: e ? String(e.kg) : '', note: e?.note || '' }];
        })}><Icon name="plus" color="var(--text-2)" />Add row</button>
        <div style={{ flex: 1 }} />
        <button className="btn primary" onClick={save} disabled={!filled.length || busy}>{busy ? 'Saving…' : `Save ${filled.length || ''} ${filled.length === 1 ? 'entry' : 'entries'}`}</button>
      </div>
      <BatchCollisionDialog batch={batch} busy={busy} error={error} onOverwrite={overwrite} onSkip={skip} />
    </div>
  );
}

function Csv({ uid, existing, onToast }: TabProps) {
  const [raw, setRaw] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [fmtOverride, setFmtOverride] = useState<string | null>(null);
  const [colOverride, setColOverride] = useState<DetectedColumns | null>(null);
  const { batch, start, overwrite, skip, busy, error } = useBatchImport(uid, existing);

  const parsed = useMemo(() => (raw ? parseCsv(raw) : null), [raw]);
  const detectedCols = useMemo(() => (parsed ? detectColumns(parsed.header, parsed.rows) : null), [parsed]);
  const cols = colOverride || detectedCols;
  const sameCol = cols && cols.dateIdx === cols.weightIdx;
  const detectedFmt = useMemo(() => (parsed && cols ? suggestDateFormat(parsed.rows, cols.dateIdx) : 'iso'), [parsed, cols]);
  const fmt = fmtOverride || detectedFmt;
  const result = useMemo(() => (parsed && cols && !sameCol ? buildImport(parsed.rows, { ...cols, fmt }) : null), [parsed, cols, fmt, sameCol]);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setFmtOverride(null);
    setColOverride(null);
    setRaw(await f.text());
  };
  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'weighttracker-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };
  const doImport = () => {
    if (!result?.entries.length) return;
    start(result.entries, ({ saved, skipped }) => {
      onToast(`Imported ${saved} ${saved === 1 ? 'entry' : 'entries'}${skipped ? ` · ${skipped} skipped` : ''}`);
      setRaw(null); setFileName('');
    });
  };

  if (!raw) {
    return (
      <div className="card">
        <div className="card-title">Import from CSV</div>
        <p className="t2 small" style={{ marginTop: 4 }}>Bring in months of history at once — your own weight only.</p>
        <label className="dropzone" style={{ marginTop: 8, cursor: 'pointer', display: 'block' }}>
          <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
          <Icon name="upload" size={28} color="var(--muted)" />
          <div style={{ marginTop: 10, fontWeight: 600, color: 'var(--text)' }}>Drop your CSV here</div>
          <div className="small">or <span style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>browse files</span></div>
          <div className="small muted" style={{ marginTop: 10 }}>Needs a <b>date</b> column and a <b>weight (kg)</b> column. Any date format works — other columns are ignored.</div>
        </label>
        <div className="row between" style={{ marginTop: 16 }}><span className="field-label" style={{ margin: 0 }}>Example</span><button className="btn ghost sm" onClick={downloadTemplate}><Icon name="upload" size={16} color="var(--text-2)" />Download template</button></div>
        <div className="ex-table" style={{ marginTop: 8 }}>
          <div className="r head"><div className="c">date</div><div className="c">weight_kg</div></div>
          <div className="r"><div className="c">2026-06-30</div><div className="c">83.3</div></div>
          <div className="r"><div className="c">2026-06-29</div><div className="c">83.6</div></div>
        </div>
      </div>
    );
  }

  if (!parsed || !cols) return null;

  const preview = sameCol ? [] : parsed.rows.slice(0, 6).map((r) => {
    const rawDate = r[cols.dateIdx];
    const date = parseDate(rawDate, fmt);
    const kgNum = parseWeightValue(r[cols.weightIdx]);
    const okKg = !Number.isNaN(kgNum) && kgNum >= 20 && kgNum <= 400;
    const reason = !date ? 'can’t parse date' : !okKg ? 'invalid weight' : null;
    return { rawDate, date, kg: okKg ? +kgNum.toFixed(2) : null, ok: !!date && okKg, reason };
  });

  return (
    <div className="card">
      <div className="section-head"><span className="card-title">Review import</span><button className="btn ghost sm" onClick={() => { setRaw(null); setFileName(''); }}><Icon name="close" size={16} color="var(--text-2)" />Replace file</button></div>
      <div className="csv-file" style={{ marginTop: 12 }}><Icon name="upload" color="var(--accent-dark)" /><div className="grow"><div className="name">{fileName}</div><div className="muted small">{parsed.rows.length} rows detected</div></div><span className="pill">Auto-detected</span></div>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div>
          <label className="field-label">Date column</label>
          <select className="input" value={cols.dateIdx} onChange={(e) => setColOverride({ dateIdx: +e.target.value, weightIdx: cols.weightIdx })}>
            {parsed.header.map((h, i) => <option key={i} value={i}>{h}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Weight column</label>
          <select className="input" value={cols.weightIdx} onChange={(e) => setColOverride({ dateIdx: cols.dateIdx, weightIdx: +e.target.value })}>
            {parsed.header.map((h, i) => <option key={i} value={i}>{h}</option>)}
          </select>
        </div>
      </div>
      {sameCol && <div className="row-warn" style={{ marginTop: 12 }}><Icon name="warn" size={16} color="#b9742a" />Pick different columns for date and weight.</div>}
      {!sameCol && result && (
        <>
          <label className="field-label" style={{ marginTop: 16 }}>Date format <span className="muted" style={{ fontWeight: 400 }}>· detected {labelFor(detectedFmt)} — confirm or override</span></label>
          <div className="fmt-opts">{DATE_FORMATS.map(([k, l]) => (<button key={k} className={'toggle' + (fmt === k ? ' on' : '')} onClick={() => setFmtOverride(k)}><span style={{ width: 8, height: 8, borderRadius: 8, background: fmt === k ? 'var(--accent)' : 'var(--muted)' }} />{l}</button>))}</div>
          <label className="field-label" style={{ marginTop: 18 }}>Preview · first rows</label>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>From file</th><th>Date</th><th>Weight</th><th /></tr></thead>
              <tbody>{preview.map((r, i) => (
                <tr key={i} className={r.ok ? '' : 'bad'}>
                  <td className="muted">{r.rawDate}</td>
                  <td>{r.date ? fmtLong(r.date) : '—'}</td>
                  <td>{r.kg != null ? `${fmtKg(r.kg)} kg` : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{r.ok ? <Icon name="check" size={16} color="var(--accent)" /> : <span className="pill amber">{r.reason}</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {result.duplicates > 0 && <div className="row-warn" style={{ marginTop: 12 }}><Icon name="warn" size={16} color="#b9742a" />{result.duplicates} repeated date{result.duplicates > 1 ? 's were' : ' was'} merged — the last value in the file wins.</div>}
          {result.bad.length > 0 && <div className="row-warn" style={{ marginTop: 12 }}><Icon name="warn" size={16} color="#b9742a" />{result.bad.length} row{result.bad.length > 1 ? 's' : ''} couldn’t be imported. Fix the file or change the date format above.</div>}
          {error && <p className="small" style={{ color: 'var(--rose)', marginTop: 12 }}>{error}</p>}
          <div className="row" style={{ marginTop: 16, alignItems: 'center' }}><span className="muted small">{result.total} rows · {result.ready} ready · {result.bad.length} need attention</span><div style={{ flex: 1 }} /><button className="btn primary" onClick={doImport} disabled={!result.ready || busy}>{busy ? 'Importing…' : `Import ${result.ready} entries`}</button></div>
        </>
      )}
      <BatchCollisionDialog batch={batch} busy={busy} error={error} onOverwrite={overwrite} onSkip={skip} />
    </div>
  );
}

const labelFor = (k: string) => (DATE_FORMATS.find(([key]) => key === k) || [, k])[1];

export default function AddWeight() {
  const user = useAuthedUser();
  const { data: entries } = useWeights(user.uid);
  const [tab, setTab] = useState('single');
  const [del, setDel] = useState<WeightEntry | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const quick = useQuickLog();
  const { run: runDelete, busy: deleting, error: deleteError } = useDeleteWeight();
  const onToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };
  const confirmDelete = async (entry: WeightEntry) => {
    try { await runDelete(user.uid, entry.id); } catch { return; }
    setDel(null);
    onToast('Entry deleted');
  };

  return (
    <Layout title="Log a weigh-in" sub="Your own weight · single entry, backfill, or CSV import" primary={null}>
      <div className="tabs">
        {[['single', 'Single entry'], ['bulk', 'Bulk backfill'], ['csv', 'CSV import']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div className="addweight-grid">
        <div>
          {tab === 'single' && <Single uid={user.uid} existing={entries || []} onToast={onToast} />}
          {tab === 'bulk' && <Bulk uid={user.uid} existing={entries || []} onToast={onToast} />}
          {tab === 'csv' && <Csv uid={user.uid} existing={entries || []} onToast={onToast} />}
        </div>
        <div className="card" style={{ alignSelf: 'start' }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <span className="card-title">Recent entries</span>
            <Link to="/history" className="small" style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>View all</Link>
          </div>
          <div className="entry-list">
            {(entries || []).slice(0, 8).map((e) => (
              <div key={e.id} className="entry-row">
                <div className="col"><span style={{ fontWeight: 600 }}>{fmtKg(e.kg)} kg</span><span className="muted small">{fmtDate(e.date)}{e.note ? ` · ${e.note}` : ''}</span></div>
                <div className="row entry-actions">
                  <button className="icon-btn ghost-ib" title="Edit" aria-label={`Edit entry on ${fmtDate(e.date)}`} onClick={() => quick.open(e)}><Icon name="edit" size={16} color="var(--muted)" /></button>
                  <button className="icon-btn ghost-ib" title="Delete" aria-label={`Delete entry on ${fmtDate(e.date)}`} onClick={() => setDel(e)}><Icon name="trash" size={16} color="var(--muted)" /></button>
                </div>
              </div>
            ))}
            {(!entries || entries.length === 0) && <p className="muted small" style={{ margin: 0 }}>No entries yet — add your first above.</p>}
          </div>
        </div>
      </div>
      {del && (
        <Confirm
          title="Delete this entry?"
          message={`${fmtKg(del.kg)} kg on ${fmtLong(del.date)} will be removed from your history. This can’t be undone.`}
          confirmLabel="Delete" danger busy={deleting} error={deleteError}
          onCancel={() => setDel(null)} onConfirm={() => confirmDelete(del)}
        />
      )}
      {toast && <Toast>{toast}</Toast>}
    </Layout>
  );
}
