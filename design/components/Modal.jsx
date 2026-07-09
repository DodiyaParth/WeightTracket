import React from 'react';
import Icon from './Icon.jsx';

export default function Modal({ title, sub, onClose, children, footer, width = 460 }) {
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" style={{ width }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="card-title">{title}</div>
            {sub && <div className="muted small" style={{ marginTop: 3 }}>{sub}</div>}
          </div>
          <button className="icon-btn ghost-ib" onClick={onClose}><Icon name="close" color="var(--muted)" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ title, message, confirmLabel = 'Confirm', danger, onCancel, onConfirm }) {
  return (
    <div className="modal-scrim" onClick={onCancel}>
      <div className="modal" style={{ width: 380 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-body">
          <div className="card-title" style={{ marginBottom: 6 }}>{title}</div>
          <p className="t2 small" style={{ marginTop: 0, lineHeight: 1.5 }}>{message}</p>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className={'btn ' + (danger ? 'danger' : 'primary')} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
