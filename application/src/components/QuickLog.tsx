import React, { createContext, useContext, useState, useRef, useEffect, useId, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Toast } from './ui.jsx';
import { useDialogA11y, Confirm } from './Modal.jsx';
import { useAuthedUser } from '../auth/useAuthedUser.js';
import { useWeights } from '../hooks/useData.js';
import { useAddWeight, useUpdateWeight, useDeleteWeight } from '../hooks/mutations.js';
import { todayISO, addDays, fmtLong } from '../lib/date.js';
import { fmtKg } from '../lib/format.js';
import { classifyEntries } from '../lib/collisions.js';
import type { WeightEntry } from '../types.js';

// What the modal can be opened with: a full entry (edit) or just a `date`
// (prefill the add form for a specific day) — hence Partial.
type QuickLogEntry = Partial<WeightEntry> | null;

interface QuickLogContextValue {
  open: (entry?: QuickLogEntry) => void;
}

const Ctx = createContext<QuickLogContextValue>({ open: () => {} });
export const useQuickLog = () => useContext(Ctx);

interface QuickLogModalProps {
  entry?: QuickLogEntry;
  uid: string;
  lastKg: number | null;
  weights?: WeightEntry[] | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

function QuickLogModal({ entry, uid, lastKg, weights, onClose, onSaved }: QuickLogModalProps) {
  const nav = useNavigate();
  // `entry` may carry just a `date` (no id) to open the "add" form prefilled
  // to a specific day — e.g. tapping an empty day in the History calendar —
  // without that being mistaken for editing an existing entry.
  const editing = !!entry?.id;
  const entryId = entry?.id;
  const [weight, setWeight] = useState(editing ? String(entry?.kg) : lastKg != null ? String(lastKg) : '70.00');
  const [date, setDate] = useState(entry?.date || todayISO());
  const [note, setNote] = useState(entry?.note || '');
  const [showNote, setShowNote] = useState(!!entry?.note);
  const [info, setInfo] = useState<{ kg: number; prevKg?: number } | null>(null);
  const [conflict, setConflict] = useState<{ kg: number; prevKg: number } | null>(null);
  const { run: runAdd, busy: addBusy, error: addError } = useAddWeight();
  const { run: runUpdate, busy: updateBusy, error: updateError } = useUpdateWeight();
  const { run: runDelete, busy: deleteBusy, error: deleteError } = useDeleteWeight();
  // Only one of add/update/delete is ever in flight at once from this modal,
  // so combining their busy/error is equivalent to a single shared action state.
  const busy = addBusy || updateBusy || deleteBusy;
  const error = addError || updateError || deleteError;
  const weightRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useDialogA11y(modalRef, onClose, { skipInitialFocus: true });
  useEffect(() => {
    const t = setTimeout(() => { weightRef.current?.focus(); weightRef.current?.select(); }, 30);
    return () => clearTimeout(t);
  }, []);

  const step = (d: number) => setWeight((w) => Math.max(0, (parseFloat(w) || 0) + d).toFixed(2));
  const chips = [['Today', todayISO()], ['Yesterday', addDays(todayISO(), -1)], ['2 days ago', addDays(todayISO(), -2)]];

  const doSave = async (kg: number) => {
    try {
      await (entryId ? runUpdate(uid, entryId, { kg, note, date }) : runAdd(uid, { date, kg, note }));
    } catch { return; }
    onSaved(`${editing ? 'Updated' : 'Logged'} ${fmtKg(kg)} kg · ${fmtLong(date)}`);
    onClose();
  };

  const save = async () => {
    if (busy) return;
    const kg = +parseFloat(weight);
    if (!kg || Number.isNaN(kg)) return;
    if (!editing) {
      const { unchanged, conflicting } = classifyEntries([{ date, kg }], weights || []);
      if (unchanged.length) { setInfo({ kg, prevKg: unchanged[0].prevKg }); return; }
      if (conflicting.length) { setConflict({ kg, prevKg: conflicting[0].prevKg }); return; }
    }
    await doSave(kg);
  };
  const del = async () => {
    if (busy || !entryId) return;
    try { await runDelete(uid, entryId); } catch { return; }
    onSaved('Entry deleted');
    onClose();
  };
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !busy) save(); };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="modal quicklog" ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
        style={{ width: 420 }} onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div className="card-title" id={titleId}>{editing ? 'Edit entry' : 'Log my weight'}</div>
          <button className="icon-btn ghost-ib" onClick={onClose} aria-label="Close"><Icon name="close" color="var(--muted)" /></button>
        </div>

        <div className="modal-body" style={{ paddingTop: 6 }}>
          <div className="weigh-input">
            <button className="step" onClick={() => step(-0.1)} disabled={busy} aria-label="minus 0.1"><Icon name="minus" size={20} color="var(--text-2)" /></button>
            <div className="weigh-field">
              <input ref={weightRef} inputMode="decimal" value={weight} disabled={busy} onChange={(e) => setWeight(e.target.value)} onKeyDown={onKey} onBlur={() => setWeight((+weight || 0).toFixed(2))} aria-label="Weight in kg" />
              <span className="unit">kg</span>
            </div>
            <button className="step" onClick={() => step(0.1)} disabled={busy} aria-label="plus 0.1"><Icon name="plus" size={20} color="var(--text-2)" /></button>
          </div>

          <div className="row" role="radiogroup" aria-label="Quick date" style={{ gap: 8, marginTop: 18, justifyContent: 'center', flexWrap: 'wrap' }}>
            {chips.map(([label, iso]) => (
              <button key={label} role="radio" aria-checked={date === iso} className={'date-chip' + (date === iso ? ' on' : '')} disabled={busy} onClick={() => setDate(iso)}>{label}</button>
            ))}
            <label className="date-chip" title="Pick a date" style={{ position: 'relative' }}>
              <Icon name="calendar" size={16} color="var(--text-2)" />
              <input type="date" value={date} max={todayISO()} disabled={busy} onChange={(e) => e.target.value && setDate(e.target.value)}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} aria-label="Pick a date" />
            </label>
          </div>
          <p className="muted small" style={{ textAlign: 'center', margin: '10px 0 0' }}>{fmtLong(date)}</p>

          {showNote ? (
            <input className="input" style={{ marginTop: 14 }} placeholder="Note (optional) — e.g. after travel" value={note} disabled={busy} onChange={(e) => setNote(e.target.value)} />
          ) : (
            <button className="btn ghost sm" style={{ marginTop: 12, alignSelf: 'center' }} disabled={busy} onClick={() => setShowNote(true)}><Icon name="plus" size={15} color="var(--text-2)" />Add note</button>
          )}

          {error && <p className="small" style={{ color: 'var(--rose)', textAlign: 'center', margin: '10px 0 0' }}>{error}</p>}
        </div>

        <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
          {editing ? (
            <button className="btn ghost sm" style={{ color: '#d6463c' }} onClick={del} disabled={busy}><Icon name="trash" size={16} color="#d6463c" />Delete</button>
          ) : (
            <button className="btn ghost sm" onClick={() => { onClose(); nav('/add'); }} disabled={busy}>Advanced (bulk · CSV)</button>
          )}
          <button className="btn primary" onClick={save} disabled={busy}><Icon name="check" color="#fff" />{busy ? 'Saving…' : 'Save'}</button>
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
          onCancel={() => setConflict(null)} onConfirm={() => doSave(conflict.kg)}
        />
      )}
    </div>
  );
}

export function QuickLogProvider({ children }: { children: ReactNode }) {
  const user = useAuthedUser();
  const { data: weights } = useWeights(user.uid);
  const [state, setState] = useState<{ entry?: QuickLogEntry } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const open = (e?: QuickLogEntry) => setState({ entry: e });
  const onSaved = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2600); };
  const lastKg = weights && weights.length ? weights[0].kg : null;

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {state && (
        <QuickLogModal entry={state.entry} uid={user.uid} lastKg={lastKg} weights={weights} onClose={() => setState(null)} onSaved={onSaved} />
      )}
      {toast && <Toast>{toast}</Toast>}
    </Ctx.Provider>
  );
}
