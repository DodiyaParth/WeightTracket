import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal, { Confirm } from './Modal.jsx';
import WeightInput from './WeightInput.jsx';
import { SegRadio } from './ui.jsx';
import { useAuthedUser } from '../auth/useAuthedUser.js';
import { useProfile, useWeights, useDashboard } from '../hooks/useData.js';
import { useUpdateProfile, useCreateDashboard, useUpdateDashboard, useAddWeight, useCreateInvite } from '../hooks/mutations.js';
import {
  healthyRange, journeyDirection, evaluateTargetVsHealthy, suggestTargetDate, requiredRate, paceVerdict,
  type Direction,
} from '../lib/health.js';
import { fmtKg } from '../lib/format.js';
import { todayISO, addDays, fmtLong } from '../lib/date.js';
import type { Goal, Role } from '../types.js';

type StepKey = 'name' | 'gate' | 'startDate' | 'startWeight' | 'target' | 'targetDate' | 'review';

interface GoalWizardProps {
  mode: 'create' | 'join';
  dashboardId?: string;   // required in join mode (invite already accepted)
  dashboardName?: string; // join intro
  inviterName?: string;   // join intro
  onClose: () => void;
}

const DIRECTION_WORD: Record<Direction, string> = { loss: 'weight-loss', gain: 'weight-gain', maintain: 'maintenance' };
const num = (s: string): number => parseFloat(s);
const valid = (s: string): boolean => { const n = num(s); return !Number.isNaN(n) && n > 0; };

// Small labelled verdict pill — word + shape, never colour alone (a11y).
function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'muted'; children: React.ReactNode }) {
  const cls = tone === 'warn' ? 'pill amber' : tone === 'ok' ? 'pill' : 'pill gray';
  return <span className={cls}>{children}</span>;
}

