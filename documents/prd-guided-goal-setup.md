# PRD — Guided Goal Setup at Dashboard Creation (+ auto-derived team goal)

**Date:** 2026-07-31 · **Author:** Product · **For:** Design + Engineering · **Master spec:** `requirements.md` (this folder)
**Status:** Draft for build planning

---

## 1. Summary

Today, creating a dashboard is a thin form (name + a free-text "team goal" + a combined target-kg number) and a person's **starting weight is inferred from their first weigh-in** with no explicit start date. We're replacing this with a **guided, data-aware goal-setup flow** that:

1. captures an explicit **start date** and **start weight** for the journey,
2. makes **date of birth + height** a required profile step (so we can advise),
3. **helps the user pick a realistic target weight** (suggests their healthy range),
4. **helps the user pick a realistic target date** (suggests a date at a safe pace; if they change it, shows the rate that date implies and whether it's safe),
5. and **derives the shared team goal automatically** from members' individual goals — removing the manual team-goal / combined-target-kg entry entirely.

**The journey direction is not assumed.** Everything below must work for **weight loss, weight gain, and weight maintenance.**

**Non-goals:** not medical advice (guidance only); no calorie/macro tracking; no change to the self-only weight model (you still only log your own weight); habits/motivation/chart internals are unchanged except where they consume the new start date/direction.

---

## 2. Why

- Users arrive in two states — *"already started"* or *"about to start."* A single start-date field serves both (past date = already underway; today = starting now).
- People set unrealistic targets and timelines. Two lightweight helpers (healthy range + required-pace) turn a blank field into an informed choice, and let us warn on unsafe plans (§6.6 safety).
- A free-text "team goal" and a hand-entered combined kg are error-prone and drift from reality. When each member sets their own real goal, the team goal is **derivable** — one source of truth, no manual upkeep (aligns with the project's *derive-don't-store* principle).

---

## 3. Creation flow (Design)

A **guided stepper** replaces the current one-shot `CreateDashboard` modal. Recommended as a modal wizard with a step indicator (it stays a modal per REQUIREMENTS §11.6; if it feels too tall, a focused full-screen flow is acceptable). Steps:

**Step 0 · Name** — dashboard name (as today). Invite can happen here or at Review (Step 6).

**Step 1 · Profile check (gate)** — if the creator's profile is missing **date of birth** or **height**, show an inline mini-form to capture both. **Mandatory** — can't proceed without them. Copy: *"We use your height to suggest a healthy target range."* If both already present, skip this step silently.

**Step 2 · Start date** — *"When did your journey start?"* Date picker, **defaults to today**, **max = today (no future dates)**. Helper text: *"Pick a past date if you've already begun, or today to start now."*

**Step 3 · Start weight** — *"What did you weigh on {startDate}?"*
- If a weigh-in **already exists for that exact date**, prefill it and label it *"from your logged data"* (editable — editing corrects that entry).
- If none exists, the user enters it; on Create this is **saved as a normal weigh-in** for that date (self-only), so there's no separate "start weight" copy to drift (see §7).

**Step 4 · Target weight** — number input, with the **healthy-range helper** (§4.1):
- Show *"A healthy weight for your height is **{lo}–{hi} kg**."*
- Auto-detect and show the **direction** ("This is a weight-loss / weight-gain / maintenance goal") from start vs target.
- Warn if the target falls outside the healthy range (tone depends on direction — see §4.1).
- Optional one-tap **"Use healthy target"** (fills the nearest healthy bound).

**Step 5 · Target date** — date picker, **defaulting to the suggested date** at a safe pace (§4.2):
- Below it, a live line: *"To reach {target} kg by {date}, that's about **{rate} kg/week** — {verdict}."*
- If the user moves the date **earlier**, the rate rises; if it crosses the safe threshold, show the **amber "faster than safe pace"** warning (§6.6). Later date → gentler rate.
- **Maintenance** goals show a band + horizon instead of a rate (§5).

**Step 6 · Review & create** — summary card: direction, {startWeight} → {target} over {start date}→{end date}, the implied weekly rate + safe/aggressive badge, and healthy-range status. **Create** (and send invite if entered). Land on the new dashboard.

**Joining a dashboard (invitee):** on accepting an invite, the invitee runs **Steps 1–5 for themselves** (their own start date, start weight, target, end date). The dashboard now holds two individual goals and the **team goal derives automatically** (§8). Copy on entry: *"Set your own goal for {dashboard} — this is how you two get a shared goal."*

**States to design:** the profile-gate mini-form; start-weight *prefilled* vs *empty*; the healthy-range hint (in-range / below / above); the pace line in its **ok / aggressive / very-gradual / maintenance** variants; the review summary; and the invitee variant of the flow.

---

## 4. The two helpers (the core of this feature)

### 4.1 Target-weight helper — healthy range
- Compute the healthy band from **height** only (BMI 18.5–24.9): `[lo, hi] = [round(18.5·h²), round(24.9·h²)]` — the app already has `healthyRange(heightM)` (`application/src/lib/health.ts:17`).
- Direction from start vs target (see §5).
- **Evaluate the target against the band** and message accordingly:
  | Target vs band | Message | Tone |
  |---|---|---|
  | within `[lo,hi]` | "Within your healthy range 👍" | good |
  | below `lo` | "Below the healthy range — that's underweight territory." | warn (esp. for a *loss* goal) |
  | above `hi` | For a *loss* goal still above healthy: "Still above the healthy range — a solid first target." (gentle). For a *gain* goal overshooting: "Above the healthy range." (warn) |
- Never block; it's guidance. Always pair with the "not medical advice" note.

### 4.2 Target-date & pace helper
Let `distance = |target − startWeight|`, `weeks(a,b) = daysBetween(a,b)/7`.

- **Suggested end date** — pre-filled at a safe pace **by direction: loss → 0.5 kg/week, gain → 0.25 kg/week (lean gain)**. `endDate = startDate + ceil(distance / rate) weeks`. This is the pre-filled value in Step 5.
- **When the user changes the date**, compute the **required rate** = `distance / weeks(startDate, endDate)` (kg/week) and show a verdict:
  | Required rate | Verdict | Tone |
  |---|---|---|
  | ≤ 1.0 kg/wk **and** ≤ 1%/wk of body weight | "within the safe range" | ok |
  | > 1.0 kg/wk **or** > 1%/wk | "faster than the safe 0.5–1.0 kg/week range" | **warn (amber)** |
  | ≪ 0.5 kg/wk | "very gradual — that's fine" | muted |
- **Direction-specific safe ceiling:** warn above **1.0 kg/wk** for loss, above **0.5 kg/wk** for gain (lean-gain), and above **1%/wk** of body weight either way.
- The **rate is the plan average** over `start→end` (this is also what anchors the chart's ideal line, §5). For dashboards started in the past with logged progress, optionally also surface a secondary *"~{r} kg/wk needed from today"* line — nice-to-have, not required for v1.
- Copy is **direction-aware**: "…you'd **lose** ~{r} kg/week" / "…you'd **gain** ~{r} kg/week".

*(Note: the existing `paceCheck` in `health.ts:43` is loss-only — it computes `lose = current − target`. It must be generalized — see §9.)*

---

## 5. Direction: loss / gain / maintenance (cross-cutting)

Direction is **auto-detected, not asked**, then shown for confirmation.

- `direction(startKg, targetKg)`: `loss` if `target ≤ start − T`; `gain` if `target ≥ start + T`; else `maintain`. Default threshold **T = 1.0 kg** (open to tuning — §12).
- **Loss:** target below start. Safe pace 0.5–1.0 kg/wk. Healthy-range warning triggers if target < `lo`.
- **Gain:** target above start. Same helper, "gain" wording. Warn if target > `hi`. **Uses the lean-gain pace — suggest 0.25 kg/wk, warn above 0.5 kg/wk** (gentler than loss, to favor lean mass).
- **Maintenance:** target ≈ start. No rate; the "target date" becomes a **maintenance horizon** (how long to hold, default e.g. 12 weeks), and success = staying within a **± band** (reuse the goal-band concept, e.g. ±1–2 kg). Pace helper shows *"Maintain around {t} kg (±{band}) — we'll flag drifts."*

Direction must flow through: the pace/date helper, the healthy-range copy, the chart **ideal line** (now `start→target`, any slope — up, down, or flat), on-track/ahead/behind verdicts, and the derived team goal (§8). All the health-lib helpers must stop assuming loss (§9).

---

## 6. Profile prerequisites (DOB + height)

- **Height** already exists on the profile (`types.ts` `Profile.heightM`, currently optional). **Date of birth** is **new**.
- Both become **required to create or join a dashboard** (enforced in the wizard gate, Step 1 — not necessarily required to merely have an account).
- **Store DOB, derive age** (decided) — DOB is stable, a raw age drifts.
- **Use:** the healthy-range suggestion is **height-based** (BMI); DOB/age is captured for profile completeness and future age-aware guidance (e.g., BMR/estimated targets). It does **not** drive the range today, so it needn't be surfaced in the target helper.

---

## 7. Start date & start weight

- **Start date:** any date `≤ today`; no future. Stored on the goal as `startISO` (new — see §9).
- **Start weight:** it is simply **the user's weigh-in on `startISO`** — not a separate stored number:
  - exists for that date → prefill from the log;
  - doesn't exist → user enters it and it's written as a normal `WeightEntry {date: startISO, kg, note}` on Create (self-only).
- This preserves the codebase's deliberate **single-source-of-truth** design (see the `Goal` comment in `types.ts:50-54`: no stored `startKg`) and the *derive-don't-store* principle — `startKg` is always read from the entry at `startISO`, so editing/deleting that weigh-in stays consistent.
- Matching is by **exact date** (decided): if a weigh-in exists on `startISO`, prefill it; otherwise the user enters the start weight (no nearest-date snapping).

---

## 8. Shared team goal — auto-derived (replaces manual entry)

### 8.1 Remove the manual mechanism
Delete team-goal *entry* everywhere:
- `CreateDashboard.tsx` — the `goal`/`target` state and the "Shared team goal" + "Target (kg)" inputs (lines ~17-18, 29, 45-54).
- `GoalEditor.tsx` — the `team` state, the team-goal UI + combined-target input, and the clear-team `Confirm` (lines ~62-63, 71, 79-82, 95-102, 106-112).
- `types.ts` — `TeamGoal` (60-63), `Dashboard.teamGoal` (137), `PublicView.teamGoal` (168).
- All `teamGoal` reads/writes in the data layer + mutations (`hooks/mutations.ts`, `data/firestore.ts`, `data/memory.ts`, `data/seed.ts`) and any render of it (`DashboardBody`, `DashboardsList` card stat).

### 8.2 Derive it instead
Add `deriveTeamGoal(members, goals, series)` (in `lib/dashboards.ts`) computed **on read** (derive-don't-store — [[weighttracker-engineering-principles]]):
- **Appears only when ≥2 members have goals.** A solo dashboard has no team goal (personal journey until someone joins).
- **Combined magnitude across all members, any direction** (decided): `targetKg = Σ |target_i − start_i|` — add every member's absolute change, whether they're losing or gaining. `progressKg = Σ clamp(movement-toward-target_i, 0, |target_i − start_i|)`; `pct = progressKg / targetKg`. Shared date = the **latest** member end date.
- **Label by mix:** all losing → `"Lose {targetKg} kg together"`; all gaining → `"Gain {targetKg} kg together"`; **mixed → `"{targetKg} kg of combined change together"`**.
- Maintainers (≈0 change) contribute ≈0 — they don't move the number, which is fine.

This is what the user meant by *"we detect the shared team goal"* — the second member entering their own start/end/weights is exactly the input the derivation needs.

---

## 9. Data model & logic changes (Engineering)

**Profile** (`types.ts`): add `dob: string | null` (`'YYYY-MM-DD'`; derive age via a helper). Wire into `Profile.tsx` form + `useUpdateProfile` + `updateProfile` in `data/firestore.ts` & `data/memory.ts`. Enforce **height + DOB present** in the create/join wizard gate.

**Goal** (`types.ts`): add **`startISO: string`** (the journey start date). Keep `targetKg`, `targetISO`. **Do not** add a stored `startKg` — derive it from the weigh-in at `startISO` (extend the existing derivation in `DashboardBody.tsx` `goalFor`, which currently uses the first weigh-in). **Direction is derived**, not stored.

**Remove** `TeamGoal` type, `Dashboard.teamGoal`, `PublicView.teamGoal` and all read/writes (§8.1).

**`lib/health.ts` — make direction-aware** (it is currently loss-only):
- `paceCheck` (`:43-61`) — generalize `lose = current − target` to signed distance; handle gain and maintenance; return the direction-aware line.
- `goalProgress` (`:28-32`) — handle `start→target` in either direction (and a maintenance "in-band" notion).
- `verdictVsIdeal` (`:66-82`) — already start-anchored; make the ahead/behind sign correct per direction.
- `idealLine` (`:85-93`) — anchor at **`(startISO, startKg) → (targetISO, targetKg)`** instead of `today → target`.
- **Add:** `journeyDirection(startKg, targetKg, T=1)`, `suggestTargetDate(startISO, startKg, targetKg, rate=0.5)`, `requiredRate(startISO, endISO, startKg, targetKg)`, `evaluateTargetVsHealthy(targetKg, [lo,hi], direction)`.

**`lib/dashboards.ts`:** add `deriveTeamGoal(...)` (§8.2).

**Migration / back-fill:** existing goals have no `startISO` and dashboards carry `teamGoal`. Back-fill `startISO` = the member's **first weigh-in date** (matches today's behavior), and **drop** `teamGoal` (it becomes derived). Update `data/seed.ts` demo data to the new shape. Confirm `firestore.rules` still validates the new `goals`/profile fields (goals are dashboard-level → editor-writable; age is on the user's own profile → owner-write).

---

## 10. Edge cases
- **No weigh-in on the start date** → user enters it (§7); becomes a real weigh-in.
- **Start date in the past, already logged progress** → suggested end date + ideal line anchor at start; the dashboard's existing ahead/on-track/behind logic reports progress-relative status; optionally show "needed from today."
- **Target ≈ current** → maintenance (§5); no rate; band + horizon.
- **Target outside healthy range** → warn per §4.1, never block.
- **Only one member** → no team goal yet (§8.2).
- **Members with different directions or timelines** → mixed-direction team framing (§8.2).
- **Editing the goal later** (via the goal editor) → same helpers; changing `startISO` re-points `startKg` to a different weigh-in (create one if that date has none).
- **Deleting the weigh-in on the start date** → `startKg` becomes unavailable; prompt the user to set a start weight (don't silently break the ideal line).
- **Same-date overwrite** at start-weight entry → prefill the existing entry rather than overwrite (ties to the earlier DEV-11 fix).

## 11. Safety
- Healthy range and pace are **guidance, not medical advice** — keep the disclaimer on the flow. Flag aggressive pace (> 1.0 kg/wk or > 1%/wk) and out-of-range targets. Crash-diet/underweight targets get a gentle warning, never a block.

## 12. Decisions (confirmed by stakeholder 2026-07-31)
1. **Store date of birth**, not a raw age (derive age). DOB + height required to **create/join** a dashboard (not merely to have an account).
2. **Gain uses the lean-gain pace** — suggest **0.25 kg/wk**, warn above **0.5**. Loss stays suggest **0.5** / warn above **1.0**. Both warn above **1%/wk** of body weight.
3. **Maintenance** = `|target − start| ≤ 1 kg`, held within a **±1–2 kg** band.
4. **Team goal = `Σ |target − start|` across all members** — add every member's absolute change, mixed directions included (see §8.2).
5. **Start weight** = the weigh-in on the **exact** start date if present, else user-entered (no nearest-date snapping).

## 13. Out of scope (future)
Calorie/macro/BMR planning; multi-metric goals (waist, body-fat); re-planning nudges when a user falls behind; imperial units.
