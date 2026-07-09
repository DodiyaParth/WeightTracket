# Design Instructions — Round 2: Complete Dashboard + All Journeys + Robustness

**Date:** 2026-06-30 · **From:** Product · **Spec:** `requirements.md`
**Reads after:** `design-designer-brief.md`, `design-feedback-r1.md`

This round we **build the full dashboard interior** (the part we kept as a placeholder before) and
make the **whole prototype robust** across every user journey. This **lifts the R1 deferrals** of the
motivation engine and the dashboard interior — they are now **in scope**.

### Ground rules (apply to everything below)
1. **Desktop only this round** (mobile is the next pass) — but build cards as self-contained blocks
   that will later stack into one column, so the mobile reflow is painless.
2. **Self-only weight** (from R1) holds everywhere: no "log for another person," ever.
3. **Reuse the existing components + tokens** in `styles.css` (cards, pills, buttons, segmented
   controls, toggles, progress bars, avatars, range-tabs). **Do not invent new styles** for things we
   already have. One fixed teal accent — no theme picker.
4. **Every data area must be designed in all of its states** (see Part C) — not just the happy, data-rich one.
5. This document is intentionally explicit about **what goes where**. Follow the layout map exactly
   unless you flag a reason not to.

---

# PART A — The complete Dashboard

## A0. Two variants you must deliver for the dashboard
The dashboard is viewed by three kinds of people. Design **two visual variants**; the third reuses the second.

| Who | Variant | Can do |
|---|---|---|
| **Editor** (you or your spouse) | **Full** | See everything; edit goals/habits/sharing; **add/edit *their own* weight**; check off *their own* habits; add NSV notes |
| **Read-only member** (signed in, read access) | **View-only** | See everything; **no** edit/add/check-off controls at all |
| **No-login link visitor** | **View-only** (same as above) + no app chrome | See everything; no sidebar/account; a "Sign in to track your own" CTA |

**View-only variant rules — hide ALL of these:** the `+ Add my weight` button, `Share`, the ⚙ settings,
`Edit goals`, `Add habit`, habit **check-off** controls, `Add` on Wins/NSV, and any edit/delete icons.
Replace the header actions with a **"View only"** badge. Keep the "Not medical advice" disclaimer.
The no-login version additionally has **no sidebar** and shows a small **"Sign in to track your own"** CTA in the header.

