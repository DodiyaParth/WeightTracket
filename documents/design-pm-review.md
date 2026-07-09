# PM Design Review — WeightTracker prototype

**Reviewed:** `design/` prototype against `requirements.md`
**Date:** 2026-06-30
**From:** Product

> **Build scope is now set by [`design-designer-brief.md`](./design-designer-brief.md).** For the current round the
> designer works **desktop-only**, keeps the dashboard interior as the existing mock, and **excludes**
> the motivation engine. So mobile (B1), projection (B2), unsafe-pace (B4), motivation (B5), and the
> in-dashboard empty states (B6) below are **parked** as backlog for the later dashboard-interior
> pass — **except the read-only / no-login view (B3), which is in scope now.**

The prototype is a strong start — the visual language (airy, one teal accent, calm cards) is exactly
right, and the dashboard detail page packs in the chart, stats, goals, motivation, BMI and NSV wins
cleanly. The notes below are what I need changed before this becomes the build reference. They're
grouped by priority. **Section A** are new product decisions (already written into requirements.md
§5 + §11). **Section B** are places the prototype doesn't yet meet requirements we already agreed.

---

## A. New product decisions — please rework (P0)

### A1. Habits move *into* the dashboard — kill the global Habits page
**Today:** `Habits` is a top-level sidebar item (`/habits`) — a global page separate from any
dashboard.
**Change:** Habits belong to a dashboard. Per couple/goal, not app-wide.
- Remove `Habits` from the global sidebar nav.
- The daily checklist (check-off), the streak/history grid, and **"add habit"** all live **on the
  dashboard** — as a section or tab within the dashboard detail view.
- **Adding habit datapoints happens only inside the dashboard** (there is no other entry point).
- Frame habits around **that dashboard's shared goal / milestone** — they're "the daily things we're
  doing to hit our target," shown near the goal, not as a context-free tracker.
- *Why:* a couple tracks habits in service of the milestone the dashboard is already tracking; a
  detached global page breaks that link and doesn't scale when someone is in two dashboards.
- *Spec:* requirements.md §5 (updated).

### A2. Post-login landing — jump to the active dashboard
**Today:** login always lands on `/` ("Your dashboards" list).
**Change (requirements.md §11.2):**
- If the user belongs to a dashboard **updated in the last 7 days**, open the **most-recently-updated
  one directly** (straight to dashboard detail).
- Otherwise, open the **Dashboards list** page ("dashboards shared with you").
- **New user, no dashboards →** Dashboards list in an **empty state** (prompt to create / accept an
  invite). *Please design this empty state — see B6.*

### A3. Sidebar: a Dashboards bucket + 5 recent dashboards
**Today:** sidebar has a single `Dashboards` item that opens one hardcoded detail page; the list of
dashboards only exists on Home.
**Change (requirements.md §11.1):**
- A **Dashboards** entry that opens the **full Dashboards list page** ("your dashboards").
- Directly beneath it, the **5 most-recently-updated dashboards** as direct links — click opens that
  dashboard. (6th+ live on the list page.)
- Implies each dashboard needs a **stable id/route** (`/dashboard/:id`), not one shared `/dashboard`.
- *Design need:* show the sidebar with the recents list populated, an active/selected state, and how
  it looks with 1, 3, and 5+ dashboards.

---

## B. Gaps vs. requirements we already agreed

### B1. Mobile / responsive is missing — and it's requirement #1 (P0)
The README scopes this prototype to "desktop UI," but requirements.md is emphatically **mobile-first**
(§2, §7). `styles.css` has a fixed 240px sidebar, a fixed 720px chart, `1fr 360px` two-column grids,
and **zero media queries**.
- Please design the **mobile layouts**: collapsed sidebar → bottom nav or drawer, single-column
  stacking, the dashboard recents in a mobile-friendly form, and a **full-width chart with
  pinch-zoom / pan** (a core §6.1 requirement).
- This is the single biggest gap. Couples will log from their phones every morning.

### B2. Projection must be honest — not a single precise date (P0)
§6.1 says projection is "hedged honestly (a range, or 'unknown' if the trend moves away from the
goal). No falsely precise single date."
**Today** the dashboard shows `Projected goal: Sep 21 · 9 days ahead` (one exact date) and a single
dashed projection line.
- Redesign as a **range / cone / band** (e.g. "late Sep – mid Oct"), and design the **"trend moving
  away → projection unavailable"** state. This is a trust/safety call, not cosmetic.

