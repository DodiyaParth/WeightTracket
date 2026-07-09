import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Toast } from './ui.jsx';

const Ctx = createContext({ open: () => {} });
export const useQuickLog = () => useContext(Ctx);

const DATE_CHIPS = ['Today', 'Yesterday', '2 days ago'];

function QuickLogModal({ entry, onClose, onSaved }) {
  const nav = useNavigate();
  const editing = !!entry;
  const [weight, setWeight] = useState(entry ? String(entry.kg) : '83.2'); // prefill last
  const [when, setWhen] = useState(editing ? entry.date : 'Today');
  const [note, setNote] = useState(entry?.note || '');
  const [showNote, setShowNote] = useState(!!entry?.note);
  const ref = useRef(null);

  useEffect(() => { const t = setTimeout(() => { ref.current?.focus(); ref.current?.select(); }, 30); return () => clearTimeout(t); }, []);

  const step = (d) => setWeight((w) => (Math.max(0, (parseFloat(w) || 0) + d)).toFixed(1));
  const save = () => { onSaved(`${editing ? 'Updated' : 'Logged'} ${(+weight).toFixed(1)} kg · ${when}`); onClose(); };
  const onKey = (e) => { if (e.key === 'Enter') save(); };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal quicklog" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="card-title">{editing ? 'Edit entry' : 'Log my weight'}</div>
          <button className="icon-btn ghost-ib" onClick={onClose}><Icon name="close" color="var(--muted)" /></button>
        </div>

        <div className="modal-body" style={{ paddingTop: 6 }}>
          <div className="weigh-input">
            <button className="step" onClick={() => step(-0.1)} aria-label="−0.1"><Icon name="minus" size={20} color="var(--text-2)" /></button>
            <div className="weigh-field">
              <input ref={ref} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} onKeyDown={onKey} onBlur={() => setWeight((+weight || 0).toFixed(1))} />
              <span className="unit">kg</span>
            </div>
            <button className="step" onClick={() => step(0.1)} aria-label="+0.1"><Icon name="plus" size={20} color="var(--text-2)" /></button>
          </div>

          <div className="row" style={{ gap: 8, marginTop: 18, justifyContent: 'center', flexWrap: 'wrap' }}>
            {(editing ? [entry.date, ...DATE_CHIPS.filter((c) => c !== entry.date)] : DATE_CHIPS).slice(0, 3).map((c) => (
              <button key={c} className={'date-chip' + (when === c ? ' on' : '')} onClick={() => setWhen(c)}>{c}</button>
            ))}
            <button className="date-chip" title="Pick a date"><Icon name="calendar" size={16} color="var(--text-2)" /></button>
          </div>

          {showNote
            ? <input className="input" style={{ marginTop: 14 }} placeholder="Note (optional) — e.g. after travel" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
            : <button className="btn ghost sm" style={{ marginTop: 12, alignSelf: 'center' }} onClick={() => setShowNote(true)}><Icon name="plus" size={15} color="var(--text-2)" />Add note</button>}
        </div>

        <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
          {editing
            ? <button className="btn ghost sm" style={{ color: '#d6463c' }} onClick={onClose}><Icon name="trash" size={16} color="#d6463c" />Delete</button>
            : <button className="btn ghost sm" onClick={() => { onClose(); nav('/add'); }}>Advanced (bulk · CSV)</button>}
          <button className="btn primary" onClick={save}><Icon name="check" color="#fff" />Save</button>
        </div>
      </div>
    </div>
  );
}

export function QuickLogProvider({ children }) {
  const [state, setState] = useState(null); // null | {entry?}
  const [toast, setToast] = useState(null);
  const open = (entry) => setState({ entry });
  const onSaved = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {state && <QuickLogModal entry={state.entry} onClose={() => setState(null)} onSaved={onSaved} />}
      {toast && <Toast>{toast}</Toast>}
    </Ctx.Provider>
  );
}
