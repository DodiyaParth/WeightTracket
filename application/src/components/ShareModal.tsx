import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal, { Confirm } from './Modal.jsx';
import Icon, { Avatar } from './Icon.jsx';
import { RoleBadge, SegRadio, Toggle } from './ui.jsx';
import { useAuthedUser } from '../auth/useAuthedUser.js';
import { useOutgoingInvites } from '../hooks/useData.js';
import {
  useUpdateMemberRole, useRemoveMember, useCancelInvite, useCreateInvite, useSetPublicLink,
} from '../hooks/mutations.js';
import { memberList } from '../lib/dashboards.js';
import { initials } from '../lib/colors.js';
import type { Dashboard, Invite, Profile, Role } from '../types.js';

const ROLE_OPTIONS: [Role, string][] = [['editor', 'Can edit'], ['viewer', 'Read only']];

interface ShareModalProps {
  dashboard: Dashboard;
  profiles?: Record<string, Profile>;
  onClose: () => void;
}

export default function ShareModal({ dashboard, profiles = {}, onClose }: ShareModalProps) {
  const nav = useNavigate();
  const user = useAuthedUser();
  const d = dashboard;
  const { data: outgoing } = useOutgoingInvites(d.id);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [copied, setCopied] = useState(false);
  const [revoke, setRevoke] = useState(false);
  const { run: runInvite, busy: inviting, error: inviteError } = useCreateInvite();
  const { run: runShare, busy: shareBusy, error: shareError } = useSetPublicLink();
  const { run: runUpdateRole } = useUpdateMemberRole();
  const { run: runRemoveMember } = useRemoveMember();
  const { run: runCancelInvite } = useCancelInvite();
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [confirmRole, setConfirmRole] = useState<{ uid: string; name: string; from: Role; to: Role } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Invite | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ uid: string; name: string } | null>(null);
  const linkOn = !!d.public?.enabled;
  const iAmOwner = d.ownerUid === user.uid;
  const members = memberList(d, profiles);
  const pending = (outgoing || []).filter((i) => i.status === 'pending');

  const link = d.public?.token ? `${window.location.href.split('#')[0]}#/s/${d.public.token}` : '';
  const copy = () => { navigator.clipboard?.writeText(link).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1600); };

  // Only the owner may change roles — see firestore.rules DEV-2 (editors can't
  // touch membership). Role changes are field-path updates (DEV-17), so a
  // concurrent join/role-change elsewhere can't clobber this one.
  const doChangeRole = async (cr: { uid: string; name: string; from: Role; to: Role }) => {
    const { uid, to } = cr;
    setBusyUid(uid);
    setRowError(null);
    try {
      await runUpdateRole(d.id, uid, to);
      setConfirmRole(null);
    } catch {
      setRowError('Couldn’t update that member’s role — try again.');
    } finally {
      setBusyUid(null);
    }
  };
  // Owner-only (see firestore.rules) — removes someone else from the dashboard.
  const doRemoveMember = async (cr: { uid: string; name: string }) => {
    const { uid } = cr;
    setBusyUid(uid);
    setRowError(null);
    try {
      await runRemoveMember(d.id, uid);
      setConfirmRemove(null);
    } catch {
      setRowError('Couldn’t remove that member — try again.');
    } finally {
      setBusyUid(null);
    }
  };
  const doCancelInvite = async (inv: Invite) => {
    const id = inv.id;
    setBusyInviteId(id);
    setRowError(null);
    try {
      await runCancelInvite(id);
      setConfirmCancel(null);
    } catch {
      setRowError('Couldn’t cancel that invite — try again.');
    } finally {
      setBusyInviteId(null);
    }
  };
  const invite = async () => {
    if (!email.trim()) return;
    try {
      await runInvite(d.id, { fromUid: user.uid, fromName: user.displayName || 'A teammate', toEmail: email.trim(), role });
    } catch { return; }
    setEmail('');
  };
  const enableLink = async () => { try { await runShare(d.id, true); } catch { /* surfaced via shareError */ } };
  const confirmRevoke = async () => {
    try { await runShare(d.id, false); } catch { return; }
    setRevoke(false);
  };

  return (
    <Modal title={`Share “${d.name}”`} sub="Editors manage goals & habits. Everyone logs their own weight." width={520} onClose={onClose}
      footer={<button className="btn primary" onClick={onClose}>Done</button>}>
      <div className="col" style={{ gap: 18 }}>
        <div>
          <label className="field-label">Members &amp; access</label>
          <div className="col" style={{ gap: 10 }}>
            {members.map((m) => (
              <div key={m.uid} className="row between">
                <span className="row" style={{ gap: 10 }}>
                  <Avatar size={32} color={m.color}>{m.initial}</Avatar>
                  <span className="col"><span style={{ fontWeight: 600 }}>{m.name}</span><span className="muted small">{m.email}</span></span>
                </span>
                {m.role === 'owner' ? (
                  <RoleBadge access="owner" />
                ) : iAmOwner ? (
                  <span className="row" style={{ gap: 8 }}>
                    <SegRadio value={m.role} disabled={busyUid === m.uid} onChange={(r) => setConfirmRole({ uid: m.uid, name: m.name, from: m.role, to: r })} options={ROLE_OPTIONS} ariaLabel={`${m.name}’s access level`} />
                    <button className="icon-btn ghost-ib" title={`Remove ${m.name}`} aria-label={`Remove ${m.name}`} disabled={busyUid === m.uid} onClick={() => setConfirmRemove({ uid: m.uid, name: m.name })}>
                      <Icon name="close" size={15} color="var(--muted)" />
                    </button>
                  </span>
                ) : (
                  <RoleBadge access={m.role} />
                )}
              </div>
            ))}
            {pending.map((i) => (
              <div key={i.id} className="invite-card outbound">
                <Avatar size={32} color="var(--p4)">{i.fromName ? initials(i.fromName) : '✉'}</Avatar>
                <div className="grow"><div style={{ fontWeight: 600 }}>{i.toEmail}</div><div className="muted small">Invited · waiting to accept</div></div>
                <span className="pill gray">Pending</span>
                <button className="btn ghost sm" disabled={busyInviteId === i.id} onClick={() => setConfirmCancel(i)}>{busyInviteId === i.id ? 'Cancelling…' : 'Cancel'}</button>
              </div>
            ))}
            {rowError && <span className="small" style={{ color: 'var(--rose)' }}>{rowError}</span>}
          </div>
        </div>

        <div>
          <label className="field-label">Invite by email</label>
          <div className="row invite-row" style={{ gap: 10 }}>
            <input className="input" placeholder="name@email.com" value={email} disabled={inviting} onChange={(e) => setEmail(e.target.value)} />
            <SegRadio value={role} disabled={inviting} onChange={setRole} options={ROLE_OPTIONS} ariaLabel="Invite access level" />
            <button className="btn primary" onClick={invite} disabled={inviting}>{inviting ? 'Inviting…' : 'Invite'}</button>
          </div>
          {inviteError && <p className="small" style={{ color: 'var(--rose)', marginTop: 8 }}>{inviteError}</p>}
          <p className="muted small" style={{ marginTop: 8 }}>Once accepted, the dashboard appears in both accounts.</p>
        </div>

        <div className="divider" />

        <div>
          <div className="row between" style={{ marginBottom: 6 }}>
            <label className="field-label" style={{ margin: 0 }}>Read-only link · no login</label>
            <span className="row" style={{ gap: 8, opacity: shareBusy ? 0.6 : 1 }}>
              <span className="muted small">{linkOn ? 'On' : 'Off'}</span>
              <Toggle on={linkOn} label="Read-only link, no login" onClick={shareBusy ? undefined : () => (linkOn ? setRevoke(true) : enableLink())} />
            </span>
          </div>
          {shareError && <p className="small" style={{ color: 'var(--rose)', marginBottom: 8 }}>{shareError}</p>}
          {linkOn ? (
            <>
              <div className="link-box"><span className="url">{link}</span>
                <button className={'btn sm' + (copied ? ' primary' : '')} onClick={copy}><Icon name={copied ? 'check' : 'copy'} size={16} color={copied ? '#fff' : 'var(--text-2)'} />{copied ? 'Copied!' : 'Copy'}</button></div>
              <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => { onClose(); nav(`/s/${d.public.token}`); }}><Icon name="eye" size={16} color="var(--text-2)" />Open read-only preview</button>
            </>
          ) : (
            <div className="link-box" style={{ color: 'var(--muted)' }}><span className="url">Link sharing is off</span><button className="btn sm" disabled={shareBusy} onClick={enableLink}>Enable</button></div>
          )}
        </div>
      </div>

      {confirmRole && (
        <Confirm
          title="Change access?" message={`${confirmRole.name} will change from ${confirmRole.from === 'editor' ? 'Can edit' : 'Read only'} to ${confirmRole.to === 'editor' ? 'Can edit' : 'Read only'}.`}
          confirmLabel="Change" busy={busyUid === confirmRole.uid} error={rowError}
          onCancel={() => setConfirmRole(null)} onConfirm={() => doChangeRole(confirmRole)}
        />
      )}
      {confirmRemove && (
        <Confirm
          title="Remove this member?" message={`${confirmRemove.name} will lose access to “${d.name}”. Their own weight history is unaffected.`}
          confirmLabel="Remove" danger busy={busyUid === confirmRemove.uid} error={rowError}
          onCancel={() => setConfirmRemove(null)} onConfirm={() => doRemoveMember(confirmRemove)}
        />
      )}
      {confirmCancel && (
        <Confirm
          title="Cancel this invite?" message={`${confirmCancel.toEmail} will no longer be able to accept it.`}
          confirmLabel="Cancel invite" danger busy={busyInviteId === confirmCancel.id} error={rowError}
          onCancel={() => setConfirmCancel(null)} onConfirm={() => doCancelInvite(confirmCancel)}
        />
      )}
      {revoke && (
        <Confirm
          title="Disable public link?" message="Anyone using the current link loses access immediately. Re-enabling later generates a brand-new link."
          confirmLabel="Disable link" danger busy={shareBusy} error={shareError}
          onCancel={() => setRevoke(false)} onConfirm={confirmRevoke}
        />
      )}
    </Modal>
  );
}
