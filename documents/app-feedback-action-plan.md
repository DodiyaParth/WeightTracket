# WeightTracker — Feedback → Code Action Plan

**Source:** `app-feedback-developer.md` (DEV-1 → DEV-38, two audit passes).
**This doc:** for every feedback item, the concrete code action items — files, functions, and the specific change. Grouped so shared infrastructure is built once and reused.
**Order:** P0 (blockers) → P1 (functional/req/a11y) → P2 (robustness) → P3 (polish/format).

Legend: 🆕 new file/function · ✏️ edit existing · ⚠️ needs a data-model change · 🔒 needs live Firestore verification.

---

## New requests (user, 2026-07-01) — reshape scope

### F1 · Full weight history view with direct edit 🆕 (feedback point 3)
- 🆕 `pages/History.jsx` + route `/history` in `App.jsx` — shows **all** weigh-ins (today's "Recent entries" caps at 8, `AddWeight.jsx:206`). List grouped by month; each row edits weight **and** date + deletes inline. Optional month **calendar** grid toggle (dots on logged days; tap a day to add/edit).
- Reuses the DEV-3-fixed `updateWeight` (date-safe) + `Confirm` for delete. Link from sidebar + a "View all" on the Recent-entries card.
- ✅ **Decided (2026-07-01): List + calendar toggle.** List grouped by month is the default; a toggle switches to a month calendar grid (dots on logged days, tap a day to add/edit). Both views edit/delete the same entries.

### F2 · Two-decimal weight precision 🆕✏️ (feedback point 4)
- 🆕 `WEIGHT_DP = 2` + `fmtKg(kg)` in `lib/format.js`; route all weight display through it.
- ✏️ `QuickLog.jsx`: default `70.00`, `step`/`onBlur`/toast → `toFixed(2)` (steppers stay ±0.1; manual entry allows 0.01). `AddWeight.jsx:21,148` toasts + CSV preview → 2dp. `csv.js:61` `toFixed(1)`→`toFixed(2)`.
- ✏️ `lib/stats.js`: change values (`totalChange:48`, `deltas:84`) → 2dp; `formatChange` "No change" epsilon → `<0.005`. `ema` already 2dp.
- Collision "same weight" (DEV-11) compares kg at 2dp.

### F3 · Email + password login for consistent test data 🆕✏️ (feedback point 5)
- 🔒 Firebase console: enable the **Email/Password** provider (your action — Authentication → Sign-in method).
- ✏️ `auth/AuthContext.jsx`: add `signInWithEmail(email,pw)` / `signUpWithEmail(email,pw)` (`signInWithEmailAndPassword` / `createUserWithEmailAndPassword`); `ensureProfile` already runs on user change, so test data lands in real Firestore (consistent, unlike demo's in-memory store).
- ✏️ `pages/Login.jsx`: email + password fields + Sign in / Create account toggle, beside Continue-with-Google.
- ✅ **Decided (2026-07-01): Replace demo mode entirely.** Remove the demo login path — `config.isDemo/setDemo` flag, `seed.js:demoAuthUser`, the "Explore the demo" button (`Login.jsx:63`), and the `DEMO` branches in `AuthContext.jsx` + `repo.js`. `repo` always resolves to the Firestore backend. **Keep `memory.js` + `seed.js` as the unit-test backend only** (tests import them directly, not via `repo`). All app/testing data now lives in real Firestore.
- ✏️ Touches: `data/config.js`, `data/repo.js`, `auth/AuthContext.jsx`, `pages/Login.jsx`; DEV-36 landing (`wt_landed`) stays relevant.

---

## Shared infrastructure to build first (unblocks many items)

These three pieces are dependencies for a dozen DEV items — build them before the per-item work.

- **S-A · Hardened `Modal` / `Confirm`** ✏️ `components/Modal.jsx` — add Escape-to-close, focus-trap, initial + return focus, `role="dialog"` + `aria-modal` + `aria-labelledby`. Reuse in `QuickLog.jsx`'s private scrim. *(Resolves DEV-27; prerequisite for every modal item.)*
- **S-B · `formatChange(value, {unit, context})` helper** 🆕 `lib/format.js` — returns `{ glyph:'↓|↑|—', tone:'good|bad|neutral', text, aria }`. `Math.abs(v)<0.05 → "No change"`. Context-aware (`goalDirection`, `atOrBelowGoal`). Unit-tested. *(Resolves DEV-19, feeds DEV-32/34.)*
- **S-C · Write-guard pattern** — a small `useAsyncAction` hook 🆕 `hooks/useAsyncAction.js` (`{run, busy, error}`) wrapping any mutation in try/catch/finally, returning busy + error so call sites stop being fire-and-forget. *(Resolves DEV-5, feeds DEV-24/35.)* **No Undo toast** — user decision (2026-07-01): deferred from MVP to keep it simple; recoverability comes from the collision confirms (DEV-11) + destructive `Confirm` dialogs (DEV-12).

---

## P0 — Release blockers (security & data integrity)

### DEV-1 · `selfJoining` authorization bypass 🔒⚠️ `firestore.rules:43-49`
- ⚠️ **Data-model change:** switch invites from email-keyed to a doc the rule can read: `invites/{dashId}_{uid}` (or keep email doc + add `toUid` once known). Touch `createInvite`/`acceptInvite` in **both** `data/firestore.js:197,205` and `data/memory.js:162,171`.
- ✏️ `firestore.rules` — rewrite `selfJoining()` to: `exists()` an accepted invite for `request.auth.uid`; require new role ∈ `['editor','viewer']`; `request.resource.data.members.diff(resource.data.members).affectedKeys().hasOnly([request.auth.uid])`; `diff().affectedKeys().hasOnly(['memberUids','trackedUids','members','updatedAt'])`; `ownerUid` unchanged.
- 🔒 Re-verify live with two Google accounts (this is the riskiest clause in the whole app).

### DEV-2 · `isEditor()` update path unvalidated 🔒 `firestore.rules:36-41,55`
- ✏️ Split `allow update`: editors may change only `['goals','teamGoal','habits','settings','name','public','updatedAt']` via `affectedKeys().hasOnly(...)`; require `ownerUid == request.auth.uid` for any change touching `memberUids`/`members`/`trackedUids`.

### DEV-3 · Editing a weight's **date** corrupts data ✏️ `data/firestore.js:91` + `memory.js:71`
- ✏️ `updateWeight(uid, id, patch)`: if `patch.date && patch.date !== id` → **delete-old + set-new** at the new date key; guard against a collision at the target date (surface "an entry already exists on that date"). Mirror the delete+set in `memory.js`.
- Covers both call sites (`QuickLog.jsx:35` and Advanced "Recent entries" pencil `AddWeight.jsx:210`) because the fix lands in the repo, not the modal.
- 🆕 Unit test in `lib/__tests__` via the memory backend: edit-with-date-change moves the doc, no duplicate, collision rejected.

### DEV-4 · `fanOutSeries` throws the weigh-in save for tracked viewers 🔒 `data/firestore.js:65-75`
- ✏️ Don't `updateDoc(dashboards/{id},{updatedAt})` from a non-editor client. Two-part fix:
  - (a) derive dashboard recency from the `series/{uid}` doc's own `updatedAt` (drop the parent bump), **or** relax the rule so members may bump *only* `updatedAt` (`affectedKeys().hasOnly(['updatedAt'])`).
  - (b) wrap each per-dashboard fan-out in `.catch()` so one rejection can't fail the user's save.
- 🔒 Verify a viewer-tracked account can still log weight.

### DEV-5 · All writes are fire-and-forget ✏️ (uses S-C)
- ✏️ Wrap every mutation call site in try/catch/finally via `useAsyncAction` (or local try/catch): `QuickLog.jsx:31-40`, `AddWeight.jsx:17-24,59-64,113-118`, `HabitsSection.jsx:21,73,127-132`, `GoalEditor.jsx:50-56`, `DashboardBody.jsx` Wins, `ShareModal.jsx:36-42`, `Profile.jsx:21-25`.
- ✏️ On failure: error toast, keep modal open, re-enable button, reset `busy` in `finally`. Habit toggles: `await` + revert on error (optimistic rollback).

### DEV-6 · Public snapshot world-writable + leaks emails 🔒 `firestore.rules:92-95`, `data/firestore.js:239-243`, `PublicView.jsx`
- ✏️ `firestore.rules` — `publicViews/{token}` write only if caller is owner/editor of the referenced `dashboardId` (`get()` the dashboard).
- ✏️ `data/firestore.js:21` `rid()` → `crypto.getRandomValues` token ≥128 bits (also `memory.js:13`).
- ✏️ `rebuildPublic` (`firestore.js:233`, and `memory.js:216 getPublicView`) — strip `email` + non-display fields from each `members` entry before writing/returning the snapshot.

---

## P1 — "Add but can't modify" gaps + a11y + correctness

### DEV-7 · Whole types are create-only (delete/leave) ⚠️ repos + UI
- 🆕 `data/firestore.js` + `memory.js`: `deleteDashboard(id)`, `removeMember(id, uid)` + self-leave, `deleteNsv(id, noteId)`, and habit-remove (splice `habits` via `updateDashboard`).
- 🆕 `firestore.rules`: allow member-doc delete/leave and NSV delete per author/owner.
- ✏️ UI: **Danger zone** in `DashSettings.jsx` (delete/leave); ✕ per member row in `ShareModal.jsx`; hover edit/delete on habit + NSV rows. Gate destructive actions behind existing `Confirm`.

### DEV-8 · Habits can't be renamed / re-emoji'd ✏️ `HabitsSection.jsx:41-49,90-108`
- ✏️ Inline-edit (pencil → input) writing the updated `habits` array via `updateDashboard`. Optional emoji picker on add (replace hardcoded `⭐` at `:41`).

### DEV-9 · NSV notes add-only ✏️ `data/firestore.js:180` + `DashboardBody.jsx:149`
- 🆕 `deleteNsv(id, noteId)` (both repos) + optional edit. Show delete on author's own notes only (authorship already gated at `DashboardBody.jsx:258`).

### DEV-10 · Dashboard name write-once ✏️ `DashSettings.jsx`
- ✏️ Add a Name field to `DashSettings` → `updateDashboard(id,{name})` (already supported). Keep it off the Share surface per §11.6.

### DEV-11 · Same-date collision handling — popups, not silent overwrite ✏️ (user spec, feedback point 2)
- 🆕 `lib/collisions.js` · `classifyEntries(incoming, existing)` → `{ fresh, unchanged, conflicting }` — *unchanged* = same date **and** same kg (at 2dp); *conflicting* = same date, different kg. Pure + unit-tested.
- **Single** (`QuickLog.jsx:31`, `AddWeight.jsx` Single `:17`):
  - same date + same weight → info popup "This entry is already logged" (no write). *(2.i)*
  - same date + different weight → `Confirm` "An entry for {date} already exists ({old} kg). Overwrite with {new} kg?" → overwrite only on confirm. *(2.ii)*
- **Bulk / CSV** (`AddWeight.jsx` Bulk `:59`, Csv `:113`): classify the whole batch, **write `fresh` immediately**, then **club** the remainder into ONE dialog — "{N} already logged, unchanged (skipped) · {M} differ — overwrite them?" with Overwrite / Skip. New rows always saved; only differing dates need the confirm.
- Repos keep upsert; gating happens in the UI *before* calling `addWeight`/`addWeights`. Supersedes the silent-upsert path; folds in DEV-22 in-file-dupe policy and DEV-24 real-count reporting.

### DEV-12 · No confirm on destructive edits ✏️ (uses `Confirm`)
- ✏️ Wrap in `Confirm`: role change/demote `ShareModal.jsx:36`, cancel invite `:67`, clear team goal `GoalEditor.jsx:53`, and **Decline invite** `DashboardsList.jsx:65`.

### DEV-19 · Numeric change formatting ✏️ (uses S-B)
- ✏️ Rename CSS `.delta-up`/`.delta-down` (`styles.css:185-186`) → `.change-good`/`.change-bad`/`.change-neutral`. **Keep the colors** (loss = teal) — only the names invert today.
- ✏️ Apply `formatChange` at: Total-change tile `DashboardBody.jsx:36`, Weekly-rate `:37` (also fixes `−0`), 1/7/14/28 deltas `:58`, list "together" `DashboardsList.jsx:38`, milestone chips `MotivationCard.jsx:24,29`, milestone copy `motivation.js:30`.
- ✏️ A11y: glyph + word, `aria-label` on the arrow ("lost"/"gained").

### DEV-20 · Forgiving streaks are demo-only ✏️ `lib/habits.js` + `setHabitMark`
- ✏️ Produce grace value `2` in-app: auto-grace a single missed day between done days (or a manual "use a grace day" action). Currently `2` only exists in `seed.js:117`; `HabitsSection.jsx:21,73` writes only 1/0.
- 🆕 Extend unit tests for the auto-grace path.

### DEV-25 · No `:focus-visible` anywhere ✏️ `styles.css`
- ✏️ Add global `:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }`. Remove bare `outline:none` at `styles.css:438` (or pair with a visible alternative). **~3 lines, highest value/effort.**

### DEV-26 · Clickable cards non-focusable ✏️ `DashboardsList.jsx:33,132`
- ✏️ Wrap card bodies in a real `<button>`/`<Link>`, or add `role="button"` + `tabIndex={0}` + Enter/Space `onKeyDown`. Applies to DashCard, create-card, public cards.

### DEV-27 · Modals lack Escape/focus-trap/roles ✏️ (S-A)
- Delivered by S-A. Reuse across `Modal`, `Confirm`, `QuickLog.jsx:44` scrim, `Layout.jsx:75` dropdowns.

### DEV-31 · Ideal line + goal band hidden for first 14 days ✏️ `DashboardBody.jsx:236`
- ✏️ Pass the real `goal` to `<Chart>` always (remove the `days>=14 ? g : null` gate). Only the **projection fan** stays gated — `Chart.jsx:56` already does that. Keep the tiles' "need more data" lock.

---

## P2 — Robustness / correctness / integration

### DEV-13 · Missing ERROR states ✏️ `DashboardDetail.jsx:18`, `DashboardsList.jsx:93`, `PublicView.jsx:15`
- ✏️ Read `error` + `reload` (already returned by `useAsync`) and render a distinct **Retry** card instead of falling through to empty state.

### DEV-14 · `acceptInvite` non-atomic 🔒 `data/firestore.js:205-220`
- ✏️ Wrap the 3 writes in `writeBatch`/`runTransaction`. Align payload with the hardened DEV-1 rule.

### DEV-15 · Profile edits don't re-denormalize ✏️ `data/firestore.js:47`
- 🆕 `fanOutProfile(uid)` mirroring `fanOutSeries` — propagate name/height into `dashboards/*/members.<uid>`. Fixes stale dashboard BMI + names. Bring `memory.js:40` to parity (currently syncs only `name`).

### DEV-16 · Change-bus refetch too coarse ✏️ `data/bus.js`, `hooks/useData.js`
- ✏️ Debounce `bus.emit`, or scope events by collection/key. (Longer term: `onSnapshot`.)

### DEV-17 · `changeRole` clobbers whole `members` map ✏️ `ShareModal.jsx:36`
- ✏️ Use field-path update `members.<uid>.role` instead of rewriting the render-time snapshot.

### DEV-18 · Rule shape validation ✏️ `firestore.rules:27-29,59-62,69-72`
- ✏️ weights/series: `kg is number && kg>0 && kg<1000`; cap `series.entries` size. nsv create: add `request.auth.uid in ...memberUids`.

### DEV-22 · CSV importer robustness ✏️ `lib/csv.js` + `AddWeight.jsx`
- ✏️ `csv.js:56` — locale decimals: normalize `82,5`→`82.5`, strip thousands separators, reject multi-separator values. (Current regex turns `82,5`→`825`.)
- ✏️ `AddWeight.jsx:156` — column **override** dropdowns (§4); guard `dateIdx===weightIdx` (`csv.js:38`).
- ✏️ `csv.js:59` — in-file duplicate = last-wins merge/notice, not a "bad" row. (Cross-history dupes handled by DEV-11.)

### DEV-23 · Bulk backfill row bugs ✏️ `AddWeight.jsx:58,73`
- ✏️ Key rows by a stable id (not date). Show per-cell "invalid" marker for non-numeric weights.

### DEV-24 · Optimistic success counts ✏️ `AddWeight.jsx:62,116`
- ✏️ Report the real count returned by `addWeights` (callers currently discard it); per-write catch for partial-failure honesty. **Now delivered by the DEV-11 batch dialog** (reports fresh / overwritten / skipped).

### DEV-28 · Non-semantic switches / segmented controls ✏️ multiple
- ✏️ Public-link toggle `ShareModal.jsx:88` → use existing `<Toggle>`. Model `RoleSeg` (`ShareModal.jsx:11`), `CreateDashboard.jsx:54`, layer toggles `DashSettings.jsx:29`, date-chips `QuickLog.jsx:63` as `radiogroup`+`aria-checked`, add non-color indicator. Extract one `RoleSeg` into `ui.jsx` (dedupe).

### DEV-29 · Missing accessible names ✏️ multiple
- ✏️ `aria-label` on icon-only buttons (settings `DashboardDetail.jsx:45`, bell `Layout.jsx:70`); `Icon` `aria-hidden` by default. Account chip `Layout.jsx:47` → add Enter/Space handler. Chart `<Line>` `Chart.jsx:143` → `role`/`aria-label`/text alt; legend toggles `aria-pressed`.

### DEV-32 · Verdict/pace tone ignores meaning ✏️ `DashboardBody.jsx:43` (uses S-B)
- ✏️ Drive tone from the verdict/pace, not a fixed `delta-up`. "behind vs ideal" must not render teal; muted arrow when pace is unsafe-fast.

### DEV-34 · "Together" stat raw/duplicated/drops gainers ✏️ `DashboardBody.jsx:164` + `DashboardsList.jsx:18`
- 🆕 One helper in `lib/stats.js` (net **trend** delta, honest definition). Use in both places. Also clears the bare-`−` (DEV-19 #4) in one spot.

### DEV-35 · Accept/Decline fire-and-forget ✏️ `DashboardsList.jsx:65` (uses S-C)
- ✏️ `await` with disabled/busy state + error handling; pair with DEV-14 atomic write.

### DEV-36 · Landing keyed per-tab not per-session ✏️ `App.jsx:24-34`, `AuthContext.jsx:68`
- ✏️ Key the auto-open decision to auth session/uid; clear `wt_landed` in `signOutUser`.

---

## P3 — Polish / cleanup

- **DEV-30** ✏️ `styles.css` — darken `--muted` toward `--text-2` for text (keep light shade for dividers/dots) to clear AA contrast.
- **DEV-33** ✏️ `Chart.jsx:134-139` — render each legend key on the same predicate that governs its dataset (no phantom "Ideal"/"Projected").
- **DEV-37** 🆕 `App.jsx:49` — lightweight NotFound route + top-level error boundary.
- **DEV-38** cleanup — wire or delete `lib/habits.js:37-56` (`combinedKind`/`doneCount`/`singleKind` are test-only); simplify `Progress mins` `DashboardBody.jsx:49`; drop QuickLog note `autoFocus` `QuickLog.jsx:74`; confirm HabitsSection-in-empty-state `DashboardBody.jsx:198`.

### Recoverability (settled — user decision 2026-07-01)
- ❌ **No Undo toast** — deferred from MVP to keep it simple.
- ✅ **Collision confirms** (DEV-11) cover accidental overwrite for single + bulk/CSV.
- ✅ Keep explicit `Confirm` dialogs for destructive actions (DEV-12).

---

## Suggested execution order
1. **Shared infra** S-A, S-B, S-C.
2. **P0** DEV-3, DEV-4 (most impactful functional bugs) → DEV-5, DEV-11 → rules DEV-1, DEV-2, DEV-6 (+ live verify).
3. **P1** DEV-19/32/34 numeric, DEV-25/26/27 keyboard-a11y, DEV-31 chart goal line, then the add/modify gaps DEV-7→10, DEV-20.
4. **P2** DEV-13 (retry cards) → DEV-14/35, DEV-22/23/24 CSV/bulk, DEV-28/29 a11y, DEV-15/16/17/18/36.
5. **P3** DEV-30/33/37/38 + Undo.

**Quickest high-value wins:** DEV-25 (`:focus-visible`, ~3 lines) and DEV-13 (read `error`/`reload`).
**Scariest:** DEV-1 (auth bypass) and DEV-3 (data corruption). **Most impactful functional bug:** DEV-4 (weigh-in save throws for tracked viewers).

**Testable now (no live Firestore):** everything in `lib/*` + `memory.js` behavior (DEV-3, 19, 20, 22, 34, formatChange). **Needs live Firestore (🔒):** DEV-1, 2, 4, 6, 14 rule/atomicity behavior with two accounts.
