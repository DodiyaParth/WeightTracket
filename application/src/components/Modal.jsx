import React, { useEffect, useRef, useId } from 'react';
import Icon from './Icon.jsx';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Escape-to-close + focus-trap + initial/return focus for a modal dialog
// (see FEEDBACK-actionplan.md S-A / DEV-27). Pass `skipInitialFocus` when the
// caller manages its own initial focus (e.g. QuickLog auto-selects its weight
// input) — Tab-trap/Escape/return-focus still apply either way.
export function useDialogA11y(containerRef, onClose, { skipInitialFocus = false } = {}) {
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    const previouslyFocused = document.activeElement;
    const focusables = () => Array.from(node.querySelectorAll(FOCUSABLE));
    if (!skipInitialFocus) (focusables()[0] || node).focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    };
  }, [containerRef, onClose]);
}

export default function Modal({ title, sub, onClose, children, footer, width = 460, busy = false }) {
  const ref = useRef(null);
  const titleId = useId();
  // While a write triggered from inside this modal is in flight, the X/backdrop
  // must not be able to dismiss it — otherwise a stale-closure completion can
  // fire later on top of whatever the user did next (see the batch-import
  // overwrite/skip race this was found from).
  useDialogA11y(ref, busy ? () => {} : onClose);
  return (
    <div className="modal-scrim" onClick={busy ? undefined : onClose}>
      <div
        className="modal" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
        style={{ width }} onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <div className="card-title" id={titleId}>{title}</div>
            {sub && <div className="muted small" style={{ marginTop: 3 }}>{sub}</div>}
          </div>
          <button className="icon-btn ghost-ib" onClick={onClose} disabled={busy} aria-label="Close"><Icon name="close" color="var(--muted)" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ title, message, confirmLabel = 'Confirm', danger, busy = false, error, onCancel, onConfirm }) {
  const ref = useRef(null);
  const titleId = useId();
  useDialogA11y(ref, onCancel);
  return (
    <div className="modal-scrim" onClick={busy ? undefined : onCancel}>
      <div
        className="modal" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
        style={{ width: 380 }} onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-body">
          <div className="card-title" id={titleId} style={{ marginBottom: 6 }}>{title}</div>
          <p className="t2 small" style={{ marginTop: 0, lineHeight: 1.5 }}>{message}</p>
          {error && <p className="small" style={{ color: 'var(--rose)', marginTop: 10 }}>{error}</p>}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className={'btn ' + (danger ? 'danger' : 'primary')} onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
