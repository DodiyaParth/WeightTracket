# Design Feedback — Round 3 (full prototype review)

**Date:** 2026-06-30 · **From:** Product · **Spec:** `requirements.md`
**Method:** full read of every page/component against the spec, looking for requirement gaps, fresh-user confusion, and pixel/UX inconsistency.
**Graph:** has its own deep doc — see **`design-chart-feedback.md`**. This doc covers everything else.

Tags: **[req]** diverges from requirements · **[confusion]** would confuse a new user · **[polish]** consistency / pixel-perfect.

---

## A. Your reported points — verdicts at a glance

| # | Your point | Verdict | Section |
|---|---|---|---|
| 1.1 | Stats show only current user, not collaborator | **Partly** — a person switch exists; 3 of 4 tiles follow it, the 4th + Progress don't | B3 |
| 1.2 | Graph has no legend for the lines | **Refined** — person legend exists; line-type key missing | design-chart-feedback |
| 1.3 | Graph has no timeline slider / custom zoom / navigation | **Confirmed & worse** | design-chart-feedback |
| 1.4 | "gap-interpolated" written on graph | **Confirmed** (+ a 2nd raw label) | design-chart-feedback |
| 1.5 | Motivation can differ per person | **Confirmed** — it's a single shared state today | B2 |
| 1.6 | Progress/prediction can differ per person | **Confirmed** — ignores the person switch | B3 |
| 1.7 | Habit tick for any date (today default) | **Confirmed** — today-only today | B4 |
| 1.8 | Add-weight should be a popup + Advanced → full page | **Confirmed** — no popup exists | C1 |
| 1.9 | No "send claps" / "both logged this week" | **Confirmed** — present, violates spec | B1 |
| 1.10 | Log-weight page too heavy (title, clutter, spacing) | **Confirmed** — incl. a real layout bug | C2–C4 |
| 1.11 | Share page edits name / has Create / merge create+share / use popups | **Confirmed** (all four) | D1–D4 |
| 1.12 | Remove Profile sidebar tab; open via account chip | **Confirmed** | E1 |

Everything else below is what the review surfaced **beyond** your list.

---

## B. Dashboard

### B1 — [req][confusion] Remove all social-nudge / "send claps" copy — *Critical*
Direct violations of §6.4's "no surveillance / no nagging":
- The **"👏 Send"** button — `components/MotivationCard.jsx:36`.
- **"You and Priya have both logged this week…"** — `data.js:152`.
- **"Priya logged 5 days straight — send a 👏"** — `data.js:158`.
- **"Priya hasn't logged yet either"** — `DashboardBody.jsx:260` (the exact "partner hasn't logged" pattern).
**Fix:** delete the Send button; rewrite all `couple` strings to remove any report of the partner's cadence/streak and any prompt to poke. Keep only self-anchored encouragement. New-user copy → "Add your first weigh-in to start the trend" (don't mention whether Priya logged). *(Spec §6.4 updated.)*

### B2 — [req] Motivation must be per-person — *Critical*
Today it's one dashboard-level state (`DashboardBody.jsx:218`), rendered once, not bound to the person switch, and the copy is hardcoded to Parth's story (e.g. milestone "−4.4 kg", `DashboardBody.jsx:277`). So it **cannot** show "Parth plateaued, Priya broke out" — exactly your 1.5 case.
**Fix / my recommendation:** compute the state **per person** from that person's own trend/baseline, and show it per person — either two compact motivation cards, or one card that follows the person switch (B3). The milestone banner is per-person too. The **only** shared motivation element is **team-goal progress** (about the shared goal, not a blended "mood"). *(Spec §6.4 updated to require per-person state.)*

### B3 — [req][confusion] Stats + Progress/prediction must be per-person — *Critical*
Your 1.1/1.6, with nuance: a `FocusSwitch` **does** exist and the first three tiles follow it. But:
- The **Projected goal** tile (`DashboardBody.jsx:44-48`) and the **whole Progress card** (`DashboardBody.jsx:53-81`) ignore `focus` — deltas and projection are module-level. Switch to Priya and she's shown **"9 days ahead of ideal"** even though her data is behind/unsafe (`data.js:122`). That's actively misleading.
- The switch **over-promises**: labeled "Showing stats for," it changes only the tiles, not Progress/motivation/chart status.
**Fix:** key deltas + projection by person; compute **one** on-track/ahead/behind verdict per person and reuse it everywhere (kills the contradiction in B8); make the switch scope **all** per-person content (or relabel it as tile-only — but scoping all is the spec-aligned choice).