## A1. Page layout map (desktop) — follow this top → bottom

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HEADER:  Parth & Priya        [P][R avatars]      [⚙][Share][+ Add my weight]   │
│          Shared dashboard · you + Priya · you can edit                          │
├──────────────────────────────────────────────────────────────────────────────┤
│  [ Current weight ] [ Total change ] [ Weekly rate (⚠) ] [ Projected goal=range ]│   ← A3: 4 stat tiles
├───────────────────────────────────────────────┬──────────────────────────────┤
│  LEFT (main, ~2/3)                              │  RIGHT RAIL (~1/3)            │
│  ┌──────────────────────────────────────────┐  │  ┌────────────────────────┐  │
│  │ A4.1 Weight trend chart      [status pill]│  │  │ A5.1 Motivation         │  │
│  │  legend + per-person toggles · range tabs │  │  │  state + milestone bar  │  │
│  │  EMA lines · raw dots · proj/ideal/goal   │  │  │  + couple prompt        │  │
│  │  layer toggles                            │  │  └────────────────────────┘  │
│  └──────────────────────────────────────────┘  │  ┌────────────────────────┐  │
│  ┌──────────────────────────────────────────┐  │  │ A5.2 BMI & healthy band │  │
│  │ A4.2 Progress & prediction                │  │  │  per person             │  │
│  │  deltas 1/7/14/28d · projection (range)   │  │  └────────────────────────┘  │
│  └──────────────────────────────────────────┘  │  ┌────────────────────────┐  │
│  ┌──────────────────────────────────────────┐  │  │ A5.3 Wins (NSV) [+ Add] │  │
│  │ A4.3 Goals  (per-person + team)   [Edit]  │  │  └────────────────────────┘  │
│  └──────────────────────────────────────────┘  │   Not medical advice. (A5.4) │
├───────────────────────────────────────────────┴──────────────────────────────┤
│  A6. HABITS (full width)                                                        │
│  ┌─────────────────────────────┐   ┌────────────────────────────────────────┐  │
│  │ Today's checklist [+ Add]   │   │ Streak grid    [Week|Month]  per-person  │  │
│  └─────────────────────────────┘   └────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────┘
```

## A2. Header bar
- **Left:** dashboard name + subtitle that states the relationship and the viewer's role —
  e.g. *"Shared dashboard · you + Priya · you can edit"* (editor) or a **"View only"** badge (read-only).
- **Center/right:** overlapping **member avatars** (color-coded per person).
- **Right actions (editor only):** `⚙` (dashboard settings, A7) · `Share` (opens Share page) ·
  **`+ Add my weight`** (primary; opens Add-weight for **me**, never a person picker).

## A3. Stat-tiles row (4 tiles, left → right)
Tiles summarize **one focused person** (default = the viewer if they're tracked, else person 1); add a
small **person switcher** on this row when the dashboard tracks 2+ people.
1. **Current weight** — big number + unit; sub = "trend XX.X" (the EMA value).
2. **Total change** — since first entry; colored (loss = accent, gain = rose); sub = "since {date}".
3. **Weekly rate** — kg/wk; **this tile carries the safe-pace state:**
   - within 0.5–1.0 kg/wk → accent + "within safe range";
   - faster than ~1 kg/wk or >1%/wk → **amber pill + "faster than safe pace"** (use the existing `.pill.amber`).
4. **Projected goal** — **a RANGE, never a single precise date** (e.g. "late Sep – mid Oct"). If the
   recent trend moves away from the goal, show **"Trend moving away — no estimate"** instead. (Spec §6.1.)

## A4. Left column

### A4.1 Weight trend chart (the hero)
- **EMA trend line per person**, each in their own color (P1 teal, P2 indigo), over **faint raw daily dots**.
- **Per-person legend** where each name is a **toggle** (show/hide that person).
- **Date-range tabs:** `4w · 8w · 12w · All` (reuse `.range-tabs`).
- **Layer toggles** (reuse the existing pill toggles) for:
  - **Raw daily** dots,
  - **Projected trend** — draw as a **dashed line with a shaded uncertainty band/cone**, NOT a single
    confident line. When trend moves away from goal, show no projection + a small "trend moving away" note.
  - **Ideal line** — from today's weight straight to the target at the target date (dashed).
  - **Goal band** — the target weight as a line **with a ± band** (so daily noise doesn't flip "reached" on/off).
- **Status pill** top-right of the card: `On track / Ahead / Behind / Plateau` (matches the motivation state).
- **Gaps:** missing days must **not break the line** — interpolate across the gap and mark it honestly
  (e.g. a lighter/dotted segment). Show a subtle "gap" affordance, never a crash or a vertical drop to zero.
- **Zoom/pan:** on desktop, scroll-to-zoom + drag-to-pan (the mobile pinch/pan comes later).

### A4.2 Progress & prediction
- **Multi-window deltas:** `1d / 7d / 14d / 28d` change. **Only show a window once enough data exists**
  for it — otherwise show that tile as **locked/"need N more days"**, not a fake 0.
- **Projection** restated here as the same **range** as the stat tile, plus the **on-track / ahead /
  behind** status measured against the **ideal line**.
- Per focused person (use the same person switcher as A3).

### A4.3 Goals (per-person + team)
- **One row per tracked person:** avatar + name, `current → target kg`, a progress bar, and a pill:
  - **with a target date** → "by {date}" (drives the ideal line + a pace check);
  - **without a date** → "no date · safe-pace ETA" (compute a realistic ETA at 0.5–1.0 kg/wk).
- **Team goal row** (divider above): icon + label (e.g. "Lose 15 kg together") + `lost / target` + progress bar.
- **`Edit` button (editors only)** → opens the **Goal editor** (modal or panel):
  - fields: target weight, optional target date, and the team goal;
  - **live pace check:** if the entered target+date implies **> ~1 kg/wk or > 1%/wk**, show an **amber
    inline warning** ("This needs ~1.4 kg/wk — faster than the safe 0.5–1.0 range") — **warn, don't block**.

## A5. Right rail

### A5.1 Motivation card (build all states)
Single card, but design **all six states** (the engine picks one; copy is warm, self-compassionate,
debounced so it won't flip daily, and rotated so it isn't robotic). Deliver a mock for each:
1. **On track** — reinforce consistency; credit their actions.
2. **Ahead** — celebrate; gently set sustainable expectations.
3. **Behind** — redirect to controllable process + NSVs; **no blame**.
4. **Plateau** (flat ~2–3 wk) — normalize; surface NSVs; re-anchor on process.
5. **Small regain / daily spike** — self-compassion + one easy next action. *(Highest churn-risk — make it especially kind.)*
6. **Milestone hit** — high-salience celebration; for this one also show a **brief full-width celebration banner** at the top of the dashboard (dismissible).
- **Milestone ladder** inside the card: **5% and 10%** of body weight, with progress between them and "next milestone: −X kg."
- **Couple prompt:** one mutual-encouragement line (e.g. "Priya logged 5 days straight — send a 👏").
  **Never** head-to-head ranking and **never** "your partner hasn't logged" nagging/surveillance.

### A5.2 BMI & healthy range (per person)
- Per tracked person: BMI value + category word, a **band bar** (under/healthy/over/obese) with a marker,
  and the **healthy-kg range** for their height.
- **Height is optional:** if a person has no height, **don't show BMI** — show a quiet "Add height in
  Profile to see BMI" line for that person only.

### A5.3 Wins (NSV notes)
- Reverse-chronological list of short notes (date + text).
- **`+ Add` (editors)** → tiny inline composer (date defaults to today + a text field). Design the
  **empty state** ("No wins logged yet — add the first one").

### A5.4 Disclaimer
- "Not medical advice. Healthy loss is 0.5–1.0 kg/week." Present on **every** variant, including read-only.

## A6. Habits section (full width, below the two columns)
Reuse the existing two-column habits layout, embedded **inside the dashboard** (no global page):
- **Left — Today's checklist:** the dashboard's habit items; each row = check box + emoji + label +
  that person's current streak. **You check off *your own* completion** (self-only). `+ Add habit` (editors).
- **Right — Streak grid:** `Week | Month` toggle; one row per habit; cells = done/missed.
  - Support a **per-person view** (toggle or two markers per cell) and **highlight days both completed**.
  - **Forgiving streaks:** a missed day inside the **grace allowance** must render **differently from a
    hard break** (e.g. a "grace" cell), and the streak count must **not reset** — show "streak repaired."
- **Tie to the goal:** a one-line header reminding these are the daily behaviors toward the dashboard's milestone.
- **Empty state:** "No habits yet — add the first thing you'll both do daily."

## A7. Dashboard settings / customization (⚙, editors)
Panel or modal holding the **non-quick** customization (the quick per-person/layer toggles stay on the chart):
- **Smoothing window** (how aggressively the EMA flattens noise) — a few presets (Light/Medium/Strong).
- **Which people / layers** are shown by default.
- **Units display** (kg · m fixed — show as read-only confirmation, no imperial).
- Shortcut to **Edit goals** and **Manage sharing**.
- *(No theme/accent control.)*

## A8. Feature → location quick reference (so nothing is misplaced)

| Feature (REQUIREMENTS) | Lives in |
|---|---|
| EMA trend, raw dots, multi-person toggle | A4.1 chart |
| Projection (range), ideal line, goal band | A4.1 chart layers |
| Current / trend / total / weekly rate | A3 stat tiles |
| Unsafe-pace warning | A3 weekly-rate tile **and** A4.3 goal editor |
| Multi-window deltas 1/7/14/28d | A4.2 |
| Projected date (range) + on/ahead/behind | A3 tile + A4.2 |
| Per-person goals (date optional) + team goal | A4.3 |
| Motivation states + milestone ladder + couple prompt | A5.1 |
| BMI + healthy band (height optional) | A5.2 |
| NSV notes + add | A5.3 |
| Disclaimer | A5.4 (all variants) |
| Habits checklist + streak + forgiving streak | A6 |
| Smoothing / default layers / units | A7 settings |
| Add **my** weight | header `+ Add my weight` → Add-weight page |

## A9. Dashboard states to mock (not just the rich one)
- **Brand-new dashboard, no weight yet** — chart/stat placeholders + a clear "Add your first weight" CTA.
- **Only a few days of data** — chart works; long-window deltas + projection **locked** with "need more data."
- **One person hasn't started** — their line/tiles show an invite-style empty hint (no nagging copy).
- **No habits / no NSV / no height** — each section's own empty state (above).
- **Read-only & no-login** variants of the populated dashboard (A0).

---

# PART B — All user journeys (analysis)

High-level navigation backbone (see the diagram I shared in chat):

```
Login ─▶ [Post-login router]
            ├─ collaboration dashboard updated ≤7d ─▶ Dashboard (most recent)
            ├─ else view-only dashboard updated ≤7d ─▶ Dashboard (view-only)
            ├─ else ─▶ Dashboards list  (Collaborating / View only sections)
            └─ no dashboards ─▶ Dashboards list (empty state)

