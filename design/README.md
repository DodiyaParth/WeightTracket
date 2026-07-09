# WeightTracker — UI Prototype

A **throwaway** design prototype to explore the desktop UI, feature placement, and every user-journey
state. Not production code: no backend, no real auth, all data hardcoded in `data.js`. The real app
(per `../REQUIREMENTS.md`) will be React + Vite + Firebase, with the chart on **Chart.js + zoom/annotation plugins**.

> **Status: R3 complete.** Implements `DESIGNER-BRIEF.md`, `DESIGN-FEEDBACK-R1/R2/R3.md`, and
> `CHART-FEEDBACK.md`. Desktop only (cards are self-contained blocks built to stack into one mobile
> column next pass). The chart + quick-log flows were refined against best-practice research
> (TradingView/Apple Health/Google Finance scrubber+tooltip patterns; Apple Health/Oura/MFP quick-entry).

## Run it
```bash
cd design
npm install
npm run dev      # http://localhost:5180
npm run build    # → dist/
```

## The model that ties it together
**One canonical per-person `state`** (onTrack / ahead / behind / plateau / regain / milestone) is the
single source of truth for each tracked person. It drives — consistently, with no contradictions —
the chart status pill, the projection (range vs "no estimate"), the progress verdict, and the
motivation copy. Switch the focused person and *everything* follows. (Resolves the R3 B2/B3/B8 cluster.)

- **Weight & habit check-offs are self-only.** Editors share goals/habits, never each other's numbers.
- **Motivation is per-person and self-anchored** — no "send claps", no partner-cadence reporting, no nagging.

## Pages & routes
| Route | Page | Notes |
|---|---|---|
| `/login` | Login | Google sign-in → active dashboard |
| `/` | Dashboards list | Collaborating vs View-only, wired pending invites (shown in empty state too), **Create modal**, loading/error |
| `/dashboard/:id` | Dashboard detail | full interior; **Share / Settings / Goal-editor are modals**; editor vs view-only variants |
| `/add` | Log a weigh-in (Advanced) | single / bulk / CSV; edit a recent entry reopens the quick modal; delete confirms |
| `/profile` | Profile / settings | reached from the **sidebar account chip** (no nav tab); name + height, prefs, account |
| `/s/:token` | Public view | no-login read-only + revoked-link state |

No `/share` route — **Create** (new dashboard) and **Share** (existing dashboard) are separate modals.

## Quick-log (the 95% path)
The top-bar **"Log my weight"** opens a modal: big weight input prefilled to last value (autofocus +
select), −/+ 0.1 steppers, demoted date chips (Today/Yesterday/2-days), collapsed "+ Add note",
single **Save** (closes + toast), and an **Advanced** link → `/add` for bulk/CSV/back-dating. Editing
an entry reuses the same modal. All five add-triggers route here.

## The chart (`components/Chart.jsx`)
Rebuilt against CHART-FEEDBACK: **kg y-axis + date x-axis**, a **"Today" divider** (real → projection),
a **line-style key** (Trend / Daily / Ideal / Projected), a snapped **hover crosshair + multi-series
tooltip**, a **scrubber strip** (drag the window to pan/resize) + **range presets** (4W/3M/6M/All, no
scroll-hijack) + a **Smoothing** control. Honesty: projection is a **fading fan, not a confident line**,
flips to a **"No estimate — keep logging"** badge when the trend moves away, locks under 14 days; gaps
render as **absent dots + a shaded band** (no "interpolated" jargon). **N-person** (iterates the
dashboard's tracked people); goal/ideal/goal-band follow the **focused** person in their color.

## Variants & states (all reviewable via fenced "Prototype preview" toggles)
- Dashboard data: Populated / New / Few-days (locks long deltas + projection) / Loading / Error.
- Per-person motivation: all 6 states (dropdown in the motivation card) + milestone celebration banner.
- Roles: Editor (full) · View-only (controls hidden, badge) · No-login public (no chrome + revoked state).

## Component kit (reuse — don't reinvent)
`styles.css` tokens + classes: `.card`, `.btn(.primary/.ghost/.danger/.sm)`, `.pill(.amber/.gray)`,
shared `RoleBadge` (Owner/Editor/View) and `Toggle` (`components/ui.jsx`), `.input`, `.tabs`, `.seg`,
`.range-tabs`, `.toggle`, `.modal` (+ `Confirm`), `.streak-cell(.on/.grace)`, `.skel`, `.toast`.
One fixed teal accent (no theme picker). Semantic color: teal = person 1 / primary, indigo = person 2,
**amber = caution / unsafe pace**, rose = a gain. Initials are 2-letter; identity comes from `person.*`.
