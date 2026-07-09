# WeightTracker (application/) — Developer Feedback

**Date:** 2026-07-01 · **From:** Product · **Spec:** `../REQUIREMENTS.md`
**Method:** code review of the running build (`application/src` + `firestore.rules`) via three parallel audits — mutation/edit coverage, numeric display, and security/correctness/integration. *(The live browser wasn't reachable this pass, so this is source-level; behavior should be re-confirmed in the app once a browser or demo instance is available.)*

Priorities: **P0 = do not ship**, **P1 = functional gaps (the stakeholder's "add but can't modify")**, **P2 = robustness**, **P3 = formatting.**

---

## P0 — Release blockers (security & data integrity)

### DEV-1 · `selfJoining` rule is a full authorization bypass — `firestore.rules:43-49,55` — **CRITICAL/security**
The self-join clause checks `ownerUid` is unchanged and that `memberUids` grew by the caller's uid, but it **never reads the invite**, and it **doesn't constrain the caller's role or the rest of the payload**. Consequences:
- **No invite required** — any authenticated user who knows/guesses a dashboard ID can join any dashboard.
- They can write themselves in as `role:'owner'|'editor'` → then pass `isEditor()` on subsequent writes.
- The same update can rewrite `goals`, `habits`, `teamGoal`, `public`, `name`, `trackedUids` (payload unvalidated).
Read is gated on `isMember()`, so joining also grants read of every tracked member's denormalized weight series. This defeats §3.3/§3.4.
**Fix:** gate self-join on a real accepted invite and pin the payload. In-rule, at minimum require the new member's role ∈ `['editor','viewer']`, that only the caller's own `members.<uid>` key was added (`request.resource.data.members.diff(resource.data.members).affectedKeys().hasOnly([request.auth.uid])`), and `diff().affectedKeys().hasOnly(['memberUids','trackedUids','members','updatedAt'])`. Verifying the invite truly belongs to this uid needs an invite doc keyed by `{dashId}_{uid}` or a Cloud Function — the current email-keyed invite can't be checked in-rule.

### DEV-2 · `isEditor()` update path is unvalidated — `firestore.rules:36-41,55` — **HIGH/security**
`allow update: if isEditor()` sets no field constraints, so an editor (or a self-joined attacker from DEV-1) can rewrite `memberUids`/`members` (grant others read access — membership *is* the read-ACL), flip `public.enabled`, or change `trackedUids`. That's broader than "sharing settings" (§3.2).
**Fix:** split the rule — editors may change only `goals`, `teamGoal`, `habits`, `settings`, `name`, `public`, `updatedAt` (`affectedKeys().hasOnly([...])`); require `ownerUid == request.auth.uid` for `memberUids`/`members`/`trackedUids`.

### DEV-3 · Editing a weight entry's **date** corrupts/duplicates data — `data/firestore.js:91` (`updateWeight`), call site `QuickLog.jsx:35` — **CRITICAL/data-loss**
Weight docs are keyed by date (`users/{uid}/weights/{date}`). The edit modal lets the user change the date and calls `updateWeight(uid, entry.id=oldDate, { date:newDate,... })`. `updateDoc` writes a `date` field that no longer matches the doc ID and doesn't move the doc — series reads the `date` field, so the entry silently jumps while the canonical key is stale; re-adding the old date later collides. This is likely why "I can log but can't edit my weight" feels broken.
**Fix:** in `updateWeight`, if `patch.date !== id`, do delete-old + set-new (create at the new date key, delete the old doc), guarding against a collision at the target date. Or forbid date edits in the modal and route them through delete+add.

### DEV-4 · `fanOutSeries` bumps `updatedAt` on dashboards the user can't edit → the core weigh-in save throws — `data/firestore.js:65-75` (called by every weight write) — **HIGH/correctness**
Every add/update/delete weight fans out to **all** dashboards containing the user: it writes `series/{uid}` (allowed) **and** `updateDoc(dashboards/{id}, {updatedAt})` (gated by `isEditor()`). A user who is a **viewer** on a dashboard that tracks them gets that `updateDoc` **rejected**, the rejection propagates out of `addWeight`, and in `QuickLog.save` (`QuickLog.jsx:35-36`) the `await` throws — `busy` stays true, no toast, modal doesn't close, `changed()` never fires. This breaks the app's central action for the exact collaboration case it's built for.
**Fix:** (a) don't bump dashboard `updatedAt` from a non-editor's client — derive recency from the `series` doc's own `updatedAt`, or relax the rule to let members bump *only* `updatedAt` (`affectedKeys().hasOnly(['updatedAt'])`); (b) wrap each per-dashboard fan-out in `.catch()` so one rejection can't fail the user's save.

### DEV-5 · All writes are fire-and-forget — silent data loss — every mutation call site (e.g. `QuickLog.jsx:31-40`, `AddWeight.jsx:17-24,59-64,113-118`, `HabitsSection.jsx:21,73,127-132`, `GoalEditor.jsx:50-56`, `DashboardBody.jsx` Wins, `ShareModal.jsx:36-42`, `Profile.jsx:21-25`) — **HIGH/robustness**
No `try/catch` anywhere. On a Firestore failure (offline, rules rejection, quota) the promise rejects but the modal still closes / the toast still says "Logged…" / `busy` never resets. `setHabitMark` toggles don't even `await`, so a rejected write shows a check that later silently vanishes on refetch. Directly undercuts the M2 goal ("rock-solid data module").
**Fix:** wrap writes in `try/catch`; on failure show an error toast, keep the modal open, re-enable the button, reset `busy` in `finally`. For habit toggles, await + revert on error (or optimistic state with rollback).

### DEV-6 · Public snapshot is world-writable and leaks member emails — `firestore.rules:92-95` (S4), `data/firestore.js:239-243` + `PublicView.jsx:37-57` (U3) — **HIGH/security+privacy**
`publicViews/{token}` has `allow write: if signedIn()` — **any** authenticated user can overwrite/deface/spoof **any** public snapshot (or write junk docs), not just the owning dashboard's editors. Tokens are ~40 bits (`Math.random().toString(36).slice(2,10)`, `firestore.js:21`) — brute-forceable given world read. Separately, `rebuildPublic` copies the full `members` map **including `email`** into the world-readable doc.
**Fix:** restrict `publicViews` write to the owning dashboard's editor/owner (check `dashboardId` → dashboard ownerUid); generate tokens with `crypto.getRandomValues` (≥128 bits); strip `email` and other non-display fields from `members` before writing the snapshot.

---

## P1 — "Add but can't modify" (the stakeholder's point 1)

**Mutation matrix (✅ wired · ⚠️ partial/buggy · ❌ absent):**

| Entity | Create | Edit | Delete |
|---|---|---|---|
| Weight (single) | ✅ | ⚠️ **broken on date change (DEV-3)** | ✅ (confirmed) |
| Weight (bulk/CSV) | ✅ | ⚠️ via single | ⚠️ one-at-a-time only |
| Habit item | ✅ (`⭐` hardcoded) | ❌ no rename/emoji | ❌ no delete |
| Habit check-off | ✅ | ✅ toggle | ✅ toggle-off |
| Per-person goal | ✅ | ✅ | ⚠️ can't remove the block |
| Team goal | ✅ | ✅ | ✅ (clear label) |
| NSV / win note | ✅ | ❌ | ❌ |
| Dashboard | ✅ | ⚠️ **name never editable** | ❌ no delete/leave |
| Member / role | ✅ (invite→accept) | ✅ role (no confirm) | ❌ no remove |
| Invite (outgoing) | ✅ | ➖ | ✅ cancel (no confirm) |
| Public link | ✅ | ✅ | ✅ (has confirm) |
| Profile name/height | ✅ | ✅ | ⚠️ clear-to-null |

### DEV-7 · Whole types are create-only — add repo + UI for delete — `data/firestore.js`/`memory.js` (no `deleteDashboard`/`removeMember`/`deleteHabit`/`deleteNsv`) — **req**
Dashboards (no delete/leave), members (no remove after accept), habits (no delete), NSV notes (no delete) are one-way. Add `deleteDashboard(id)`, `removeMember(id, uid)` + self-leave, `deleteNsv(id, noteId)`, and habit-remove (splice the `habits` array via `updateDashboard`). Wire a **Danger zone** in `DashSettings.jsx` (delete/leave), an ✕ per member row in `ShareModal.jsx`, and hover edit/delete on habit + NSV rows. Gate destructive ones behind the existing `Confirm` (`Modal.jsx:22`).

### DEV-8 · Habits can't be renamed or re-emoji'd — `HabitsSection.jsx:41-49,90-108,127-132` — **req**
`addHabit` hardcodes `emoji:'⭐'` and rows have no edit control. Add inline-edit (pencil → compose input) writing the updated `habits` array via `updateDashboard`; optional emoji picker on add.

### DEV-9 · NSV notes are add-only — `data/firestore.js:180`, render `DashboardBody.jsx:149-154` — **req**
Add `deleteNsv` (and optionally edit); show delete on the author's own notes (authorship is already gated at `DashboardBody.jsx:258`). Mild privacy point on shared dashboards.

### DEV-10 · Dashboard name is write-once — `firestore.js:117`, natural home `DashSettings.jsx` — **confusion**
Add a Name field to `DashSettings` writing `updateDashboard(id,{name})` (already supported). §11.6 correctly keeps rename off the Share surface — so it must live in settings.

### DEV-11 · `addWeight` silently overwrites a same-date entry — `firestore.js:78` (`setDoc`), `memory.js:52` — **polish/data-loss**
Logging a weight for a date that already has one replaces it with no prompt. With quick-log defaulting to today, a second log silently loses the first. **Fix:** on add, if an entry exists for that date, surface it in the modal (pre-fill + "Update existing entry") so the overwrite is intentional. (Designer spec in the companion doc.)

### DEV-12 · No confirmation on destructive edits — `ShareModal.jsx:36-37` (role change), `:67` (cancel invite), `GoalEditor.jsx:53` (clear team goal) — **polish/req**
Only weight-delete and disable-public-link use `Confirm`. Demoting a co-editor, cancelling an invite, and wiping the team goal happen on one click with no confirm/undo. Reuse `Confirm` for these.

### Confirm-before-**add** (stakeholder point 1.2) — recommendation
There is no confirm before any add today (quick-log saves on button **and Enter**; single/bulk/CSV save directly). **Recommendation:** a confirm *dialog* on the quick-log fights §4 "least clicks" — the real need is **recoverability**, better served by an **inline "Undo"** on the existing save toast (make it actionable: "Logged 83.2 kg · Undo") for adds/edits, plus a **batch "Save N entries?" confirm on Bulk backfill** (CSV already has a preview step). Keep explicit `Confirm` dialogs for *destructive* actions. *(This is the user's call — the designer doc specs both; wire whichever they pick.)*

---

## P2 — Robustness / correctness / integration

- **DEV-13 · Missing ERROR states** — `DashboardDetail.jsx:18-35`, `DashboardsList.jsx:93-124`, `PublicView.jsx:15-19` destructure only `{data,loading}` from `useAsync`, so a fetch **error** (rules denial/offline) falls through to a misleading empty state ("Dashboard not found" / "No dashboards yet" / "link no longer active"). Read `error` and render a distinct retry card (`reload` is already returned).
- **DEV-14 · `acceptInvite` is a non-atomic 3-write** — `firestore.js:205-220`. A mid-sequence failure half-joins (member added but no series, or joined but invite still `pending` → reappears). Use `writeBatch`/`runTransaction`; align payload with the hardened DEV-1 rule.
- **DEV-15 · Profile edits don't re-denormalize** — `firestore.js:47-50`. `updateProfile` doesn't propagate name/height into `dashboards/*/members.<uid>` or `series`, so dashboard BMI (uses `member.heightM`) and names go stale after a profile edit. Add a fan-out mirroring `fanOutSeries`. (Demo syncs only `name`, `memory.js:40` — parity gap.)
- **DEV-16 · Change-bus refetch is coarse** — `data/bus.js`, `hooks/useData.js:6-26`. Every mutation re-runs every subscribed hook on the page (read amplification vs the 50K/day quota, flicker). Debounce `bus.emit` or scope events by collection/key; longer term prefer `onSnapshot`.
- **DEV-17 · `ShareModal.changeRole` rewrites the whole `members` map** — `ShareModal.jsx:36-37` — using the render-time snapshot, so a concurrent join/role change is clobbered (last-write-wins). Use a field-path update (`members.<uid>.role`).
- **DEV-18 · Rule shape validation** — `firestore.rules:27-29,59-62` (weights/series: no numeric/range/shape checks — add `kg is number && kg>0 && kg<1000`, cap `series.entries`), `:69-72` (nsv create isn't member-gated — add `request.auth.uid in ...memberUids`).
- **Minor:** `getRedirectResult` result discarded (`AuthContext.jsx:27-31`); demo/prod `listNotifications` divergence (synthetic Welcome only in demo); `inv.members` count only exists in demo seed (`DashboardsList.jsx:62`).

---

## P3 — Numeric change formatting (stakeholder point 2 — code side)

Root cause: four different conventions, bare negatives, and **backwards CSS class names**. Full visual spec in the companion designer doc; code actions:
- **DEV-19 · Add one `formatChange(value, { unit, context })` helper** (in `lib/stats.js` or a new `lib/format.js`) returning `{ glyph:'↓|↑|—', tone:'good|bad|neutral', text }`, context-aware (`goalDirection`, `atOrBelowGoal` so a gain while maintaining is neutral, not "bad"). Handle `Math.abs(v) < 0.05` → "No change" (fixes the `−0` / `−0.42→0` edge cases).
- **Rename `.delta-up`/`.delta-down`** (`styles.css:185-186`) → intent-based `.change-good` / `.change-bad` / `.change-neutral`. Today `.delta-up` (green) is applied to *losses* — the names invert their meaning and will cause future mis-wiring.
- **Apply at all call sites:** total-change tile (`DashboardBody.jsx:36`), weekly-rate tile (`:37`, also `−0` bug), multi-window deltas (`:58`, currently emits a raw `−`), dashboard card "together" stat (`DashboardsList.jsx:38`, hardcoded `−`), milestone chips/copy (`MotivationCard.jsx:24,30`, `motivation.js:30`).
- **A11y:** never rely on color alone — pair glyph + word; give the arrow an `aria-label` ("lost"/"gained").

---

## Positive confirmations (verified good — no action)
- Weight is genuinely **owner-write only** at the rule layer (`firestore.rules:22-29`); co-members read via denormalized `series` — matches §3.3/§3.4; no cross-account weight-write path in either backend.
- UI call sites pass correct arg shapes to the (49-test) `lib/stats.js` & `lib/health.js`.
- `landingRoute`/`recents`/`collaborating`/`viewOnly` implement §11.1–11.3 (collaboration-first, 7-day window, cap 5) and are wired correctly.
- State coverage is otherwise good: loading skeletons, empty states, and the `<14 days` "need more data" locks (§6.2) are all present.
- `.env.local` is gitignored; shipping the client Firebase key is expected (§7); no composite index needed for current queries.

## Suggested order
**P0 (DEV-1→6) before any release** → **P1** (the add/modify gaps + undo) → **P2** → **P3**. The single most impactful *functional* bug is DEV-4 (weigh-in save throws for tracked viewers); the scariest are DEV-1 and DEV-3.

---

# Round 2 — live-app audit + designer §1–4 translation

**Date:** 2026-07-02 · **From:** Design · **Method:** the app was run in **demo mode** (`localStorage.wt_demo=1`, seeded) and exercised in-browser across every workflow, plus three parallel deep source audits (data-entry/recoverability · dashboard/numeric · collaboration/nav/a11y). This complements the source-only Round 1 — several DEV-1→19 items are now **confirmed live** with added specificity, and DEV-20→38 below are **new**. Same priorities (P0 blocker · P1 functional/req · P2 robustness · P3 polish).

**Live-confirmed this pass:** bare `−` on every change number (Total `−4.8`, deltas, milestone chips, and list "together" cards `−6.9 / −10.9 / −7.4 kg`); **Escape closes no modal**; the quick-log save toast has **no Undo**; dashboard cards are `<div onClick>` with **no role/tabIndex**; and **no `:focus-visible` rule exists anywhere in the CSS** (verified against all stylesheets).

## Confirmations & extensions of existing items (live)
- **DEV-3** (edit-on-date corruption) — **second call site**: the Advanced page's "Recent entries" pencil (`AddWeight.jsx:210`) reopens the *same* QuickLog date-edit path, so land the delete-old + set-new fix in `updateWeight` itself, not a modal-local guard.
- **DEV-5** (fire-and-forget) — `QuickLog.save/del` set `busy=true` with no `finally` (`QuickLog.jsx:31-40`) → button stuck disabled on failure with the modal open; the weight `<input>` isn't disabled while busy; Enter-to-save (`:41`) has no busy guard (double-submit).
- **DEV-11** (same-date overwrite) — **broader than quick-log**: `addWeights` (`firestore.js:83`, `memory.js:59`) also silently overwrites existing dates from **Bulk** (`AddWeight.jsx:61`) and **CSV** (`:115`); CSV only de-dupes *within one file* (`csv.js:59`), never against saved history. Surface "will overwrite N existing entries" in the bulk/CSV review step, not just the quick-log prompt.
- **DEV-12** (destructive confirms) — also missing on the recipient-side **Decline invite** (`DashboardsList.jsx:65`): one click, no confirm.
- **DEV-13** (error states) — confirmed live: Escape dismisses nothing and a fetch error falls through to "not found" / "no dashboards" / "link no longer active". `error` + `reload` already exist on `useAsync` (`useData.js:17,25`) — they're just never read in `DashboardDetail.jsx:18`, `DashboardsList.jsx:93`, `PublicView.jsx:15`. This is the designer §3 ask; render a distinct **Retry** card per screen.
- **DEV-19** (numeric display) — confirmed on **all** surfaces (inventory below). Two nuances for the developer: **(a) the on-screen colors are currently CORRECT** (a loss renders teal via `.delta-up`) — the defect is that the *class names* invert the number's direction, so **rename `.delta-up`/`.delta-down` → `.change-good`/`.change-bad`/`.change-neutral`; do NOT "fix" the colors** or you'll break them. **(b)** the `−0` bug fires on Total-change (`DashboardBody.jsx:36`) and Weekly-rate (`:37`) whenever the value is 0 or rounds to `-0.00` — the `>0?'+':'−'` branch sends zero down the `−` path. `formatChange`'s `abs(v)<0.05 → "No change"` (DEV-19) fixes it.

### DEV-19 change-surface inventory (all confirmed live/source)
| Surface | File:line | Renders today | Should be (designer §1) |
|---|---|---|---|
| Total-change tile | `DashboardBody.jsx:36` | `−4.8` (+`−0` at zero) | `↓ 4.8 kg` / `↑` / `— No change` |
| Weekly-rate tile | `:37` | `−0.34` (+`−0`) | `↓ 0.34 kg/wk` + keep safe-pace pill |
| 1/7/14/28-day deltas | `:58` | bare `−0.4` / `+0.5`, **color-only** | `↓/↑ + word`, glyph not color-only |
| List "together" card | `DashboardsList.jsx:38` | hardcoded `−{lost} kg` on a pure win | `↓ 12.4 kg` (magnitude only) |
| Milestone chips 5%/10% | `MotivationCard.jsx:24,29` | `5% · −4.4kg` | `5% · ↓ 4.4 kg`, celebratory |
| Milestone-hit copy | `motivation.js:30` | "…`−{kg} kg`…" | words ("lost / ↓") |
| Projected-goal verdict | `DashboardBody.jsx:43` | "behind vs ideal" always in **good** color | tone follows meaning (see DEV-32) |

## New — recoverability & data entry
### DEV-20 · Forgiving streaks are demo-only — the grace/repair feature can never occur for a real user — `HabitsSection.jsx:21,73` (only writes 1/0), grace value `2` written **only** in `seed.js:117` — **P1/req (§6.4)**
"Streak repaired" / the grace-day cell / the legend all render for seeded data but a real user who misses a day just loses the streak — the opposite of §6.4 "a break is recoverable, never lost." Implement grace logic in `lib/habits.js`/`setHabitMark` (auto-grace a single missed day between done days, or a manual "use a grace day") so value `2` is produced in-app.

### DEV-21 · Back-dating gaps for habits & wins — **P2/req (§5)**
Habit check-off supports back-dating but is silently capped at **28 days** and can't reach a picker (`HabitsSection.jsx:17,31` clamp `offset` to `[0,27]`); NSV/win notes are hard-pinned to **today** (`DashboardBody.jsx:132`) while showing an editable-looking date pill (`:141`). §5 says "any date." Add a date picker (reuse QuickLog's) to habit check-off and NSV compose, or confirm the 28-day limit is intentional and drop the misleading pill.

### DEV-22 · CSV importer robustness — **P2/req (§4) + P3**
- **Locale decimals corrupt weights** (`csv.js:56`, preview `AddWeight.jsx:145`): `Number(String(kg).replace(/[^\d.\-]/g,''))` turns `82,5` → `825` and `1,020` → `1020` — a silently wrong weight. Normalize decimal-comma→dot, strip thousands separators, reject multi-separator values as invalid.
- **No column override** (`AddWeight.jsx:156` renders detected columns as read-only text): §4 asks for a confirm/**override** step like the date-format one. `detectColumns` (`csv.js:38`) can also pick the same column for date & weight (single-column file → everything "invalid") with no explanation. Add column dropdowns; guard `dateIdx===weightIdx`.
- **In-file dupe policy** (`csv.js:59`): a repeated date is flagged as a "bad" row and the **first** (not last/correction) is kept. Treat as last-wins merge/notice, not an error that inflates "N need attention."

### DEV-23 · Bulk backfill row bugs — **P2**
Rows are keyed by date (`AddWeight.jsx:73`), so two rows on the same date collide React keys (state edits hit the wrong row); non-numeric weights are silently excluded from `filled` (`:58`) with no inline "invalid" marker. Key rows by a stable id; show per-cell validation.

### DEV-24 · Optimistic success counts ignore actual writes — `AddWeight.jsx:62,116` — **P2 (with DEV-5)**
Bulk/CSV toast "Saved N / Imported N" from the *input* length; `addWeights` returns a real count that callers discard, and there's no per-write catch, so a partial failure still shows success. Report actual results.

## New — accessibility (designer §4)
### DEV-25 · No `:focus-visible` anywhere → the app is not keyboard-navigable — `styles.css` (only `focus` hit is `:438 .weigh-field input{outline:none}`, which *removes* it) — **P1/a11y**
Even the natively-focusable buttons/links/inputs give a keyboard user no visible focus ring; this compounds every item below. Add a global `:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }` and never bare `outline:none` without a replacement.

### DEV-26 · Clickable cards are non-focusable `<div onClick>` — `DashboardsList.jsx:33` (DashCard), `:132` (create-card), public cards; verified live (`role=null, tabIndex=null`) — **P1/a11y (designer §4)**
No `role="button"`/`tabIndex`/Enter+Space handling. Wrap the card body in a real `<button>`/`<Link>`, or add the role/tabIndex/onKeyDown pattern.

### DEV-27 · Modals have no Escape, focus-trap, initial/return focus, or dialog role — `Modal.jsx:4-19,22-37`, `QuickLog.jsx:44` scrim, `Layout.jsx:75` dropdowns — **P1/a11y**
Verified live: Escape dismisses nothing. Tab escapes behind the modal; focus isn't moved in on open or restored on close (except QuickLog's weight input); no `role="dialog"`/`aria-modal`/`aria-labelledby`. Centralize Escape + focus-trap + initial/return-focus + dialog roles in `Modal`/`Confirm` and reuse for QuickLog's private scrim.

### DEV-28 · Non-semantic switches & segmented controls — **P2/a11y (designer §4)**
The public read-only-link toggle is a bare clickable `<span>` (`ShareModal.jsx:88`) — the app **already has** a semantic `<Toggle>` (`ui.jsx`, sets `role="switch"`/`aria-checked`); use it. `RoleSeg` (`ShareModal.jsx:11`), the **duplicated** segmented control in `CreateDashboard.jsx:54`, the layer toggles (`DashSettings.jsx:29`) and date-chips (`QuickLog.jsx:63`) convey selected state by **color only** (`class="on"`), no `aria-pressed`/`radiogroup` and no non-color cue. Model as `radiogroup`+`aria-checked`, add a checkmark/bold indicator, and extract the one `RoleSeg` into `ui.jsx` so the fix isn't applied twice.

### DEV-29 · Icon-only controls, account chip, and the chart lack accessible names — **P2/a11y**
Icon-only buttons rely on `title=` (a tooltip, not an accessible name): settings (`DashboardDetail.jsx:45`), notifications bell (`Layout.jsx:70`) — add `aria-label` and mark `Icon` `aria-hidden` by default. The account chip has `role="button" tabIndex={0}` but **no key handler** (`Layout.jsx:47`) — the "good pattern" cited by the designer is itself incomplete; add Enter+Space. The Chart `<Line>` (`Chart.jsx:143`) has no `role`/`aria-label`/text alternative and its legend toggles (`:129`) lack `aria-pressed`.

### DEV-30 · Contrast below AA on muted text — **P3/a11y**
`--muted #9aa0a6` ≈ 2.6:1 on white is used for real text (sidebar email `Layout.jsx:51`, "Updated {date}" `DashboardsList.jsx:47`, most `.muted small`, input placeholders); `.tag.view` text ≈ 4.3:1 borderline. Darken `--muted` toward `--text-2` for text (keep the light shade for dividers/dots only).

## New — chart & numeric honesty
### DEV-31 · Ideal line + goal band are hidden until 14 days of data — `DashboardBody.jsx:236` (`goal={days>=14 ? g : null}`), consumed `Chart.jsx:70,93` — **P1/correctness**
The whole goal object is gated on `enoughData`, so the **ideal descent line** and **goal band** (static references valid from day 1, and the user's primary "am I on the line?" cue, §6.1/§6.3) don't render for the first two weeks. Only the **projection fan** should be withheld early (Chart already gates it at `:56`). Pass the real `goal` to the chart always; keep the tiles' "need more data" lock.

### DEV-32 · Verdict/pace tone ignores meaning — `DashboardBody.jsx:43` — **P2 (extends DEV-19)**
The projected-goal verdict is always styled `delta-up` (good/teal) even when it says "behind vs ideal"; and the weekly-rate arrow should de-emphasize (muted) when the pace is unsafe-fast (designer §1). Drive tone from the verdict/pace, not a fixed class.

### DEV-33 · Chart legend advertises layers it isn't drawing — `Chart.jsx:134-139` — **P3/honesty**
The line-key always shows "Ideal" and "Projected" swatches even when there's no target date, the layer is toggled off, the trend is "away", or <14 days. Render each key entry on the same predicate that governs its dataset.

### DEV-34 · "Together" team stat is raw-endpoint, drops gainers, and is duplicated — `DashboardBody.jsx:164` + `DashboardsList.jsx:18` — **P2/honesty**
Both compute "lost together" as `last.kg - first.kg` summing only negatives, using **raw** endpoints (everything else uses the EMA trend) so one noisy weigh-in skews it, and a member who gained contributes 0 instead of offsetting (overstates net progress). Extract one helper in `lib/stats.js`, decide the honest definition (net trend delta), and use it in both places (also fixes the bare-`−` from DEV-19 #4 in one spot).

## New — collaboration & navigation
### DEV-35 · Accept/Decline invite is fire-and-forget at the call site — `DashboardsList.jsx:65-66` — **P2 (adjacent DEV-14)**
No `await`, no busy/disabled state, no error toast; on the DEV-14 partial-write the card silently reappears on the next coarse bus refetch, and the Accept button double-fires on double-click. Await with a disabled/busy state + error handling; pair with the DEV-14 atomic rewrite.

### DEV-36 · Landing auto-open is keyed per-tab, not per-auth-session — `App.jsx:24-34` (`sessionStorage 'wt_landed'`) — **P2 (§11.2)**
A returning user opening a fresh tab gets re-routed into a dashboard every time; and the flag isn't cleared on sign-out (`AuthContext.jsx:68`), so after logout→login-as-different-user in the same tab the new user lands on the list instead of their recent dashboard. Key the decision to the auth session/uid (clear `wt_landed` in `signOutUser`).

### DEV-37 · No NotFound route or error boundary — `App.jsx:49` (`*`→`Navigate to="/"`) — **P3**
A dead deep link (e.g. a deleted `/dashboard/:id`) silently bounces to the list with no message, and any render throw white-screens the app. Add a lightweight NotFound and a top-level error boundary.

## Cleanup
### DEV-38 · Dead / minor — **P3**
- `lib/habits.js:37-56` `combinedKind`/`doneCount`/`singleKind` are used only by tests, never the app (StreakGrid inlines its own) — wire or delete.
- `Progress` `mins` (`DashboardBody.jsx:49`) is an identity map; `need {mins[d.window]}d` can read `d.window`.
- QuickLog note field `autoFocus` (`QuickLog.jsx:74`) steals focus from the weight field when expanded — drop it or manage focus.
- Confirm whether `HabitsSection` rendering inside the "No weigh-ins yet" empty state (`DashboardBody.jsx:198`) is intended.

## Designer §2b — still the user's call (unchanged recommendation)
Confirmed the safety-net isn't built: `Toast` (`ui.jsx:31`) is display-only (no action slot). Recommend the **actionable Undo** ("Logged 83.2 kg · Undo") for add/edit/delete over a pre-add confirm dialog (which fights §4 "least clicks"), plus a **batch "Save N entries?" confirm** on Bulk backfill (CSV's preview already covers this), and the **"you already logged X for this day — update it?"** prompt (DEV-11). Keep explicit `Confirm` dialogs for destructive actions. Wiring Undo requires giving `Toast` an action affordance first.

## Revised suggested order (this pass)
Fold into the existing plan: **P0 unchanged** → **P1 now also includes DEV-20 (grace), DEV-25/26 (keyboard access), DEV-31 (ideal/goal line)** alongside the numeric-display fix (DEV-19) → **P2** (DEV-22/24/28/29/32/34/35/36, error states DEV-13) → **P3** (rest). Quickest high-value wins: the global `:focus-visible` rule (DEV-25, ~3 lines) and reading `error`/`reload` for the retry cards (DEV-13).