### B4 — [req] Habit check-off must support any date — *High*
`HabitsSection` only toggles **today** (title literally "Today's checklist"); the streak grid is read-only. Your 1.7.
**Fix:** add a date control (default today) and/or make streak cells tappable to toggle a past day. *(Spec §5 updated.)*

### B5 — [confusion] "Wins" (NSV) add is a no-op — *High*
`DashboardBody.jsx:169-175`: Save just closes the composer; the typed text is discarded and the date is hardcoded "Jun 30." Reads as broken in a demo.
**Fix:** append `{date, text}` to the list, clear the input, editable date defaulting to today.

### B6 — [req] BMI category is hardcoded "overweight" for everyone — *High*
`DashboardBody.jsx:149` prints "overweight" regardless of BMI; the "no height → hide BMI" rule is faked off a demo flag (`:302`), and height-less members would render `NaN–NaN kg` (`:155`).
**Fix:** compute the category from the §8 thresholds; gate the row on a real `heightM`; guard the band math.

### B7 — [polish] "Total lost" disagrees across the app — *Medium*
Three figures float around: list card **−6.2 kg** (`data.js:54`), `team.lost` **6.8** (`data.js:116`), milestone copy **−4.4** (Parth's 5%, `DashboardBody.jsx:277`).
**Fix:** derive the team total from per-person totals; clearly label the −4.4 as Parth's individual 5%.

### B8 — [confusion] Two different verdicts for the same person — *Medium*
Tile says "9 days ahead of ideal" (`:48`) while Progress says "on track vs ideal" (`:77`). Ahead ≠ on-track in our own taxonomy. Compute once (see B3).

### B9 — [polish] Side-by-side empty cards mismatch — *Medium*
In the new-dashboard state the Goals empty card and Habits empty card use different icon/padding treatments (`DashboardBody.jsx:101-111` vs `HabitsSection.jsx:89-100`). Unify — this is the first-run moment.

### B10 — [req] Per-person surfaces are hardcoded to two people — *note (scaling)*
Goals, the goal editor, the focus switch, and "people shown" are hardcoded to `me`+`partner` (`DashboardBody.jsx:120-121`, `GoalEditor.jsx:62-64`). The data model already has 3–4 member dashboards. Couple is the v1 case, but design these to map over the dashboard's tracked people so a 3rd person doesn't fall off. (Same root issue as design-chart-feedback D1.)

**Verified-good (no action):** all six motivation states exist; milestone ladder 5%/10%; forgiving streaks with a distinct grace cell (a11y-safe, not color-only); unsafe-pace amber; goal-editor pace check; disclaimer present; **no theme/accent picker** (correct); **self-only** (no person picker anywhere); read-only gating is consistent.

---

## C. Add / Log weight

### C1 — [req][confusion] No quick-log popup — every trigger opens the full page — *Critical*
All five "add" triggers `nav('/add')`: `Layout.jsx:113` & `:8`, `DashboardDetail.jsx:24`, `DashboardBody.jsx:261`, `DashboardsList.jsx:65`. The 95% case (type today's number, save) shouldn't require a 3-tab page. A `Modal` component already exists (used by Settings/Goals) — the pattern just isn't applied here. Your 1.8.
**Fix:** build a **QuickLogModal** (large weight input prefilled to today, date defaulting to today, optional note, **Save**), with a secondary **"Advanced"** button that routes to `/add` for bulk/CSV/back-dating. Wire all five triggers to open it. *(Spec §4 updated.)*

### C2 — [req][confusion] "Today's weight" title is wrong — *High*
`AddWeight.jsx:10` — the page also back-dates, and the date is editable. Your 1.10a.
**Fix:** retitle "Log a weigh-in" / "Add a weight." Reserve "Today" for the popup (where it's accurate).

### C3 — [req] Remove clutter copy — *High*
`AddWeight.jsx:24-27` — the "Saving to your account · Parth" pill and "Only you can log your own weight" line. Self-only design already removes any ambiguity, so this is noise. Your 1.10b. **Fix:** delete both.

### C4 — [polish] Real layout bug: dead gap before "Recent entries" — *High*
`AddWeight.jsx:195` left column is `1fr` but the inner card is capped at `maxWidth:520`, so the form floats left and a big empty band opens before the 320px right panel (`:201` `alignSelf:start` doesn't balance it). Your 1.10c — it's a real bug, not perception.
**Fix:** `gridTemplateColumns: 'minmax(420px,560px) 320px'` (or drop the `maxWidth` caps) and tighten the gap so the two cards sit adjacent.

### C5 — [req][confusion] Edit-entry button is inert — *High*
`AddWeight.jsx:210` — the pencil has no handler (delete correctly confirms). §4 requires correcting entries.
**Fix:** wire it to open the quick modal prefilled with that entry (single-entry, edit, and quick-log then share one component).

### C6 — [confusion] CSV counts are nonsensical placeholders — *Medium*
`AddWeight.jsx:176,178` compute `ready*16`/`bad*2` → "Import 80 entries" while the file says "84 rows" (80+2≠84). **Fix:** coherent fixed demo numbers (e.g. "84 rows · 82 ready · 2 need attention" → "Import 82 entries"). *The rest of the CSV flow is the strongest part of the page — keep it: format shown up front, template, auto-detect columns + date format, preview, bad-row flagging.*

### C7 — [polish] One label for the action — *Medium*
"Add weight" / "Log my weight" / "Add my weight" all appear. Standardize on **"Log my weight"** (matches self-only framing).

### C8 — [polish] Single-entry Date is a static div — *Low*
`AddWeight.jsx:22` isn't a real control; make it a date-picker affordance (cursor/hover) so back-dating reads as available.

---

## D. Sharing & Create  (and "prefer popups over pages")

> Single most impactful refactor: make **Create** and **Share** two separate **modals** and delete the `/share` page — this resolves D1–D4 at once.

### D1 — [req] Create and Share are merged into one page — *Critical*
One `/share` route titled "Create & share dashboard" serves create, share-existing, and manage-sharing (`App.jsx:21`; entry points `DashboardsList.jsx:46,64`, `DashboardDetail.jsx:23`, `DashSettings`→`:47`). Your 1.11.2.
**Fix:** **Create modal** (name + optional first goal + optional invite) from the list; **Share modal** (members/roles, invite, read-only link) from the dashboard. Different jobs, different surfaces.

### D2 — [req][confusion] Share must not edit the dashboard name / team goal — *Critical*
`ShareDashboard.jsx:30-36` has Name + Shared-team-goal inputs. Clicking "Share" to get a link and being shown a rename form is confusing; team goal also duplicates the Goal editor. Your 1.11.
**Fix:** remove the whole "Dashboard details" card. Name → settings; team goal → goal editor.

### D3 — [confusion] Remove "Create dashboard" button from Share — *Critical*
`ShareDashboard.jsx:116` — nonsensical on an existing dashboard's share view. Your 1.11.1. **Fix:** delete; a share modal needs only Done/Close (invites send inline, link changes are immediate).

### D4 — [polish][req] Make Share a modal (consistency) — *Critical*
Sibling actions Edit-goals and Settings are already modals, but Share is a full page with app chrome — jarring and inconsistent. Your 1.11.3.
**Fix:** convert Share → modal; convert Create → modal; drop the `/share` route. Handle the chained case (Settings → "Manage sharing" should open the Share modal, not navigate away). *(Spec §11.6 updated: prefer modals; create/share separate.)*

### D5 — [req][confusion] Pending invites: dead buttons + missing from empty state — *High*
Accept/Decline have no handlers (`DashboardsList.jsx:135-136`), and the invites block only renders in the populated preview — the **empty** first-run state doesn't surface invites, but §11.2 says a new user should be able to "create **or accept a pending invite**." **Fix:** show pending invites in the empty state (or always, above both sections); wire the buttons (optimistic in the prototype).

### D6 — [confusion] Prototype toggle leaking into the public view — *High*
`PublicView.jsx:22-25` puts an "Active link / Revoked link" segmented control in the public header next to "Sign in," styled like a real control — a stranger would think it's a feature. **Fix:** fence it in the `.proto-controls` treatment used elsewhere (or move it out of the shared header). *(Otherwise PublicView is correct — no chrome, no edit controls, View-only badge, disclaimer, sign-in CTA, revoked state all present.)*

### D7 — [polish] Two unrelated invite visuals — *Polish*
List `.invite-card` (inbound) vs Share `.pending-row` (outbound) share no visual language. Unify into one invite component with inbound/outbound variants.

### D8 — [polish] Role badges inconsistent — *Polish*
"Owner" is a gray `.pill` on Share but a teal `.tag` on the list. Define one role badge (Owner/Editor/View) used everywhere; reserve `.pill` for transient statuses.

---

## E. Navigation / Profile / Sidebar

### E1 — [req] Remove the Profile sidebar tab; open Profile from the account chip — *Critical*
Profile is a nav item (`Layout.jsx:9,40`); the bottom account block (name/photo/email, `Layout.jsx:48-57`) is inert except for the sign-out icon. Your 1.12.
**Fix:** remove Profile from `PRIMARY`; make the account chip a clickable control → `/profile` (add hover/cursor; keep sign-out as a nested action that stops propagation). *(Spec §11.6 updated.)*

### E2 — [polish] Drop the duplicated "Add weight" sidebar item — *High*
"Add weight" is both a sidebar nav item and a top-bar button (with divergent labels, C7). After E1 removes Profile, the sidebar's secondary nav is nearly empty anyway. **Fix:** drop the sidebar Add item; sidebar = **Dashboards + recents + account chip** (cleaner and more on-spec, §11.1). Logging stays the top-bar button → QuickLogModal (C1).

### E3 — [polish][confusion] Inconsistent top bar — *Medium*
Pages suppress actions with an `actions={<div/>}` hack, so the notification bell/search vanish on Profile/Add/Share while the list shows them. **Fix:** one top-bar policy (search + bell + account, plus the page's primary action); handle "no actions" explicitly in `Layout`. Note the top-bar avatar duplicates the sidebar chip — pick one.

### E4 — [polish] Sidebar recents — prove the rules — *Polish*
Logic (collaboration-first, ≤5) is correct but unverifiable with only 4 demo dashboards. Add a 6th so the **≤5 cap + "rest live on the list"** overflow is shown, and **mute the view-only dot** to match the muted treatment used on the list cards.

### E5 — [req] New-user landing → empty state — *note*
`landingRoute()` returns `/` and the list renders the populated demo; the empty state is only reachable via a manual toggle. In the real app the list decides empty-vs-populated from data — fine — but ensure a brand-new user lands on the **empty state with pending invites** (ties to D5). Low urgency for the prototype.

---

## F. Cross-cutting consistency & correctness

### F1 — [bug][polish] `&amp;amp;` renders literally — *High*
`ShareDashboard.jsx:27,33` (`title`/`defaultValue="Parth &amp;amp; Priya"`) and `Profile.jsx:18` show the literal text "Parth &amp;amp; Priya". **Fix:** use a plain `&amp;` in JSX string attributes.

### F2 — [confusion] Priya's avatar initial is "R" — *Medium*
`data.js:4` — both names start with "P", so "R" was a workaround; it reads as a bug. **Fix:** use two-letter initials (`Pa`/`Pr`) or first-letter + distinct color, derived from the name consistently.

### F3 — [polish] Email source-of-truth mismatch — *Medium*
Hardcoded `parth@email.com` (`Layout.jsx:52`, `Profile.jsx:25`) vs derived `{id}@email.com` (`ShareDashboard.jsx:46`). Centralize on `person.email`.

### F4 — [polish] Three copies of the Toggle switch (already drifting) — *Medium*
`Profile.jsx:7-13`, `DashSettings.jsx:6-12`, `ShareDashboard.jsx:80-82` — the share one is missing the `box-shadow` the others have. Extract one shared `Toggle`.

### F5 — [polish] Pills vs tags overlap in meaning — *Polish*
Reserve `.pill` for transient statuses (within safe range, need more data, Pending); use the single role badge (D8) for roles.

---

## What I updated in requirements.md this round
- **§6.4** — motivation runs **per person** (states can diverge); **no social-nudge/clap prompts** (your 1.5, 1.9).
- **§5** — habit check-off supports **any date** (today default) (your 1.7).
- **§4** — quick-add **popup** + an **Advanced** action → full entry page; trim clutter; no "Today's weight" framing (your 1.8, 1.10).
- **§11.6 (new)** — prefer **modals over full pages**; **Create and Share are separate**; **no Profile sidebar tab** (open from the account chip) (your 1.11, 1.12).

## Suggested fix order
1. **Critical structural:** per-person dashboard (B2, B3) + strip claps (B1); QuickLogModal (C1); split Create/Share into modals & drop `/share` (D1–D4); profile-via-chip + slim the sidebar (E1, E2).
2. **High:** habit any-date (B4), wire NSV (B5), compute BMI (B6); add-weight title/clutter/layout/edit (C2–C5); invites (D5); fence the public proto toggle (D6); `&amp;` bug (F1).
3. **Polish pass:** B7–B9, C6–C8, D7–D8, E3–E4, F2–F5 — and the whole of `design-chart-feedback.md`.
