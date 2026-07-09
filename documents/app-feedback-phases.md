# WeightTracker — Phased Execution Plan

Companion to `app-feedback-action-plan.md` (which maps every feedback item to code) and `app-feedback-developer.md` (the raw feedback). **This doc is the build order**, written so a developer new to the codebase can pick up a phase and execute it top to bottom.

## How to use this document
- Work phases **in order** — later phases depend on infrastructure built earlier.
- Within a phase, do tasks in the numbered order (dependencies flow downward).
- Every task lists: **Files**, **Steps**, **Test**, and **Done when**. Do not mark a task done until its "Done when" is true.
- `🔒` marks work that needs **live Firestore + real sign-in** to verify (can't be proven by unit tests alone).
- Item codes like `DEV-3`, `F2` refer back to `app-feedback-action-plan.md` — read that entry for the "why".

## Project conventions (read once)
- **Run:** `cd application && npm run dev` → http://localhost:5181. **Test:** `npm test` (Vitest). **Build:** `npm run build`.
- **Architecture:** pure logic in `src/lib/*` (no React/Firebase — unit-test everything here). Data access goes through `src/data/repo.js`, which re-exports either `firestore.js` (production) or `memory.js` (tests/demo). UI never imports `firestore.js`/`memory.js` directly — always `import { repo } from '../data/repo.js'`.
- **When you add logic, add a test.** Put tests in `src/lib/__tests__/`. The bar is: every function in `src/lib` has coverage. There are 49 tests today; keep them green.
- **After each task:** run `npm test` and `npm run build`. After each phase: click through the app manually per the phase's "Manual QA".

---

# PHASE 1 — Authentication, shared foundations & display consistency

**Goal:** Add email/password login (keeping Google + demo working for now), and build the cross-cutting pieces every later phase reuses: a hardened modal, number-formatting helpers, a write-guard hook, a global focus ring, 2-decimal weights, and consistent change-number formatting.

**Why first:** Phases 2–4 all reuse the Modal, the formatters, and the write-guard. Auth goes here because you asked for it, and because Phase 2's "default account" migration builds directly on the email/password path added here.

**Prerequisite:** Email/Password provider is enabled in Firebase console (✅ already done).

### 1.1 · Email/password authentication (F3, part 1) 🔒
**Files:** `src/auth/AuthContext.jsx`, `src/pages/Login.jsx`
**Steps:**
1. In `AuthContext.jsx`, import `signInWithEmailAndPassword`, `createUserWithEmailAndPassword` from `firebase/auth`.
2. Add two functions inside `AuthProvider`, mirroring the existing `signInWithGoogle` error handling:
   ```js
   const signInWithEmail = async (email, password) => {
     setError(null);
     if (!isFirebaseConfigured) { setError('not-configured'); return false; }
     try { await signInWithEmailAndPassword(auth, email, password); return true; }
     catch (e) { setError(e?.code || 'sign-in-failed'); return false; }
   };
   const signUpWithEmail = async (email, password) => {
     setError(null);
     if (!isFirebaseConfigured) { setError('not-configured'); return false; }
     try { await createUserWithEmailAndPassword(auth, email, password); return true; }
     catch (e) { setError(e?.code || 'sign-up-failed'); return false; }
   };
   ```
3. Add both to the `value` object returned by the context (the `useMemo` at the bottom). `ensureProfile` already runs on `user?.uid` change, so a new account automatically gets its Firestore profile doc — no extra work.
4. In `Login.jsx`, below the Google button, add an email field, a password field, a primary "Sign in" button, and a small toggle link "New here? Create an account" that flips a `mode` state between `'signin'`/`'signup'` (changing which function the button calls and the button label). Show `error` messages using the existing error rendering pattern (map common codes: `auth/invalid-credential` → "Wrong email or password", `auth/email-already-in-use` → "That email already has an account", `auth/weak-password` → "Use at least 6 characters").
5. Keep the existing Google button and the "Explore the demo" button untouched **for now** (demo is removed in Phase 2).

**Test:** `npm test` still green. 🔒 Manual: create a new account with email/password → you land in the app and a `users/{uid}` doc appears in Firestore; sign out; sign back in with the same credentials.
**Done when:** you can sign up and sign in with email/password against real Firestore, and errors render human-readable text.

### 1.2 · Number-formatting helpers (S-B + F2 core)
**Files:** NEW `src/lib/format.js`, NEW `src/lib/__tests__/format.test.js`
**Steps:**
1. Create `src/lib/format.js` with two exports:
   ```js
   export const WEIGHT_DP = 2;
   // Format a weight in kg to fixed precision, e.g. 83.2 -> "83.20".
   export const fmtKg = (kg) => (kg == null || Number.isNaN(kg) ? '—' : Number(kg).toFixed(WEIGHT_DP));

   // Format a CHANGE (delta) value with an intent-carrying glyph + tone.
   // goalDirection: 'down' (weight loss, default) | 'up'. Returns display parts.
   export function formatChange(value, { unit = 'kg', goalDirection = 'down', atOrBelowGoal = false } = {}) {
     const v = Number(value);
     if (value == null || Number.isNaN(v) || Math.abs(v) < 0.005) {
       return { glyph: '—', tone: 'neutral', text: 'No change', aria: 'no change' };
     }
     const losing = v < 0;                       // weight went down
     const good = goalDirection === 'down' ? losing : !losing;
     const glyph = losing ? '↓' : '↑';
     const word = losing ? 'lost' : 'gained';
     // Maintaining at/below goal: a small gain is neutral, not "bad".
     const tone = atOrBelowGoal && !losing ? 'neutral' : (good ? 'good' : 'bad');
     const text = `${Math.abs(v).toFixed(WEIGHT_DP)} ${unit}`;
     return { glyph, tone, text, aria: `${word} ${text}` };
   }
   ```
2. Write `format.test.js` covering: positive/negative/zero, the `<0.005` "No change" branch, `goalDirection:'up'`, and `atOrBelowGoal` neutral case.

**Test:** new tests pass.
**Done when:** `formatChange` and `fmtKg` are exported and fully tested.

### 1.3 · Apply 2-decimal precision everywhere (F2)
**Files:** `src/components/QuickLog.jsx`, `src/pages/AddWeight.jsx`, `src/lib/csv.js`, `src/lib/stats.js`
**Steps:**
1. `QuickLog.jsx`: default weight `'70.0'` → `'70.00'`; `step()` `.toFixed(1)` → `.toFixed(2)`; `onBlur` `.toFixed(1)` → `.toFixed(2)`; toast `kg.toFixed(1)` → use `fmtKg(kg)`. **Leave the stepper increment at ±0.1** (accuracy comes from manual typing of the 2nd decimal).
2. `AddWeight.jsx`: Single-tab toast `v.toFixed(1)` → `fmtKg(v)`; CSV preview `+kgNum.toFixed(1)` → `+kgNum.toFixed(2)`; display of `r.kg`/`e.kg` → `fmtKg(...)`.
3. `csv.js` `buildImport`: `+kg.toFixed(1)` → `+kg.toFixed(2)`.
4. `stats.js`: `totalChange` `.toFixed(1)` → `.toFixed(2)`; `deltas` value `.toFixed(1)` → `.toFixed(2)`. (`ema` is already 2dp — leave it.) Update the affected assertions in `stats.test.js`.

**Test:** update + run `stats.test.js`; `npm run build`.
**Done when:** every weight and change number in the UI shows 2 decimals; tests green.

### 1.4 · Consistent change-number display (DEV-19)
**Files:** `src/styles.css`, `src/components/DashboardBody.jsx`, `src/pages/DashboardsList.jsx`, `src/components/MotivationCard.jsx`, `src/lib/motivation.js`
**Steps:**
1. In `styles.css:185-186`, **rename** `.delta-up` → `.change-good` and `.delta-down` → `.change-bad`, and add `.change-neutral { color: var(--muted); }`. **Keep the colors as-is** (a loss stays teal) — only the class names change. Then update every `className` in JSX that used `delta-up`/`delta-down` (grep the `src/` tree for both).
2. At each change-number render site, replace the hand-rolled `>0?'+':'−'` logic with `formatChange(...)`. Render as: `<span className={'change-' + tone} aria-label={aria}><span aria-hidden>{glyph}</span> {text}</span>`. Sites: Total-change tile (`DashboardBody.jsx:36`), Weekly-rate tile (`:37`, append the existing safe-pace pill), the 1/7/14/28-day deltas (`:58`), the DashboardsList "together" card stat (`:38`), the milestone chips (`MotivationCard.jsx:24,29`), and the milestone-hit copy string (`motivation.js:30` — pass a word, not a bare `−{kg}`).
3. **Accessibility:** the glyph is `aria-hidden`; the accessible name comes from `aria-label={aria}` (which says "lost 4.20 kg"). Never rely on color alone.

**Test:** `npm run build`; grep confirms no remaining `delta-up`/`delta-down`.
**Manual:** open a dashboard → Total/Weekly/deltas show `↓ 4.20 kg` style, correct colors, and a zero value shows "— No change".
**Done when:** all change numbers route through `formatChange`, class names are intent-based, and a screen reader would announce direction in words.

### 1.5 · Write-guard hook (S-C, no Undo)
**Files:** NEW `src/hooks/useAsyncAction.js`
**Steps:**
1. Create a hook that standardizes mutation calls:
   ```js
   import { useState, useCallback } from 'react';
   export function useAsyncAction() {
     const [busy, setBusy] = useState(false);
     const [error, setError] = useState(null);
     const run = useCallback(async (fn) => {
       setBusy(true); setError(null);
       try { return await fn(); }
       catch (e) { setError(e?.message || 'Something went wrong'); throw e; }
       finally { setBusy(false); }
     }, []);
     return { run, busy, error };
   }
   ```
2. Do **not** add an Undo/action slot to `Toast` (deferred by decision). This hook is applied broadly in Phase 2 (DEV-5).

**Test:** none needed yet (applied in Phase 2). `npm run build`.
**Done when:** the hook exists and builds.

### 1.6 · Hardened Modal — Escape, focus-trap, roles (S-A / DEV-27)
**Files:** `src/components/Modal.jsx` (both `Modal` and `Confirm`)
**Steps:**
1. Add a `useEffect` that, on mount, records `document.activeElement`, moves focus to the modal container (or its first focusable), and on unmount restores focus to the recorded element.
2. Add a keydown listener: `Escape` calls `onClose`/`onCancel`; `Tab`/`Shift+Tab` is trapped within the modal (query focusable elements: `a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])`; wrap from last→first and first→last).
3. Add ARIA: the outer modal gets `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing at the title element's id (generate an id per instance).
4. Keep the scrim-click-to-close behavior.

**Test:** `npm run build`.
**Manual:** open any modal → Escape closes it; Tab cycles only within the modal; on close, focus returns to the button that opened it.
**Done when:** all `Modal`/`Confirm` instances are keyboard-operable and screen-reader-announced. (QuickLog's private scrim is migrated in Phase 2 when it's touched.)

### 1.7 · Global focus-visible ring (DEV-25)
**Files:** `src/styles.css`
**Steps:**
1. Add near the top of the stylesheet:
   ```css
   :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
   ```
2. At `styles.css:438`, the `.weigh-field input { outline: none }` removes the ring — replace with a visible alternative on focus (e.g. a bottom-border color change) or scope the `outline:none` to `:focus:not(:focus-visible)`.

**Manual:** Tab through the app — every button, link, input shows a clear focus ring.
**Done when:** no interactive element is focusable without a visible indicator.

### 1.8 · Error/retry states (DEV-13)
**Files:** `src/pages/DashboardDetail.jsx`, `src/pages/DashboardsList.jsx`, `src/pages/PublicView.jsx`
**Steps:**
1. Each of these destructures only `{ data, loading }` from `useAsync`/the data hook. Also destructure `error` and `reload` (both already returned).
2. When `error` is truthy, render a small card: a short message ("Couldn't load this — check your connection") and a "Try again" button calling `reload()`. This must render **instead of** the empty/"not found" state, so a rules-denial/offline error no longer looks like "no data".

**Manual:** temporarily throw in a repo read to confirm the retry card appears (then revert).
**Done when:** load failures show a distinct retry card, not a misleading empty state.

### Phase 1 — Manual QA checklist
- [ ] Sign up + sign in with email/password (🔒 real Firestore).
- [ ] All weights/changes show 2 decimals; a zero change shows "No change".
- [ ] Change numbers show ↓/↑ + words, correct colors.
- [ ] Every modal: Escape closes, focus is trapped + restored.
- [ ] Visible focus ring everywhere via keyboard.
- [ ] A simulated load error shows a retry card.
- [ ] `npm test` green, `npm run build` clean.

---

# PHASE 2 — Default account, core data integrity & collision handling

**Goal:** Replace demo mode with a **real, credentialed default account** whose data lives in Firestore; fix the two data-corruption/silent-failure bugs; make every write robust; and implement same-date collision confirms.

**Why second:** Phase 1 gave us email/password + the Modal/format/write-guard building blocks these tasks need.

### 2.1 · Seed a default account into Firestore (F3, part 2) 🔒
**Goal:** Recreate the demo world (Parth + cast + dashboards) as real Firestore data under a real login you keep as the default test account, e.g. `demo@weighttracker.app`.
**Approach — Admin SDK seed script (recommended):** the seed writes other people's `series`/profile docs, which security rules forbid from a normal client (`isUser(uid)`), so use the Admin SDK which bypasses rules.
**Files:** NEW `scripts/seed-firestore.mjs`, `.gitignore`
**Steps:**
1. Firebase console → Project settings → Service accounts → "Generate new private key". Save as `application/serviceAccount.json`. **Add `serviceAccount.json` to `.gitignore` immediately** (it's a full-access credential — never commit it).
2. `npm i -D firebase-admin`.
3. Write `scripts/seed-firestore.mjs` that:
   - Initializes admin with the service account.
   - Creates (or looks up) the default auth user via `admin.auth().createUser({ email, password, uid: 'parth' })` — reuse the seed `DEMO_UID='parth'` as the uid so existing seed relationships line up. Wrap in try/catch for "already exists".
   - Imports `buildSeed()` from `src/data/seed.js` and writes, using the **same document paths** the app reads (see `firestore.js` model): `users/{uid}` profiles, `users/{uid}/weights/{date}`, `dashboards/{id}` (+ `memberUids` array derived from `members` keys), `dashboards/{id}/series/{uid}`, `dashboards/{id}/habitLogs/{uid}`, `dashboards/{id}/nsv/{noteId}`, `invites/{id}`.
   - Note: the seed weights are 1dp; that's fine (display rounds to 2dp).
4. Add an npm script: `"seed": "node scripts/seed-firestore.mjs"`. Run `npm run seed`.
5. Document the default credentials in `README.md` (email + password) so the team shares one default test login.

**Test:** 🔒 sign in as `demo@weighttracker.app` → you see the Parth & Priya dashboard and the seeded cast, backed by real Firestore.
**Done when:** the default account logs in and shows the seeded world from Firestore; `serviceAccount.json` is gitignored.

### 2.2 · Remove demo mode (F3, part 3)
**Files:** `src/data/config.js`, `src/data/repo.js`, `src/auth/AuthContext.jsx`, `src/pages/Login.jsx`, `src/data/seed.js`
**Steps:**
1. `repo.js`: delete the `isDemo()` branch — `export const repo = firestore;` always. Remove the `DEMO` export (grep for its uses first).
2. `config.js`: remove `isDemo`/`setDemo` (or keep the file only if something else imports it — grep). If Firebase isn't configured the app should show the "configure Firebase" message, **not** fall back to demo.
3. `AuthContext.jsx`: remove the `DEMO` constant and every `if (DEMO)` branch; `user` starts `null`, `loading` starts `isFirebaseConfigured`. `signOutUser` just calls `signOut(auth)`.
4. `Login.jsx`: remove the "Explore the demo — no sign-in" button and the `setDemo` import.
5. `seed.js`: remove `demoAuthUser` (grep for uses first). **Keep the rest of `seed.js` and all of `memory.js`** — they remain the unit-test backend (tests import them directly).
6. Grep the whole `src/` tree for `demo`, `isDemo`, `wt_demo`, `VITE_WT_DEMO` and remove stragglers.

**Test:** `npm test` green (memory.js still works for tests); `npm run build` clean; grep shows no demo references in `src/` outside `memory.js`/`seed.js`/tests.
**Done when:** the only way into the app is a real login; the default account (2.1) is the shared test login.

### 2.3 · Fix weight date-edit corruption (DEV-3) — the critical data bug
**Files:** `src/data/firestore.js` (`updateWeight`), `src/data/memory.js` (`updateWeight`), tests
**Problem:** weights are keyed by date (`users/{uid}/weights/{date}`). Editing the date writes a `date` field that no longer matches the doc id → the entry appears to move but the canonical key is stale, and re-adding the old date later collides.
**Steps:**
1. In `firestore.js` `updateWeight(uid, id, patch)`: if `patch.date && patch.date !== id`:
   - Check a doc doesn't already exist at the new date (`getDoc(users/{uid}/weights/{patch.date})`). If it does, **throw** a clear error (`"An entry already exists on {newDate}"`) so the UI can surface it.
   - Otherwise `setDoc` the merged data at the new date key, then `deleteDoc` the old id, then `fanOutSeries(uid)`.
   - If the date is unchanged, keep the existing `updateDoc` path.
2. Mirror the same delete-old/set-new logic in `memory.js` `updateWeight`.
3. Add unit tests (via `memory.js`): editing weight only → same date, updated kg; editing date → entry moves, old date gone, no duplicate; editing to a date that already exists → throws.

**Test:** new tests pass.
**Manual:** edit an entry's date from the QuickLog modal **and** from AddWeight's "Recent entries" pencil (both funnel through `updateWeight`) → the entry moves cleanly, no duplicate remains.
**Done when:** changing an entry's date never leaves a stale/duplicate doc, and a collision is rejected with a clear error.

### 2.4 · Weigh-in save no longer throws for tracked viewers (DEV-4) 🔒 — the highest-impact functional bug
**Files:** `src/data/firestore.js` (`fanOutSeries`)
**Problem:** `fanOutSeries` calls `updateDoc(dashboards/{id}, {updatedAt})` for **every** dashboard tracking the user. If the user is only a *viewer* there, the rules reject that `updateDoc`, the rejection bubbles out of `addWeight`, and the whole save fails.
**Steps:**
1. Wrap each per-dashboard fan-out body in its own `try/catch` (or `.catch()`) so one dashboard's rejection can't fail the user's save.
2. Stop bumping the parent dashboard's `updatedAt` from the client here. Instead rely on the `series/{uid}` doc's own `updatedAt` for recency. (If a dashboard `updatedAt` is still needed for sorting, defer it to Phase 3's rule change that lets members bump only `updatedAt`.)

**Test:** unit test in `memory.js` is limited here (no rules); the real proof is live.
**Manual:** 🔒 sign in as an account that is a **viewer** on a dashboard tracking it (the seed's `d3`/`d4` make `parth` a viewer) → log a weight → the save succeeds, modal closes, toast shows.
**Done when:** logging weight succeeds for a user who is a viewer on any dashboard that tracks them.

### 2.5 · Make all writes robust (DEV-5)
**Files:** `src/components/QuickLog.jsx`, `src/pages/AddWeight.jsx`, `src/components/HabitsSection.jsx`, `src/components/GoalEditor.jsx`, `src/components/DashboardBody.jsx` (Wins), `src/components/ShareModal.jsx`, `src/pages/Profile.jsx`
**Steps:**
1. At each mutation call site, use `useAsyncAction` (from 1.5): call `await run(() => repo.xxx(...))`, drive the button `disabled` from `busy`, and render `error` (small inline text or a toast) on failure. Only close the modal / clear the form in the success path.
2. `QuickLog.save/del` specifically: add a `finally` so `busy` resets; disable the weight `<input>` while busy; guard the Enter-to-save handler with `if (busy) return`.
3. Habit toggles (`setHabitMark`): `await` the write; on error, revert the optimistic checkbox state.
4. Migrate QuickLog's private scrim to the hardened `Modal` behavior (Escape/focus-trap) now that you're in this file (finishes DEV-27).

**Test:** `npm run build`.
**Manual:** go offline (DevTools → Network → Offline), try to log → button re-enables, modal stays open, an error shows (not a false success).
**Done when:** no write is fire-and-forget; failures are visible and recoverable, successes reset state.

### 2.6 · Same-date collision handling (DEV-11) — your feedback point 2
**Files:** NEW `src/lib/collisions.js`, NEW `src/lib/__tests__/collisions.test.js`, `src/components/QuickLog.jsx`, `src/pages/AddWeight.jsx`
**Steps:**
1. Create the pure classifier:
   ```js
   import { WEIGHT_DP } from './format.js';
   const sameKg = (a, b) => Number(a).toFixed(WEIGHT_DP) === Number(b).toFixed(WEIGHT_DP);
   // existing: [{date, kg}]; incoming: [{date, kg, note}]
   export function classifyEntries(incoming, existing) {
     const byDate = new Map(existing.map((e) => [e.date, e]));
     const fresh = [], unchanged = [], conflicting = [];
     for (const e of incoming) {
       const prev = byDate.get(e.date);
       if (!prev) fresh.push(e);
       else if (sameKg(prev.kg, e.kg)) unchanged.push({ ...e, prevKg: prev.kg });
       else conflicting.push({ ...e, prevKg: prev.kg });
     }
     return { fresh, unchanged, conflicting };
   }
   ```
2. Unit-test it: all-fresh, all-unchanged, mixed, kg equality at 2dp.
3. **Single entry** (QuickLog + AddWeight Single): before saving, classify the one entry against `useWeights` data.
   - `unchanged` → show an info dialog ("This entry is already logged — {date}, {kg} kg.") and do nothing. *(point 2.i)*
   - `conflicting` → show a `Confirm` ("An entry for {date} already exists ({prevKg} kg). Overwrite with {kg} kg?"). Save (upsert) only on confirm. *(point 2.ii)*
   - `fresh` → save directly.
4. **Bulk / CSV** (AddWeight Bulk + CSV import): classify the whole batch.
   - Immediately save `fresh` via `repo.addWeights`.
   - If `conflicting.length` or `unchanged.length` > 0, show **one clubbed dialog**: "Saved {fresh} new. {unchanged} already logged (unchanged, skipped). {conflicting} have a different weight — overwrite them?" with **Overwrite** (upsert the conflicting) and **Skip** (leave them). Report the real final counts (this also satisfies DEV-24).
5. `repo.addWeight`/`addWeights` stay upsert — the gating is purely in the UI.

**Test:** `collisions.test.js` green.
**Manual:** log today's weight twice with the same number → info popup; log today again with a different number → overwrite confirm; CSV a file overlapping existing dates → one clubbed dialog with correct counts.
**Done when:** no same-date write happens silently; single + bulk both behave per your spec.

### 2.7 · CSV & bulk robustness (DEV-22, DEV-23)
**Files:** `src/lib/csv.js`, `src/pages/AddWeight.jsx`, tests
**Steps:**
1. **Locale decimals** (`csv.js` `buildImport`, and the AddWeight preview): replace the `replace(/[^\d.\-]/g,'')` weight parse with a helper that: strips spaces; if the value has both `.` and `,`, treats the last one as the decimal separator and removes the other (thousands); if only `,`, treats it as decimal (`82,5`→`82.5`); rejects values with multiple candidate decimals as invalid. Unit-test `82,5`, `1.020,5`, `1,020.5`, `83.2`, `abc`.
2. **Column override:** in the CSV review step (`AddWeight.jsx:156`), turn the read-only detected Date/Weight columns into `<select>` dropdowns (options = header names) defaulting to the detected index; recompute the preview when changed. Guard `dateIdx === weightIdx` with an inline warning ("Pick different columns for date and weight").
3. **Bulk row keys** (`AddWeight.jsx:73`): key rows by a stable generated id, not `r.date` (two rows on the same date currently collide React keys). Show a per-cell "invalid" marker when a weight isn't a valid number.

**Test:** new csv tests pass.
**Done when:** comma-decimals import correctly, columns are overridable with a same-column guard, and bulk rows don't collide.

### Phase 2 — Manual QA checklist
- [ ] 🔒 Default account logs in and shows the seeded world from Firestore.
- [ ] Demo mode is fully gone (grep clean); app requires a real login.
- [ ] Editing an entry's date moves it cleanly (no duplicate); a date collision errors clearly.
- [ ] 🔒 A viewer-tracked account can log weight successfully.
- [ ] Offline write shows an error and keeps the modal open.
- [ ] Single + bulk/CSV collisions show the correct popups.
- [ ] `npm test` green, `npm run build` clean.

---

# PHASE 3 — Security rules & collaboration correctness

**Goal:** Close the P0 security holes in `firestore.rules`, make collaboration writes atomic and correctly scoped, and fill the "add but can't modify/delete" gaps (the stakeholder's point 1).

**Why third:** these are the highest-risk items and need live two-account verification; doing them after the data layer is stable (Phases 1–2) means you're hardening a working system. **Every 🔒 task here must be verified with two real Google/email accounts.**

**How to test rules:** either the Firebase Emulator Suite (`firebase emulators:start`, recommended — lets you write rule unit tests) or manually with two browsers/accounts against the live project. Publish rules via console → Firestore → Rules → Publish, or `firebase deploy --only firestore:rules`.

### 3.1 · Invite model change to make self-join verifiable (DEV-1) 🔒 — the scariest hole
**Files:** `src/data/firestore.js` (`createInvite`, `acceptInvite`), `src/data/memory.js` (parity), `firestore.rules`
**Problem:** the current `selfJoining()` rule never reads an invite, so any signed-in user who knows a dashboard id can join any dashboard as any role. The invite is email-keyed, which a rule can't verify against `request.auth.uid`.
**Steps:**
1. Change invites to a doc a rule can check: when the invitee accepts, ensure an invite doc exists at a **uid-derivable id**, e.g. `invites/{dashId}_{uid}` (or add a `toUid` field set at accept time via a Cloud Function). For a no-Functions approach, key it `{dashId}_{uid}` and have `acceptInvite` reference that exact id.
2. Rewrite `selfJoining()` in `firestore.rules` to require: an accepted/valid invite `exists()` for this `request.auth.uid` on this dashboard; the new member's role ∈ `['editor','viewer']`; only the caller's own `members.<uid>` key was added (`request.resource.data.members.diff(resource.data.members).affectedKeys().hasOnly([request.auth.uid])`); the change touches only `['memberUids','trackedUids','members','updatedAt']`; and `ownerUid` is unchanged.
3. Update `acceptInvite` in both backends to the new invite shape.

**Test:** emulator rule tests: a stranger cannot join; an invited user can join only as their invited (non-owner) role; the payload can't smuggle other field changes. 🔒 Live: two accounts — invite, accept, confirm the dashboard appears in both.
**Done when:** joining requires a real invite, is limited to editor/viewer, and can't modify anything but the membership fields.

### 3.2 · Scope the editor update rule (DEV-2) 🔒
**Files:** `firestore.rules`
**Steps:** split `allow update` so editors may change only `['goals','teamGoal','habits','settings','name','public','updatedAt']` (`request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])`), while any change to `memberUids`/`members`/`trackedUids` requires `ownerUid == request.auth.uid`.
**Test:** emulator: an editor can edit goals/habits but cannot add members or flip another's role; owner can. 🔒 Live spot-check.
**Done when:** editors can't widen the read-ACL (membership) or change tracking; only owners can.

### 3.3 · Lock down the public snapshot (DEV-6) 🔒
**Files:** `firestore.rules`, `src/data/firestore.js` (`rid`, `rebuildPublic`), `src/data/memory.js` (parity)
**Steps:**
1. `firestore.rules` `publicViews/{token}`: change `allow write: if signedIn()` to require the writer be owner/editor of the referenced `dashboardId` (`get(/databases/.../dashboards/$(request.resource.data.dashboardId)).data` → check ownerUid/role). Keep `allow read: if true`.
2. Tokens: replace `Math.random().toString(36).slice(2,10)` with `crypto.getRandomValues` producing ≥128 bits (e.g. 32 hex chars). Do this in both backends' token generation.
3. `rebuildPublic`: strip `email` (and any other non-display fields) from each `members` entry before writing the snapshot. Do the same in `memory.js` `getPublicView`. Verify `PublicView.jsx` doesn't need those fields.

**Test:** emulator: a non-editor cannot write a `publicViews` doc. 🔒 Live: open a public link → works; inspect the `publicViews` doc → no emails present.
**Done when:** only a dashboard's editors can write its snapshot, tokens are unguessable, and no emails leak.

### 3.4 · Atomic accept-invite + concurrent-safe role change (DEV-14, DEV-17, DEV-35)
**Files:** `src/data/firestore.js` (`acceptInvite`), `src/components/ShareModal.jsx`, `src/pages/DashboardsList.jsx`
**Steps:**
1. `acceptInvite`: wrap the member-add + series-create + invite-status writes in a `writeBatch` (or `runTransaction`) so a mid-sequence failure can't half-join.
2. `ShareModal.changeRole`: instead of rewriting the whole `members` map from a stale snapshot, use a field-path update `updateDashboard(id, { ['members.'+uid+'.role']: newRole })` (add support in the repo if needed) so concurrent joins aren't clobbered.
3. `DashboardsList` Accept/Decline: `await` via `useAsyncAction`, disable the buttons while busy, show an error on failure (prevents double-fire + silent partial writes).

**Test:** emulator/live: accept an invite with a simulated failure → no half-join. 🔒 Two accounts: role change by owner while invitee is active → no clobber.
**Done when:** accepting is all-or-nothing, role changes don't clobber, and accept/decline can't double-fire.

### 3.5 · Profile edits re-denormalize (DEV-15)
**Files:** `src/data/firestore.js` (`updateProfile`), `src/data/memory.js` (parity)
**Steps:** after `updateProfile`, fan out name/height into every `dashboards/*/members.<uid>` the user belongs to (mirror `fanOutSeries`'s query-then-update). This keeps dashboard BMI (uses `member.heightM`) and displayed names fresh. Bring `memory.js` to parity (it currently syncs only `name`).
**Test:** unit test via memory.js: edit height → member copy updates. 🔒 Live: edit profile → dashboard BMI/name update after refetch.
**Done when:** a profile edit propagates to all dashboard member copies.

### 3.6 · Rule shape validation (DEV-18)
**Files:** `firestore.rules`
**Steps:** on `users/{uid}/weights/{id}` and `series` writes, require `kg is number && kg > 0 && kg < 1000`; cap `series.entries` size to a sane max; on `nsv` create, require `request.auth.uid in dashboard.memberUids`.
**Test:** emulator: out-of-range kg rejected; non-member nsv create rejected.
**Done when:** malformed/oversized/unauthorized writes are rejected at the rule layer.

### 3.7 · Fill delete/leave/rename gaps (DEV-7, DEV-8, DEV-9, DEV-10, DEV-12)
**Files:** `src/data/firestore.js` + `memory.js` (new repo methods), `firestore.rules`, `src/components/DashSettings.jsx`, `src/components/ShareModal.jsx`, `src/components/HabitsSection.jsx`, `src/components/DashboardBody.jsx`
**Steps:**
1. Add repo methods to **both** backends: `deleteDashboard(id)`, `removeMember(id, uid)` (+ a self-leave path), `deleteNsv(id, noteId)`, and habit remove/rename (splice/patch the `habits` array via `updateDashboard`). Add matching rules (owner deletes dashboard; owner removes members / self-leave; author/owner deletes nsv).
2. **DEV-10 rename:** add a Name field to `DashSettings.jsx` → `updateDashboard(id, { name })`. (Keep rename off the Share surface per §11.6.)
3. **DEV-8 habits:** inline-edit (pencil → input) writing the updated `habits` array; optional emoji picker; add a delete (✕) per habit row.
4. **DEV-9 NSV:** show a delete on the author's own notes (authorship already gated in `DashboardBody`).
5. **DEV-7 UI:** a "Danger zone" in `DashSettings` (Delete dashboard / Leave dashboard); an ✕ per member row in `ShareModal`.
6. **DEV-12 confirms:** wrap these destructive actions — plus role demote (`ShareModal`), cancel invite, clear team goal (`GoalEditor`), and **Decline invite** (`DashboardsList`) — in the existing `Confirm` dialog.

**Test:** unit tests via memory.js for each new method (delete removes, leave removes only self, etc.). 🔒 Live: owner deletes a dashboard; a member leaves; rename persists.
**Done when:** every entity in the mutation matrix can be created, edited, and deleted, with confirms on destructive actions.

### Phase 3 — Manual QA checklist (🔒 all need two accounts)
- [ ] A stranger cannot join a dashboard by id; an invited user joins only as editor/viewer.
- [ ] An editor cannot add members or change tracking; an owner can.
- [ ] Public snapshot writable only by editors; contains no emails; token is long/random.
- [ ] Accept invite is atomic; role change doesn't clobber concurrent edits.
- [ ] Profile edit updates dashboard BMI/names.
- [ ] Delete/leave/rename/habit-edit/nsv-delete all work with confirms.
- [ ] Rules published; `npm test` green; `npm run build` clean.

---

# PHASE 4 — History view, accessibility & final polish

**Goal:** Ship the history view (your feedback point 3), finish accessibility, make the chart/numbers honest, and clear the remaining robustness/cleanup items.

### 4.1 · Weight history view — list + calendar toggle (F1)
**Files:** NEW `src/pages/History.jsx`, `src/App.jsx` (route), `src/components/Layout.jsx` (sidebar link), `src/pages/AddWeight.jsx` ("View all" link)
**Steps:**
1. Add a protected route `/history` in `App.jsx` and a sidebar entry (and a "View all" link on AddWeight's "Recent entries" card).
2. Load all of the user's weigh-ins (`useWeights`). Provide a **view toggle** (List | Calendar) modeled as a `radiogroup` (see 4.3 for the accessible pattern).
3. **List view:** entries grouped by month (newest first), each row showing `fmtKg(kg)` + date + note, with edit (opens QuickLog) and delete (`Confirm`) actions. Edit uses the DEV-3-fixed `updateWeight`.
4. **Calendar view:** a month grid (reuse date helpers in `lib/date.js`); days with an entry show a dot + the weight; tapping a day with an entry opens edit, an empty day opens add prefilled to that date. Add month prev/next navigation.
5. Both views mutate the same data and reflect changes via the change-bus refetch.

**Test:** `npm run build`.
**Manual:** open History → see all entries in both views; edit/delete/add from each; changes persist and reflect immediately.
**Done when:** a user can browse and directly edit their full history in list or calendar form.

### 4.2 · Chart honesty & goal line (DEV-31, DEV-32, DEV-33, DEV-34)
**Files:** `src/components/DashboardBody.jsx`, `src/components/Chart.jsx`, `src/lib/stats.js`
**Steps:**
1. **DEV-31:** pass the real `goal` to `<Chart>` **always** (remove the `days>=14 ? g : null` gate at `DashboardBody.jsx:236`). The ideal line + goal band are valid from day 1; only the projection fan stays gated (Chart already does that). Keep the tiles' "need more data" lock.
2. **DEV-32:** the projected-goal verdict must take its tone from the verdict/pace (use `formatChange`/verdict), not a fixed `.change-good`. "behind vs ideal" must not render as good; a too-fast (unsafe) pace de-emphasizes (muted).
3. **DEV-33:** render each chart legend key ("Ideal"/"Projected") only when its dataset is actually drawn (same predicate as the dataset).
4. **DEV-34:** extract one "together" helper into `lib/stats.js` computing the honest net **trend** delta (not raw endpoints; must not drop members who gained). Use it in both `DashboardBody.jsx:164` and `DashboardsList.jsx:18`. Unit-test it.

**Test:** stats test for the together helper; `npm run build`.
**Done when:** goal line shows from day 1, verdict tone matches meaning, the legend never lies, and "together" is one honest helper.

### 4.3 · Accessibility pass (DEV-26, DEV-28, DEV-29, DEV-30)
**Files:** `src/pages/DashboardsList.jsx`, `src/components/ShareModal.jsx`, `src/components/CreateDashboard.jsx`, `src/components/DashSettings.jsx`, `src/components/QuickLog.jsx`, `src/components/Layout.jsx`, `src/components/DashboardDetail.jsx`, `src/components/Chart.jsx`, `src/components/Icon.jsx`, `src/components/ui.jsx`, `src/styles.css`
**Steps:**
1. **DEV-26:** make clickable cards real controls — wrap card bodies in `<button>`/`<Link>`, or add `role="button"` + `tabIndex={0}` + Enter/Space `onKeyDown` (DashCard, create-card, public cards).
2. **DEV-28:** use the existing `<Toggle>` for the public-link switch (`ShareModal:88`). Model segmented controls (`RoleSeg`, the duplicate in `CreateDashboard`, layer toggles in `DashSettings`, date-chips in `QuickLog`, the History view toggle) as `radiogroup` + `aria-checked`, with a non-color selected indicator (checkmark/bold). Extract one `RoleSeg` into `ui.jsx` and reuse (dedupe).
3. **DEV-29:** add `aria-label` to icon-only buttons (settings, bell); default `Icon` to `aria-hidden`; add Enter/Space to the account chip (`Layout.jsx:47`); give the Chart `<Line>` a `role`/`aria-label`/text alternative and its legend toggles `aria-pressed`.
4. **DEV-30:** darken `--muted` toward `--text-2` for text-level contrast (keep the light shade only for dividers/dots).

**Manual:** keyboard-only pass through every screen; check contrast on muted text.
**Done when:** all controls are keyboard-operable with accessible names, selected states aren't color-only, and text meets AA.

### 4.4 · Grace streaks in-app (DEV-20)
**Files:** `src/lib/habits.js`, `src/components/HabitsSection.jsx`, tests
**Steps:** implement grace so value `2` is produced by real use (not just seed): either auto-grace a single missed day between two done days, or a manual "use a grace day" action. Add logic in `lib/habits.js` and write it from `setHabitMark`/HabitsSection. Add unit tests for the auto-grace path.
**Done when:** a real user who misses one day can keep a streak via grace; tests cover it.

### 4.5 · Remaining robustness & cleanup (DEV-16, DEV-36, DEV-37, DEV-38)
**Files:** `src/data/bus.js`, `src/hooks/useData.js`, `src/App.jsx`, `src/auth/AuthContext.jsx`, `src/lib/habits.js`, `src/components/DashboardBody.jsx`, `src/components/QuickLog.jsx`
**Steps:**
1. **DEV-16:** debounce `bus.emit` (or scope events by collection/key) so one mutation doesn't refetch every hook on the page.
2. **DEV-36:** key the post-login auto-open to the auth session/uid, and clear `wt_landed` in `signOutUser` (so login-as-different-user in the same tab lands correctly).
3. **DEV-37:** add a lightweight NotFound route (replace the `*`→`Navigate` bounce with a small message) and a top-level React error boundary so a render throw doesn't white-screen.
4. **DEV-38:** wire or delete the test-only `lib/habits.js` helpers (`combinedKind`/`doneCount`/`singleKind`); simplify `Progress mins` in `DashboardBody`; drop the QuickLog note `autoFocus`; confirm whether HabitsSection should render inside the "No weigh-ins yet" empty state.

**Test:** `npm test`; `npm run build`.
**Done when:** refetches are scoped, landing is per-session, dead links/throws are handled gracefully, and dead code is resolved.

### Phase 4 — Manual QA checklist
- [ ] History view (list + calendar) shows all entries; edit/delete/add work in both.
- [ ] Goal line shows from day 1; verdict tone matches meaning; legend matches drawn layers.
- [ ] Full keyboard pass: all controls reachable + labeled; selected states not color-only.
- [ ] A real missed day can be repaired via grace.
- [ ] NotFound + error boundary behave; no console errors.
- [ ] `npm test` green, `npm run build` clean.

---

## Cross-phase testing summary
- **Unit-testable now (no live Firestore):** everything in `src/lib/*` + `memory.js` behavior — formatters (1.2), 2dp (1.3), classifier (2.6), CSV parsing (2.7), updateWeight date-move via memory (2.3), together helper (4.2), grace (4.4).
- **🔒 Needs live Firestore + real login:** email/password (1.1), default-account seed (2.1), viewer weigh-in (2.4), and all of Phase 3's rules/collaboration (3.1–3.7). Use two accounts and, ideally, the Firebase Emulator for rule unit tests.
- **Never commit:** `.env.local`, `serviceAccount.json`.
