# Handover — Guided Goal Setup + Auto-Derived Team Goal

**Date:** 2026-07-31 · **From:** Product · **To:** Design + Engineering · **Status:** Ready to build (decisions locked)
**Full spec:** `prd-guided-goal-setup.md` · **Master spec:** `requirements.md` §6.3 · **App:** `application/` (TypeScript)

This is the build handover. The PRD has the full detail and edge cases; this doc is the locked decisions, the split of work between Design and Engineering, acceptance criteria, and a build order.

---

## 0. Locked decisions (confirmed by stakeholder 2026-07-31)

1. **Store date of birth** (not a raw age) → derive age when needed. DOB + height are **required before creating or joining a dashboard**.
2. **Pace by direction:** **loss** suggests **0.5 kg/week** (warn above 1.0); **gain** uses the **lean-gain pace — suggest 0.25 kg/week, warn above 0.5**; both also warn above **1%/week** of body weight.
3. **Maintenance:** `|target − start| ≤ 1 kg` → maintenance; success = staying within a **±1–2 kg band** over a horizon (no target rate).
4. **Team goal = sum of every member's absolute change** `Σ |target − start|`, across **all** members regardless of direction (some may be losing, some gaining — add the magnitudes).
5. **Start weight:** use the weigh-in **on the exact start date** if it exists; otherwise the user enters it (and it's saved as a normal weigh-in). No nearest-date snapping.

---

## 1. What we're building (one paragraph)

Replace the thin "name + free-text team goal + combined kg" create form with a **guided, data-aware goal-setup wizard**. It captures an explicit **start date + start weight**, gates on a complete profile (**DOB + height**), then helps the user pick a realistic **target weight** (suggests their healthy range) and **target date** (suggests a safe-pace date; if they change it, shows the implied rate and whether it's safe). Everything works for **loss, gain, and maintenance**. The **shared team goal is derived automatically** from members' individual goals — the old manual team-goal entry is removed.

---

## 2. Designer — deliverables

Build a **guided stepper** (modal per `requirements.md` §11.6; a focused full-screen flow is acceptable if it's too tall). Design each step **and its states**.

| Step | Content | States to mock |
|---|---|---|
| 0 · Name | Dashboard name (+ optional invite, here or at Review) | default |
| 1 · Profile gate | If **DOB or height** missing → inline mini-form (both mandatory). Skip silently if present. Copy: *"We use your height to suggest a healthy target range."* | missing-both / missing-one / (skipped) |
| 2 · Start date | *"When did your journey start?"* Date picker, **defaults to today, max = today**. Helper: *"Pick a past date if you've already begun, or today to start now."* | today / past date |
| 3 · Start weight | *"What did you weigh on {startDate}?"* | **prefilled** ("from your logged data") vs **empty** (enter) |
| 4 · Target weight | Number input + **healthy-range helper** *"A healthy weight for your height is {lo}–{hi} kg"*; show detected **direction**; warn if out of range | in-range / below-range / above-range · loss / gain / maintenance |
| 5 · Target date | Date picker **pre-filled at safe pace**; live line: *"To reach {t} kg by {date}, that's ~{r} kg/week — {verdict}."* | ok / **aggressive (amber)** / very-gradual / **maintenance (band, no rate)** · loss vs gain copy |
| 6 · Review & create | Summary: direction, {start}→{target} over {dates}, weekly rate + safe badge, healthy-range status. Create (+ invite). | default |

**Also design:**
- **Invitee flow:** on accepting an invite, the invitee runs Steps 1–5 for **themselves**. Entry copy: *"Set your own goal for {dashboard} — this is how you two get a shared goal."*
- **Derived team-goal card** on the dashboard (replaces the old manual one). Three label variants (see §4): all-loss, all-gain, mixed. Appears only at **≥2 members with goals**; a solo dashboard shows no team card.
- **Edge/empty states:** no weigh-in on start date; target outside healthy range (gentle warning, never blocks); start weight missing later (prompt, don't break the chart); "already logged for this date → update it?" instead of silent overwrite.

**Designer acceptance criteria**
- [ ] All 7 steps + the listed state variants are mocked, for **loss, gain, and maintenance**.
- [ ] The pace line clearly distinguishes **ok / aggressive / very-gradual / maintenance**, with loss vs gain wording.
- [ ] Healthy-range hint has in-range / below / above treatments.
- [ ] Invitee flow + the 3-variant team-goal card.
- [ ] "Not medical advice" present on the flow.
- [ ] Nothing blocks the user on a warning (guidance only).

---

## 2A. Design considerations — build it so a first-timer can't get lost (Design → Engineering)

> Added by Design, 2026-07-31. This section is **normative for the developer**: it turns §2's step list into concrete interaction, copy, default, and component-reuse rules. **North star:** a naive user who has never set a fitness goal should be able to finish by *accepting the suggestions* — the safe, healthy plan is the path of least resistance, and typing is limited to name + their weights. Everything is guidance; nothing punishes.

### A. Wizard shell (global behaviour)
- **One modal, reuse `Modal` + `useDialogA11y`** (Escape-to-close with a dirty-guard, focus trap, initial focus, `role="dialog"`, `aria-labelledby` = the step title). If the tallest step exceeds the viewport (mobile), promote to a **full-screen sheet** with a sticky footer — same component API, `width:'100%'`. Do **not** invent a new dialog.
- **Honest, self-sizing step indicator.** Show `Step X of N` + a slim progress bar, where **N is the count of steps *this* user will actually see** — compute the visible set up front (the profile gate, Step 1, is skipped for a complete profile; invitees skip Step 0). Never show "Step 1 of 7" and then silently jump. Mark the current dot `aria-current="step"`.
- **One decision per step, one primary button.** Footer = `Back` (ghost, left, hidden on the first visible step) + a single primary (right): **`Continue`** on steps 0–5, **`Create dashboard`** on Review. `Enter` submits the step when its required field is valid. Never two competing primaries on a step.
- **Warnings never block.** `Continue` is disabled **only** for a genuinely missing/invalid required value (name; DOB+height; a parseable start weight; a parseable target). Out-of-range target and aggressive pace are **informational** — the button stays enabled. (Acceptance §2 already says this; enforce it at the button-`disabled` level.)
- **Back/Next preserves state**; re-entering a step never wipes what the user typed. Changing an upstream value (start weight / target) **recomputes downstream *suggestions*** (suggested target date) **only while the user hasn't overridden them** — once they hand-pick a target date, don't silently move it; show a subtle "suggestion changed — reset?" affordance instead.
- **Autofocus the step's main input** on entry (reuse QuickLog's 30 ms focus-and-select for numeric fields, `QuickLog.tsx:59-62`); move focus to the step `<h2>` on Back/Next and expose an `aria-live="polite"` line ("Step 3 of 5 · Start weight") for screen readers.
- **Plain language, no jargon.** Never surface "BMI", "EMA", "1%/wk ceiling", "kg/wk" without translation. Prefer "a healthy weight for your height", "about half a kilo a week", "a comfortable, steady pace". Numbers spelled friendly: `~0.5 kg/week` may render, but pair it with words.
- **Persistent, quiet disclaimer.** "Not medical advice — guidance to help you set a realistic goal." in the modal footer (muted, small) on every step; not a blocking interstitial.

### B. Per-step design notes (augments the §2 table — implement to these)

| Step | The single decision | Default (accept-and-go) | Reuse / input pattern | Microcopy (ready to use) | Naive-user pitfall → how this avoids it |
|---|---|---|---|---|---|
| **0 · Name** | Name the dashboard | empty (required) | plain `.input`, `autoFocus` | Label: "Name your dashboard". Placeholder: "e.g. Me & Priya, or Summer cut". Helper: "Just a label — you can rename it later." Keep **invite deferred to Review** (don't crowd step 0). | Blank-field paralysis → example placeholder + "it's just a label". |
| **1 · Profile gate** | DOB + height | — (required, no skip) | DOB = native `<input type=date>` (`max=today`); height = numeric `inputMode="decimal"` with a **`m` suffix** like the kg field | Title: "First, two quick details". Sub: "We use your height to suggest a healthy range — never shared." Height helper: "Your height in metres, e.g. 1.78". | Feels like an interrogation / privacy worry → one-line "why", reassurance, and it's skipped entirely when already known. |
| **2 · Start date** | Today, or a past date | **Today** | **Segmented `SegRadio`: "Starting today" / "I already started"** — the second reveals a native date picker (`max=today`). Hides the calendar from the ~majority who start today. | "When did your journey start?" · "Pick a past date if you've already begun, or start today." Under it: "This is day one of your chart." | Doesn't know why a date matters, or fumbles a calendar → default handles most; calendar only appears if needed. |
| **3 · Start weight** | Your weight on that day | **prefill** if a weigh-in exists on the date, else last-known as placeholder | **Reuse the QuickLog weight input verbatim** (big number, ± 0.1 steppers, `kg` suffix, decimal pad). Use `classifyEntries` (`lib/collisions`) so a change to an existing date routes through the **"already logged / overwrite?"** `Confirm`, never a silent overwrite. | If prefilled: chip "from your logged data · {date}" + "Editing this corrects that weigh-in." If empty: "We'll save this as your weigh-in for {date}." | Fears it creates a duplicate / a separate "start number" → copy states it *is* a normal weigh-in (single source of truth, §7). |
| **4 · Target weight** | Your goal weight | none typed, but **"Use a healthy target"** one-tap chip fills the nearest healthy bound | Reuse the weight input. Below it: healthy-range line + direction sentence + the one-tap chip. | Range: "A healthy weight for your height is **{lo}–{hi} kg**." Direction: "That's a weight-**loss** goal." / "…weight-**gain** goal." / "You're aiming to **maintain**." Chip: "Use a healthy target". | Sets an extreme number → the range hint + gentle, non-blocking warning (see D) + a zero-typing healthy option. |
| **5 · Target date** | By when | **suggested safe-pace date** pre-filled | Date picker **plus quick nudge chips "At a safe pace" (default) · "Sooner" · "Later"** (shift by a few weeks) so a naive user never has to reason about dates. One live pace sentence + a verdict pill below. | "To reach {t} kg by {date}, that's about **{r} kg a week** — {verdict}." Verdict pill: **"a safe, steady pace"** (teal) / **"faster than we'd suggest"** (amber) / "nice and gradual" (muted) / maintenance: "hold around {t} kg (±{band})". Foot: "You can change this any time." | Picks an unrealistic date → default is already safe; amber verdict warns without blocking; nudge chips replace date math. |
| **6 · Review & create** | Confirm | — | Read-only summary that **visually mirrors the dashboard's own goal card** (no surprise post-create) + `Role/invite` row | One plain sentence: "You'll go from **{start} kg → {target} kg by {date}** — about **{r} kg a week** ({safe/aggressive})." Direction badge + healthy-range status + safe-pace pill. Foot: "You can edit any of this later from the dashboard." | Anxiety about "what did I just commit to / what happens next" → plain restatement + "editable later" + lands on the new dashboard. |

### C. The two helpers — present them as friendly suggestions, not tests
- **Healthy range (Step 4):** compute from `healthyRange(heightM)` (`lib/health.ts:17`). Render as a calm info line in the accent tint, **paired with the one-tap "Use a healthy target" chip** so the healthy choice costs zero typing. Never a red error.
- **Pace (Step 5):** always **one sentence + one verdict pill**, direction-aware, plain-number ("about half a kilo a week"). Never expose the formula or the "1%/wk" rule as text — encode it in the verdict only. Reuse `.pill` / `.pill.amber` and the `ChangeText` glyph pattern so the verdict is **never colour-only** (word + pill, a11y).

### D. Non-blocking warning treatment (used in Steps 4 & 5)
- Inline, below the field, coloured + worded, **`Continue` stays enabled**. Tone per PRD §4.1 / §4.2: in-range = quiet good ✓; below-healthy = amber caution ("that's under the healthy range — consider a higher target"); above-healthy on a *loss* goal = neutral encouragement ("still above healthy — a solid first target"); aggressive pace = amber ("faster than we'd suggest — later date = gentler"). **No warning is ever a dialog or a disabled button.** This is the difference between "guides a beginner" and "scolds a beginner."

### E. Derived team-goal card (dashboard) — remove the mystery
- It is **read-only and auto-derived** — there is no team-goal input anywhere (that's the whole point). Appears only at **≥2 members with goals**; show the three label variants (§4). Include a one-line explainer the first time it appears: "This adds up each person's goal — it updates as you each log." so a naive user doesn't hunt for where to "set" it.
- **Solo dashboard:** instead of hiding emptiness, show a gentle prompt card — "Invite someone to set a shared goal together" → opens the invite/Share modal. Turns the absent team goal into an obvious next action.

### F. Invitee flow — same wizard, lighter
- Reuse the identical stepper **minus Step 0 (name)** and with **no team-goal step** (derived). Open on a one-screen intro: "**{Inviter} invited you to {dashboard}.** Set your own goal — that's how you two get a shared goal." Then Steps 1–5 + a short Review ("Join & set goal"). Same components, same copy rules.

### G. Errors vs. warnings vs. empty (don't conflate — ties to DEV-13)
- **Warning** (out-of-range / aggressive) → inline, non-blocking (D).
- **Save/load failure** → reuse QuickLog's inline error pattern (rose text under the action, keep the modal open, re-enable the button, `finally`-reset busy — `QuickLog.tsx:133,142`); for a failed profile/weigh-in read use `ui.tsx` `RetryCard`. A transient failure must **never** read as "invalid input".
- **Same-date start weight** → `classifyEntries` + `Confirm` ("already logged … update it?"), never silent overwrite (PRD §10, DEV-11).

### H. Component-reuse map (so nothing is hand-rolled)
| Need | Reuse (don't rebuild) |
|---|---|
| Dialog shell, Escape, focus-trap, `role=dialog` | `Modal` + `useDialogA11y` (`Modal.tsx`) |
| Destructive / "already logged" confirm | `Confirm` (`Modal.tsx`) |
| Weight & start-weight number entry | the QuickLog weight-input block (`QuickLog.tsx:106-113`) |
| Segmented single-choice (start-today, role, pace-nudge) | `SegRadio` (`ui.tsx`) — accessible radiogroup, checkmark not colour |
| On/off (e.g. link toggle if reused) | `Toggle` (`ui.tsx`) |
| Direction+magnitude numbers (review, team card) | `ChangeText` / `formatChange` (`ui.tsx`, `lib/format`) |
| Load-failure card | `RetryCard` (`ui.tsx`) |
| Success confirmation | `Toast` (`ui.tsx`) |
| Same-date collision detection | `classifyEntries` (`lib/collisions`) |
| Healthy range / pace verdict | `healthyRange`, generalized `paceCheck` (`lib/health`) |
| Dates | `todayISO`, `addDays`, `fmtLong` (`lib/date`) |

### I. Naive-user acceptance criteria (add to §2's checklist)
- [ ] A first-timer can complete Create by **accepting every suggestion**, typing only the name and their weights — and the result is a safe, in-range plan.
- [ ] **No step presents more than one required decision**; the primary button label always says what happens next.
- [ ] **Every warning is non-blocking** and reassuring; `Continue`/`Create` is never disabled by a warning.
- [ ] Step indicator shows the honest, per-user step count (skipped steps not counted).
- [ ] Full keyboard path start→finish (Enter advances, Escape guards-then-closes, focus moves to each step heading); verdicts/warnings are word+shape, never colour alone.
- [ ] Works as a full-screen sheet on mobile with a sticky Back/Continue footer and native date/number inputs.
- [ ] Copy contains no un-translated jargon; the "not medical advice" line is present throughout.

---

## 3. Engineering — deliverables

### 3.1 Data model (`application/src/types.ts`)
- **Profile:** add **`dob: string | null`** (`'YYYY-MM-DD'`). Derive age with a helper. Keep `heightM`. Enforce **DOB + height present** in the wizard gate (not necessarily to have an account).
- **Goal:** add **`startISO: string`** (journey start date). **Do not** store `startKg` — derive it from the weigh-in at `startISO` (extend `DashboardBody.tsx goalFor`, which today uses the first weigh-in). Direction is derived, not stored.
- **Remove** `TeamGoal` type, `Dashboard.teamGoal`, `PublicView.teamGoal`, and all reads/writes (see §5 removal list).

### 3.2 Direction-aware health logic (`application/src/lib/health.ts` — currently loss-only)
- Generalize `paceCheck` (`:43-61`, today `lose = current − target`), `goalProgress` (`:28-32`), `verdictVsIdeal` (`:66-82`), and `idealLine` (`:85-93` → anchor at **`(startISO,startKg) → (targetISO,targetKg)`**, not today→target).
- Add:
  - `journeyDirection(startKg, targetKg, T=1)` → `'loss' | 'gain' | 'maintain'`.
  - `suggestTargetDate(startISO, startKg, targetKg)` → uses **0.5 kg/wk for loss, 0.25 kg/wk for gain**; maintenance → no date (horizon default, e.g. +12 wk).
  - `requiredRate(startISO, endISO, startKg, targetKg)` → `|Δ| / weeks`.
  - `paceVerdict(rate, direction, bodyKg)` → ok / warn using **loss ceiling 1.0**, **gain ceiling 0.5**, both warn above **1%/wk**.
  - `evaluateTargetVsHealthy(targetKg, [lo,hi], direction)` → in-range / below / above (+ tone).

### 3.3 Derived team goal (`application/src/lib/dashboards.ts`)
Add `deriveTeamGoal(members, goals, series)`, computed **on read** (derive-don't-store — [[weighttracker-engineering-principles]]):
- Include only members that have a goal; **appears at ≥2**.
- `targetKg = Σ |targetKg_i − startKg_i|` (all members, any direction).
- `progressKg = Σ clamp(movementTowardTarget_i, 0, |targetKg_i − startKg_i|)`; `pct = progressKg / targetKg`.
- Shared date = **latest** member `targetISO`.
- Label: all-loss → `"Lose {targetKg} kg together"`; all-gain → `"Gain {targetKg} kg together"`; **mixed → `"{targetKg} kg of combined change together"`**.

### 3.4 Wizard wiring
- The create + invitee flows write: the creator's/joiner's `Goal {startISO, targetKg, targetISO}` onto the dashboard, and (if the start-date weigh-in was missing) a `WeightEntry {date: startISO, kg, note}` to the user's own weight history (self-only).
- Start-weight fetch: look up the weigh-in with `date === startISO`; prefill if found, else collect + create.
- DOB + height captured via `useUpdateProfile` / `updateProfile` (`data/firestore.ts` + `data/memory.ts`).

### 3.5 Migration & housekeeping
- Back-fill existing goals: `startISO` = the member's **first weigh-in date** (matches current behavior). **Drop** `teamGoal` (now derived). Update `data/seed.ts` demo data to the new shapes.
- Confirm `firestore.rules`: `dob` is on the user's own profile (owner-write); goals stay dashboard-level (editor-writable). (Note: the rules also have open **security fixes** from the earlier dev review — see `app-feedback-developer.md`; not part of this feature but adjacent.)

**Engineering acceptance criteria**
- [ ] `Profile.dob` + `Goal.startISO` added; `startKg` still derived (no stored copy); `teamGoal`/`TeamGoal` fully removed.
- [ ] `lib/health.ts` produces correct pace/verdict/ideal-line/progress for **loss, gain, and maintenance** (add unit tests alongside the existing 49).
- [ ] `deriveTeamGoal` returns the Σ|diff| total + correct label for all-loss / all-gain / mixed, and nothing for a solo dashboard.
- [ ] Suggested date uses 0.5 (loss) / 0.25 (gain) kg/wk; editing the date recomputes the rate + safe/aggressive verdict live.
- [ ] Start weight is fetched by exact date or created; no silent overwrite of an existing entry.
- [ ] Migration back-fills `startISO` and drops `teamGoal`; demo/seed updated; build + tests clean.

---

## 4. Team-goal derivation — worked example
Parth: start 88 → target 80 (loss, Δ 8). Priya: start 55 → target 58 (gain, Δ 3). Mixed directions →
**target = 8 + 3 = 11 kg of combined change**, shared date = the later of the two target dates.
If Parth is at 84 (moved 4 of 8) and Priya at 56 (moved 1 of 3): progress = 4 + 1 = **5 / 11 kg (45%)**.

---

## 5. Removal list (the old manual team goal — delete these)
- `components/CreateDashboard.tsx` — `goal`/`target` state, the "Shared team goal" + "Target (kg)" inputs, and the `teamGoalLabel`/`teamGoalTarget` args to `useCreateDashboard`.
- `components/GoalEditor.tsx` — `team` state, the team-goal UI + combined-target input, and the clear-team `Confirm`.
- `types.ts` — `TeamGoal`, `Dashboard.teamGoal`, `PublicView.teamGoal`.
- `hooks/mutations.ts`, `data/firestore.ts`, `data/memory.ts`, `data/seed.ts` — all `teamGoal` reads/writes.
- Any render of `teamGoal` (`DashboardBody`, `DashboardsList` card) → switch to `deriveTeamGoal`.

---

## 6. Build order (suggested)
1. **Data model + health lib** (§3.1, §3.2) — with unit tests; unblocks everything.
2. **Derived team goal** (§3.3) + **removal** of the manual mechanism (§5).
3. **Wizard UI** (§2 / §3.4) — create flow, then invitee flow.
4. **Migration + seed + edge/QA** (§3.5) and the empty/error/maintenance states.

## 7. Out of scope (future)
Calorie/macro/BMR planning; multi-metric goals (waist, body-fat); re-planning nudges; imperial units.