### B3. Read-only / no-login dashboard view is not designed (P0)
The share page mints a read-only link, but there's **no design for what that link opens**.
- Design the **view-only dashboard**: edit/add/share controls hidden, a clear "View only" banner, no
  account chrome. Read-only is enforced in security rules, but the UI must match (§3.3, §6).

### B4. Unsafe-pace warning state (P1 — safety)
§6.6 requires warning when a goal implies an unsafe pace (faster than ~1 kg/week or >1%/week). The
amber/rose tokens exist in CSS but are **never used**; the "Weekly rate" tile only shows the healthy
case ("within safe 0.5–1.0").
- Design the **aggressive-pace warning**: amber pill + message on the weekly-rate tile and at
  goal-setting time ("this target needs ~1.4 kg/week — faster than the safe range").

### B5. Motivation engine — design the hard states, not just "on track" (P1)
§6.4 defines six states; the prototype only mocks the happy "🌱 on track" card.
- Please mock the **difficult, high-value states**, especially: **plateau** (2–3 wk flat),
  **small regain / daily spike** (flagged as highest churn-risk), and **behind**. Their tone +
  visual treatment is the real design work.
- Also missing: the **couple / mutual-encouragement** prompt style (§6.4), and an **"add NSV note"**
  flow (today the Wins card has an Add button but no input designed).

### B6. Empty / first-run / not-enough-data states (P1)
Everything is shown data-rich. We need:
- **No dashboards yet** (the A2 landing target).
- **New dashboard, no weight data** (chart/stat placeholders).
- **Multi-window deltas** — §6.2 says show 1/7/14/28-day "only when enough data exists"; design the
  partial/locked state.
- **No habits yet**, **no NSV notes yet**, **no height → no BMI** (height is optional, §6.2).

### B7. Collaboration invite flow — show the *incoming* request (P1)
Home mocks only the "Priya **accepted**" confirmation. We still need the other half of §3.3:
- The **incoming invite** notification with **Accept / Decline**, and a **pending-invite** state on
  the sender's side ("waiting for Priya to accept").

### B8. Weight-entry scope needs to be unambiguous (P1)
The global `Add weight` page has a "For: Parth (me)" person picker, implying I can log Priya's weight
from a global page. But the model is: I own my data (§3.1); I edit **others'** data **through a shared
dashboard** (§3.3).
- Please make the two entry points distinct: **global quick-add = my own weight**; **in-dashboard
  add/edit = any tracked person in that dashboard**. Avoid a global picker that lets me log someone
  I don't share a dashboard with.

### B9. Multiple distinct dashboards + open-ended people (P2)
- Home lists two dashboards but both navigate to the same hardcoded detail. Once routes are
  per-id (A3), please show **two genuinely different dashboard states**.
- Color system only defines `--p1`/`--p2`. requirements.md says people are **open-ended**; show how
  **3+ people** look (color assignment, legend overflow, avatar stack). Couple is the v1 case, but
  don't design a hard 2-person ceiling.

---

## C. Smaller polish / consistency (P2–P3)
- **IA naming:** with A3, resolve "Home" vs "Dashboards." Today Home *is* the dashboard list while
  "Dashboards" is a single detail — confusing. Suggest: **Dashboards (list)** + dashboard detail; fold
  the Home notification bar into the list page or a global top-bar bell.
- **Notification bar:** define dismiss behavior and where dismissed/old notifications go (a bell
  dropdown?). Today it's one static card.
- **Disclaimer placement:** "Not medical advice" appears on login, dashboard, profile — good. Make
  sure it survives on the **read-only** view too (B3).
- **Theme accent** picker exists in Profile — confirm it only restyles the UI accent, not the
  per-person chart colors (which must stay distinct).

---

## D. What changed in requirements.md (source of truth)
I've already written A1–A3 into the spec so eng + design work from one doc:
- **§2 Key Decisions** — Habits row reworded (in-dashboard); new **Navigation** row.
- **§5 Daily Checklist** — habits live inside the dashboard; no global page; framed to the goal.
- **§11 App Shell, Navigation & Landing** *(new)* — sidebar recents, post-login landing, `/dashboard/:id`
  routing, and the open questions below.
- **§9 Milestones** — M3 gains the nav shell + landing; M4 notes habits are in-dashboard.

## E. Open questions for stakeholder (blocking some of the above)
1. **"Dashboards shared with you"** = one unified list of all my dashboards (assumed), or split
   owned-by-me vs shared-with-me?
2. **What counts as an "update"** for the 7-day auto-open and the recents ordering? (Assumed: any
   weight entry, habit check, goal/NSV/membership change.)
3. If **several** dashboards updated within 7 days, open the single most-recent (assumed) — or always
   land on the list?