export default function GoalWizard({ mode, dashboardId, dashboardName, inviterName, onClose }: GoalWizardProps) {
  const nav = useNavigate();
  const user = useAuthedUser();
  const { data: profile } = useProfile(user.uid);
  const { data: weights } = useWeights(user.uid);
  const { data: dash } = useDashboard(dashboardId);

  const { run: runUpdateProfile } = useUpdateProfile();
  const { run: runCreateDashboard } = useCreateDashboard();
  const { run: runUpdateDashboard } = useUpdateDashboard();
  const { run: runAddWeight } = useAddWeight();
  const { run: runCreateInvite } = useCreateInvite();

  // --- captured values ---
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [heightM, setHeightM] = useState('');
  const [startISO, setStartISO] = useState(todayISO());
  const [startMode, setStartMode] = useState<'today' | 'past'>('today');
  const [startKg, setStartKg] = useState('');
  const [startKgTouched, setStartKgTouched] = useState(false);
  const [targetKg, setTargetKg] = useState('');
  const [targetISO, setTargetISO] = useState('');
  const [targetTouched, setTargetTouched] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('editor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  // Seed DOB/height from the profile once it loads (so a partial profile only
  // asks for what's actually missing).
  useEffect(() => {
    if (!profile) return;
    if (profile.dob) setDob(profile.dob);
    if (profile.heightM) setHeightM(String(profile.heightM));
  }, [profile]);

  // The profile gate (Step 1) is skipped silently when both are already known.
  const needsGate = !(profile?.dob && profile?.heightM);
  const steps: StepKey[] = useMemo(() => [
    ...(mode === 'create' ? (['name'] as StepKey[]) : []),
    ...(needsGate ? (['gate'] as StepKey[]) : []),
    'startDate', 'startWeight', 'target', 'targetDate', 'review',
  ], [mode, needsGate]);

  const [i, setI] = useState(0);
  const step = steps[Math.min(i, steps.length - 1)];
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, [i]);

  // Prefill the start weight from the weigh-in on the chosen date (editable);
  // re-runs when the date changes, but never clobbers a value the user typed.
  const existingAtStart = (weights || []).find((w) => w.date === startISO);
  useEffect(() => {
    if (startKgTouched) return;
    setStartKg(existingAtStart ? String(existingAtStart.kg) : '');
  }, [startISO, existingAtStart?.kg, startKgTouched]);

  // Suggest a safe-pace target date once start + target are known — but only
  // while the user hasn't hand-picked one (§2A: don't silently move their date).
  useEffect(() => {
    if (targetTouched) return;
    if (valid(startKg) && valid(targetKg)) setTargetISO(suggestTargetDate(startISO, num(startKg), num(targetKg)));
  }, [startKg, targetKg, startISO, targetTouched]);

  // --- derived guidance ---
  const startNum = num(startKg);
  const targetNum = num(targetKg);
  const heightNum = num(heightM);
  const range = healthyRange(heightNum || (profile?.heightM ?? null));
  const direction = journeyDirection(startNum, targetNum);
  const healthyEval = evaluateTargetVsHealthy(targetNum, range, direction);
  const rate = targetISO && valid(startKg) && valid(targetKg) ? requiredRate(startISO, targetISO, startNum, targetNum) : 0;
  const verdict = paceVerdict(rate, direction, startNum);

  // --- per-step validity (warnings never gate; only missing/unparseable does) ---
  const stepValid: Record<StepKey, boolean> = {
    name: !!name.trim(),
    gate: !!dob && dob <= todayISO() && valid(heightM),
    startDate: !!startISO && startISO <= todayISO(),
    startWeight: valid(startKg),
    target: valid(targetKg),
    targetDate: !!targetISO && targetISO > startISO,
    review: true,
  };
  const canContinue = stepValid[step];
  const isLast = step === 'review';

  const goNext = () => {
    if (!canContinue) return;
    if (isLast) { attemptFinish(); return; }
    setI((n) => Math.min(steps.length - 1, n + 1));
  };
  const goBack = () => setI((n) => Math.max(0, n - 1));

  const startWeighInChanged = !!existingAtStart && existingAtStart.kg !== startNum;

  const attemptFinish = () => {
    // Changing an existing logged weight → confirm, never silent overwrite (§G).
    if (startWeighInChanged) { setConfirmOverwrite(true); return; }
    void commit();
  };

  const commit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (needsGate) await runUpdateProfile(user.uid, { dob, heightM: heightNum });
      let id = dashboardId;
      if (mode === 'create') { const d = await runCreateDashboard(user.uid, { name: name.trim() }); id = d.id; }
      if (!id) throw new Error('No dashboard to save the goal to.');
      // The start weight IS a normal weigh-in (single source of truth) — write
      // it only when it's new or actually changed.
      if (!existingAtStart || existingAtStart.kg !== startNum) {
        await runAddWeight(user.uid, { date: startISO, kg: startNum });
      }
      const goal: Goal = { startISO, targetKg: targetNum, targetISO };
      const mergedGoals = mode === 'join' && dash ? { ...dash.goals, [user.uid]: goal } : { [user.uid]: goal };
      await runUpdateDashboard(id, { goals: mergedGoals });
      if (mode === 'create' && inviteEmail.trim()) {
        await runCreateInvite(id, { fromUid: user.uid, fromName: user.displayName || 'A teammate', toEmail: inviteEmail.trim(), role: inviteRole });
      }
      onClose();
      nav(`/dashboard/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong — try again.');
      setConfirmOverwrite(false);
      setBusy(false);
    }
  };

  const primaryLabel = busy ? 'Saving…' : isLast ? (mode === 'join' ? 'Join & set goal' : 'Create dashboard') : 'Continue';
  const title = STEP_TITLES[step];

  return (
    <Modal title={title} width={520} busy={busy} onClose={onClose}
      footer={(
        <>
          {i > 0 && <button className="btn" onClick={goBack} disabled={busy}>Back</button>}
          <div style={{ flex: 1 }} />
          <button className="btn primary" onClick={goNext} disabled={!canContinue || busy}>{primaryLabel}</button>
        </>
      )}>
      <div className="col" style={{ gap: 16 }} onKeyDown={(e) => { if (e.key === 'Enter' && canContinue && !busy) goNext(); }}>
        {/* honest, per-user step count */}
        <div className="wizard-progress" aria-hidden="true">
          <span className="muted small">Step {i + 1} of {steps.length}</span>
          <div className="wizard-bar"><span style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>
        </div>
        <span className="sr-only" aria-live="polite">Step {i + 1} of {steps.length}: {title}</span>
        <h2 ref={headingRef} tabIndex={-1} className="wizard-heading">{title}</h2>

        {mode === 'join' && i === 0 && (
          <p className="t2 small" style={{ marginTop: -6 }}>
            <b>{inviterName || 'A teammate'}</b> invited you to <b>{dashboardName || 'a dashboard'}</b>. Set your own goal — that’s how you two get a shared goal.
          </p>
        )}

        {step === 'name' && (
          <div>
            <label className="field-label">Name your dashboard</label>
            <input className="input" placeholder="e.g. Me & Priya, or Summer cut" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            <p className="muted small" style={{ marginTop: 8 }}>Just a label — you can rename it later.</p>
          </div>
        )}

        {step === 'gate' && (
          <div className="col" style={{ gap: 14 }}>
            <p className="t2 small" style={{ margin: 0 }}>We use your height to suggest a healthy range — never shared.</p>
            <div>
              <label className="field-label">Date of birth</label>
              <input className="input" type="date" max={todayISO()} value={dob} aria-label="Date of birth" onChange={(e) => setDob(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Height (m)</label>
              <input className="input" inputMode="decimal" placeholder="e.g. 1.78" value={heightM} aria-label="Height in metres" onChange={(e) => setHeightM(e.target.value)} />
              <p className="muted small" style={{ marginTop: 8 }}>Your height in metres, e.g. 1.78.</p>
            </div>
          </div>
        )}

        {step === 'startDate' && (
          <div className="col" style={{ gap: 12 }}>
            <p className="t2 small" style={{ margin: 0 }}>Pick a past date if you’ve already begun, or start today.</p>
            <SegRadio
              value={startMode}
              onChange={(v) => { setStartMode(v); if (v === 'today') { setStartISO(todayISO()); setStartKgTouched(false); } }}
              options={[['today', 'Starting today'], ['past', 'I already started']]}
              ariaLabel="When your journey started"
            />
            {startMode === 'past' && (
              <div>
                <label className="field-label">Start date</label>
                <input className="input" type="date" max={todayISO()} value={startISO} aria-label="Start date" onChange={(e) => { setStartISO(e.target.value || todayISO()); setStartKgTouched(false); }} />
              </div>
            )}
            <p className="muted small" style={{ margin: 0 }}>This is day one of your chart.</p>
          </div>
        )}

        {step === 'startWeight' && (
          <div className="col" style={{ gap: 10 }}>
            <label className="field-label">What did you weigh on {fmtLong(startISO)}?</label>
            <WeightInput value={startKg} onChange={(v) => { setStartKgTouched(true); setStartKg(v); }} ariaLabel="Start weight in kg" />
            {existingAtStart
              ? <p className="muted small" style={{ margin: 0 }}>From your logged data · {fmtLong(startISO)}. Editing this corrects that weigh-in.</p>
              : <p className="muted small" style={{ margin: 0 }}>We’ll save this as your weigh-in for {fmtLong(startISO)}.</p>}
          </div>
        )}

        {step === 'target' && (
          <div className="col" style={{ gap: 10 }}>
            <label className="field-label">Your goal weight</label>
            <WeightInput value={targetKg} onChange={setTargetKg} ariaLabel="Target weight in kg" />
            {range && (
              <div className="row between" style={{ alignItems: 'center', gap: 8 }}>
                <span className="small t2">A healthy weight for your height is <b>{range[0]}–{range[1]} kg</b>.</span>
                <button className="btn ghost sm" onClick={() => setTargetKg(String(direction === 'gain' ? range[0] : range[1]))}>Use a healthy target</button>
              </div>
            )}
            {valid(targetKg) && (
              <p className="small" style={{ margin: 0 }}>
                That’s a <b>{DIRECTION_WORD[direction]}</b> goal.
                {healthyEval.line && <> · <span className={healthyEval.tone === 'warn' ? 'change-bad' : healthyEval.tone === 'ok' ? 'change-good' : 'muted'}>{healthyEval.line}</span></>}
              </p>
            )}
          </div>
        )}

        {step === 'targetDate' && (
          <div className="col" style={{ gap: 12 }}>
            <label className="field-label">By when?</label>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button className="btn ghost sm" onClick={() => { setTargetTouched(false); setTargetISO(suggestTargetDate(startISO, startNum, targetNum)); }}>At a safe pace</button>
              <button className="btn ghost sm" onClick={() => { setTargetTouched(true); setTargetISO((d) => addDays(d || suggestTargetDate(startISO, startNum, targetNum), -21)); }}>Sooner</button>
              <button className="btn ghost sm" onClick={() => { setTargetTouched(true); setTargetISO((d) => addDays(d || suggestTargetDate(startISO, startNum, targetNum), 21)); }}>Later</button>
            </div>
            <input className="input" type="date" min={addDays(startISO, 1)} value={targetISO} aria-label="Target date" onChange={(e) => { setTargetTouched(true); setTargetISO(e.target.value); }} />
            {direction === 'maintain'
              ? <p className="small" style={{ margin: 0 }}>Hold around <b>{fmtKg(targetNum)} kg</b> (±1–2 kg) — we’ll flag drifts. <Pill tone="muted">maintenance</Pill></p>
              : targetISO && (
                <p className="small" style={{ margin: 0 }}>
                  To reach {fmtKg(targetNum)} kg by {fmtLong(targetISO)}, that’s about <b>{rate.toFixed(2)} kg a week</b> — <Pill tone={verdict.tone}>{verdict.label}</Pill>
                </p>
              )}
            <p className="muted small" style={{ margin: 0 }}>You can change this any time.</p>
          </div>
        )}

        {step === 'review' && (
          <div className="col" style={{ gap: 14 }}>
            <div className="card" style={{ background: 'var(--surface-2)' }}>
              <p style={{ margin: 0, lineHeight: 1.6 }}>
                You’ll go from <b>{fmtKg(startNum)} kg → {fmtKg(targetNum)} kg</b> by <b>{fmtLong(targetISO)}</b>
                {direction !== 'maintain' && <> — about <b>{rate.toFixed(2)} kg a week</b></>}.
              </p>
              <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="pill gray">{DIRECTION_WORD[direction]}</span>
                {direction !== 'maintain' && <Pill tone={verdict.tone}>{verdict.label}</Pill>}
                {healthyEval.line && <Pill tone={healthyEval.tone}>{healthyEval.status === 'in' ? 'in healthy range' : healthyEval.status === 'below' ? 'below healthy range' : 'above healthy range'}</Pill>}
              </div>
            </div>
            {mode === 'create' && (
              <div>
                <label className="field-label">Invite someone <span className="muted" style={{ fontWeight: 400 }}>· optional</span></label>
                <div className="row invite-row" style={{ gap: 10 }}>
                  <input className="input" placeholder="name@email.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                  <SegRadio value={inviteRole} onChange={setInviteRole} options={[['editor', 'Can edit'], ['viewer', 'Read only']]} ariaLabel="Invite access level" />
                </div>
              </div>
            )}
            <p className="muted small" style={{ margin: 0 }}>You can edit any of this later from the dashboard.</p>
          </div>
        )}

        {error && <p className="small" style={{ color: 'var(--rose)', margin: 0 }}>{error}</p>}
        <p className="disclaimer" style={{ textAlign: 'left', margin: 0 }}>Not medical advice — guidance to help you set a realistic goal.</p>
      </div>

      {confirmOverwrite && (
        <Confirm
          title="Update your logged weight?"
          message={`You already logged ${fmtKg(existingAtStart?.kg ?? 0)} kg for ${fmtLong(startISO)}. Save ${fmtKg(startNum)} kg instead?`}
          confirmLabel="Update" busy={busy} error={error}
          onCancel={() => setConfirmOverwrite(false)} onConfirm={() => void commit()}
        />
      )}
    </Modal>
  );
}

const STEP_TITLES: Record<StepKey, string> = {
  name: 'Name your dashboard',
  gate: 'First, two quick details',
  startDate: 'When did your journey start?',
  startWeight: 'Your starting weight',
  target: 'Your target weight',
  targetDate: 'Your target date',
  review: 'Review & create',
};