Dashboards list ─▶ Dashboard detail ─▶ {Add weight, Edit goals, Habits, Share}
Sidebar (≤5 recents, collab-first) ─▶ Dashboard detail
Public link (no login) ─▶ Read-only dashboard
```

Below, every journey with the **screens/states the designer must deliver** and the **edge cases**.

### Onboarding & account
- **J1 First-run (new user):** Login → empty Dashboards list → *Create dashboard* and/or *Profile* to set
  name+height → *Add my weight* (single or backfill). **Deliver:** empty list state, "create first
  dashboard" emphasis, first-weight CTA. **Edge:** user with an invite waiting (show it on the list).
- **J2 Returning sign-in & landing:** the router above. **Deliver:** each of the 4 landing outcomes.
- **J16 Profile / account:** edit name/height (stacked, R1), units (fixed), sign out. **Deliver:** profile
  with height-empty hint; sign-out confirm.

### Dashboards & collaboration
- **J3 Create + invite:** Create/Share page → name + team goal → invite by email/account with role
  (Can edit / Read only) → **pending** state. **Deliver:** pending-invite chip ("waiting for Priya").
- **J4 Accept / decline invite (invitee):** notification → Accept (dashboard appears in **both**) or
  Decline. **Deliver:** incoming-invite notice with **Accept/Decline**, and the accepted confirmation.
- **J13 Share existing dashboard:** grant account read/edit; **toggle the read-only no-login link**; copy
  link; revoke. **Deliver:** link enabled/disabled states; "copied" feedback; copy that says editors
  edit *dashboard content*, each logs own weight (R1 fix).
- **J17 Switch / manage dashboards:** sidebar recents (≤5, collaboration first) + full list (Collaborating
  vs View only). **Deliver:** active state; >5 overflow to list; **two distinct cards** (one collab, one view-only).
- **J18 Notifications:** in-app bar/bell — invite received, invite accepted, milestone hit. **Deliver:**
  bar with one item, a bell with a dropdown of several, dismiss behavior.
- **J19 Multi-dashboard context:** user in several dashboards (e.g. "Parth & Priya", "Marathon prep").
  **Deliver:** switching keeps you oriented (clear current-dashboard name in header + sidebar active).

### Weight data (all self-only)
- **J5 Single entry:** `+ Add my weight` → weight + date(default today) + optional note → Save / **Save &
  add another**. **Deliver:** the form (no person picker), the morning-weigh-in tip, success feedback.
- **J6 Bulk backfill:** table of recent dates, blanks allowed for gaps. **Deliver:** add-row, "Save N entries".
- **J7 CSV import:** dropzone with **format shown up front + template** → **auto-detect columns & date
  format** → **confirm/override** → **preview rows + flag bad ones** → import. **Deliver:** all 4 steps
  (empty/dropzone, mapping, preview, result). (R1 priority.)
- **J8 Edit / delete entry:** from "Recent entries" (cleaned up per R1) → edit inline / delete with confirm.
  **Deliver:** edit state + **delete confirmation**.

### Using the dashboard
- **J9 Interpret progress:** read chart + tiles + deltas; toggle people/layers; change range; zoom.
  **Deliver:** layer on/off states; person hidden state; zoomed state.
- **J10 Set / edit goals:** A4.3 editor; **pace check + unsafe-pace warning**. **Deliver:** safe state,
  amber unsafe state, no-date "ETA" state.
- **J11 Habits:** add habit; check off **own** daily; view streaks (week/month, per person); grace day.
  **Deliver:** checked/unchecked, streak grid, **grace/repaired** state, empty state.
- **J12 Motivation + NSV:** see state message (6 states), milestone progress, couple prompt; add an NSV.
  **Deliver:** all 6 motivation mocks + the milestone-hit celebration banner + NSV add + empty.
- **J15 Customize:** smoothing, default layers/people, units (read-only). **Deliver:** the ⚙ panel.

### Read-only
- **J14 No-login viewing:** open public link → **view-only dashboard, no chrome**, "Sign in to track your
  own" CTA, disclaimer present. **Deliver:** the full view-only dashboard (A0) + a **revoked/expired link**
  state ("This link is no longer active").

### Robustness / unhappy paths
- **J20 Empty / error / permission:** every list and data area's **empty** + **loading** + **error**
  states; a **read-only user who tries to act** sees disabled controls (not a dead-end); a **save failure**
  shows a retry, never silent loss. **Deliver:** representative empty/loading/error mocks (see Part C).

---

# PART C — Robustness guidelines (apply to EVERY screen)

1. **One component kit.** Reuse the existing buttons, pills, cards, inputs, tabs, segmented controls,
   toggles, progress bars, avatars. If two screens do the same thing, they must look identical.
2. **Four states for every data view:** **empty** (first-run / nothing yet), **loading** (skeletons,
   not spinners-on-blank), **populated**, **error** (with a retry). No screen ships with only the rich state.
3. **Role/permission is visible, not implied.** Editor vs read-only vs no-login each have a clear,
   consistent treatment (badge + hidden controls). A read-only user never sees a control they can't use.
4. **Honest data viz** (non-negotiable, it's a trust feature):
   - trend (EMA) over **faint raw dots**; never raw-only as the hero;
   - projection is a **range / band**, with an explicit **"no estimate"** when the trend moves away;
   - goal is a line **+ ± band**; gaps are **interpolated and marked**, never broken or zeroed.
5. **Couple-framing tone.** Shared goal, each person vs their **own** baseline, mutual encouragement.
   **Banned:** head-to-head ranking, "your partner hasn't logged," any surveillance/nagging copy.
6. **Self-only everywhere.** No person picker on any entry flow; you only ever edit your own weight/habits.
7. **Semantic color, used consistently:** teal = person 1 / primary accent, indigo = person 2,
   **amber = unsafe-pace / caution**, rose = a gain/negative delta. Don't repurpose these.
8. **Numbers, units, dates formatted consistently:** kg to 1 decimal, rates as kg/wk, **meters** for
   height, one date format app-wide. Units never imperial.
9. **Confirm destructive / outward actions:** delete entry, remove member, disable a public link → confirm step.
10. **Disclaimer is permanent** — every variant, including the no-login view.
11. **Accessibility:** sufficient contrast on the light theme; don't encode meaning in color alone
    (pair color with a label/shape — e.g. the safe/unsafe pill has text, not just amber).
12. **Desktop now, mobile-ready later:** keep each card a self-contained block that can stack into a
    single column; avoid layouts that can only work at desktop width.

---

# Deliverables checklist (this round)
- [ ] Full **editor** dashboard (A1–A7) with real-looking content.
- [ ] **View-only** + **no-login** dashboard variants (A0).
- [ ] All **6 motivation states** + milestone-hit celebration banner (A5.1).
- [ ] **Goal editor** with safe / unsafe-pace / no-date states (A4.3).
- [ ] **Habits inside the dashboard:** checklist + streak grid + grace/repaired + empty (A6).
- [ ] Chart with **honest projection range** + ideal + goal band + gap handling (A4.1).
- [ ] Dashboard **empty / few-days / partial** states (A9).
- [ ] **CSV import** 4-step flow (J7) + cleaned **Recent entries** + **delete confirm** (J8).
- [ ] **Invite received / pending / accepted** + **link revoked** states (J3, J4, J13, J14).
- [ ] Empty / loading / error states across lists and data areas (Part C #2).
```

