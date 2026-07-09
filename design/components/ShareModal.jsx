import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal, { Confirm } from './Modal.jsx';
import Icon, { Avatar } from './Icon.jsx';
import { RoleBadge } from './ui.jsx';
import { me, partner } from '../data.js';

function RoleSeg({ value }) {
  const [v, setV] = useState(value);
  return (
    <span className="seg">
      <button className={v === 'edit' ? 'on' : ''} onClick={() => setV('edit')}>Can edit</button>
      <button className={v === 'read' ? 'on' : ''} onClick={() => setV('read')}>Read only</button>
    </span>
  );
}

// Share an EXISTING dashboard. No name/team-goal editing, no "Create" (D1–D4).
export default function ShareModal({ dashboard, onClose }) {
  const nav = useNavigate();
  const [linkOn, setLinkOn] = useState(true);
  const [copied, setCopied] = useState(false);
  const [revoke, setRevoke] = useState(false);
  const copy = () => { setCopied(true); setTimeout(() => setCopied(false), 1600); };

  return (
    <Modal title={`Share “${dashboard?.name || 'Parth & Priya'}”`} sub="Editors manage goals & habits. Everyone logs their own weight." width={520} onClose={onClose}
      footer={<button className="btn primary" onClick={onClose}>Done</button>}>
      <div className="col" style={{ gap: 18 }}>
        <div>
          <label className="field-label">Members &amp; access</label>
          <div className="col" style={{ gap: 10 }}>
            {[[me, 'owner'], [partner, 'edit']].map(([p, kind], i) => (
              <div key={i} className="row between">
                <span className="row" style={{ gap: 10 }}><Avatar size={32} color={p.color}>{p.initial}</Avatar>
                  <span className="col"><span style={{ fontWeight: 600 }}>{p.name}</span><span className="muted small">{p.email}</span></span></span>
                {kind === 'owner' ? <RoleBadge access="owner" /> : <RoleSeg value="edit" />}
              </div>
            ))}
            <div className="invite-card outbound">
              <Avatar size={32} color="var(--p4)">Sa</Avatar>
              <div className="grow"><div style={{ fontWeight: 600 }}>sara@email.com</div><div className="muted small">Invited · waiting to accept</div></div>
              <span className="pill gray">Pending</span>
              <button className="btn ghost sm">Cancel</button>
            </div>
          </div>
        </div>

        <div>
          <label className="field-label">Invite by email</label>
          <div className="row" style={{ gap: 10 }}>
            <input className="input" placeholder="name@email.com" />
            <RoleSeg value="edit" />
            <button className="btn primary">Invite</button>
          </div>
          <p className="muted small" style={{ marginTop: 8 }}>Once accepted, the dashboard appears in both accounts.</p>
        </div>

        <div className="divider" />

        <div>
          <div className="row between" style={{ marginBottom: 6 }}>
            <label className="field-label" style={{ margin: 0 }}>Read-only link · no login</label>
            <span className="row" style={{ gap: 8, cursor: 'pointer' }} onClick={() => (linkOn ? setRevoke(true) : setLinkOn(true))}>
              <span className="muted small">{linkOn ? 'On' : 'Off'}</span>
              <span style={{ width: 38, height: 22, borderRadius: 11, background: linkOn ? 'var(--accent)' : 'var(--track)', position: 'relative' }}>
                <span style={{ position: 'absolute', top: 2, left: linkOn ? 18 : 2, width: 18, height: 18, borderRadius: 9, background: '#fff' }} /></span>
            </span>
          </div>
          {linkOn ? (
            <>
              <div className="link-box"><span className="url">weighttracker.app/s/9fA2-kQ7x</span>
                <button className={'btn sm' + (copied ? ' primary' : '')} onClick={copy}><Icon name={copied ? 'check' : 'copy'} size={16} color={copied ? '#fff' : 'var(--text-2)'} />{copied ? 'Copied!' : 'Copy'}</button></div>
              <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => { onClose(); nav('/s/9fA2-kQ7x'); }}><Icon name="eye" size={16} color="var(--text-2)" />Open read-only preview</button>
            </>
          ) : <div className="link-box" style={{ color: 'var(--muted)' }}><span className="url">Link sharing is off</span><button className="btn sm" onClick={() => setLinkOn(true)}>Enable</button></div>}
        </div>
      </div>

      {revoke && <Confirm title="Disable public link?" message="Anyone using the current link loses access immediately. Re-enabling later generates a brand-new link." confirmLabel="Disable link" danger onCancel={() => setRevoke(false)} onConfirm={() => { setLinkOn(false); setRevoke(false); }} />}
    </Modal>
  );
}
