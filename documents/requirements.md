# Weight Tracker — Product Requirements

A fresh, minimal, mobile-friendly web dashboard for a couple (extensible to more people) doing
weight loss together. Each person owns their personal data in their own account; people collaborate
through shared **dashboards** that track goals, timelines, and habits. Hosted as a static site with
no server to maintain.

**Status:** Requirements finalized — ready for build planning · design-review revisions 2026-06-30 (navigation & landing §11, habits-in-dashboard §5, **self-only weight logging §3**, no theme picker §6.5)
**Last updated:** 2026-06-30
**Disclaimer:** Health guidance in this app is general information, not medical advice.

---

## 1. Vision

> A static, no-server web app on GitHub Pages where each user keeps their own weight history in their
> account, and creates **collaborated dashboards** with other users (e.g. spouse) to track shared
> goals, timelines, and daily habits — staying motivated toward a common target. Dashboards can be
> shared with other accounts (read or edit) or via a read-only link with no login.

**Primary users:** Parth and his wife (2 people now), built to be open-ended for more people.

---

## 2. Key Decisions

| Area          | Decision |
|---------------|----------|
| Hosting       | Static site on **GitHub Pages**, no server |
| Frontend      | **React + Vite**, **Chart.js** (annotation + zoom plugins), mobile-first |
| Database      | **Firebase Firestore** (free tier; client API key is safe to ship — security lives in rules) |
| Auth          | **Google sign-in** to own an account and personal data |
| Data model    | Two entities: **Person/account data** (owned per user) + **Dashboard data** (collaboration object) |
| Edit access   | **Weight is self-only** — each user logs/edits only their **own** weight; nobody edits another person's weight. A dashboard's **edit** role governs **dashboard-level data only** (shared/team goal, habits, members, sharing) |
| Read access   | Granted to specific Google accounts **or** via a special **read-only link (no login)** |
| People        | **Open-ended** — any number of users; each owns their account |
| Health stats  | **Full** — height (m) → BMI, healthy band, unsafe-pace warnings |
| Goals         | **Per-person, date optional** + a **shared team goal** — held in the dashboard |
| Habits        | **Daily checklist inside each dashboard** — add items, check off & view streaks within the dashboard; no global habits page (§5) |
| Motivation    | **Full engine** — state messages, milestones, forgiving streaks, NSV notes, couple prompts |
| Look & feel   | **Light, clean & airy** — whitespace, one calm accent color |
| Units         | **Weight in kg, height in meters** (no imperial toggle) |
| Navigation    | **Dashboard-centric** — sidebar shows ≤5 recently-updated dashboards + a *Dashboards* list page; after login open the most-recently-active dashboard, else the list (§11) |

---

## 3. Data Model & Access

Two clearly separated entities.

### 3.1 Person / Account data (owned by each logged-in user)
Lives in the signed-in user's own account.
- Profile: **name, height (m)**, other personal info.
- **Weight history:** dated weight entries (a weight per date) + related info.
- **Only the owner can add or edit their own weight** — there is no logging weight on behalf of anyone else.
- Each logged-in user keeps their personal information in their own account.

### 3.2 Dashboard data (a collaboration object)
A dashboard ties multiple people together around shared goals.
- **Members:** the users in the dashboard, each with a role — **edit** (can change dashboard-level data: goals, habits, members, sharing) or **read**. *(Editing weight is never granted here — weight is self-only, §3.3.)*
- **Tracked people:** references to the member accounts whose weight data the dashboard displays.
- **Targets & timelines:** per-person goals (target weight, optional target date) + the shared team goal.
- **Daily checklist:** habit items + their daily completion log (see §5).
- **Sharing settings:** Google accounts granted read/edit + a tokenized public **read-only link**.

### 3.3 Access rules
- **Creating a dashboard:** a user creates a dashboard and invites other users to collaborate. On
  the other user **accepting** the request, the dashboard appears in **both** accounts.
- **Weight is self-only.** A user can add/edit **only their own** weight entries — never anyone
  else's. There is no "log for another person" path anywhere in the app.
- **Dashboard edit access** lets an editor change **dashboard-level data only**: the shared/team
  goal, the per-person targets shown in the dashboard, habits, members, and sharing settings. It does
  **not** grant editing another member's weight history.
- **Read access** can be granted to specific Google accounts, **or** to anyone via a special
  **read-only link that requires no login**.
- Read-only is enforced at the Firestore **security-rule layer**, not just hidden in the UI.

### 3.4 Worked example (Parth + wife)
1. Parth's account holds his weight history, height, and personal info. His wife's account holds hers.
2. Parth creates a **collaborated dashboard** between the two of them.
3. The dashboard shows in **both** accounts with **edit access for both** — so both can edit the
   shared goals, targets, and habits. **Each still logs only their own weight** (Parth can't edit
   Priya's entries, and vice-versa).
4. The **targets and timelines** live in the dashboard; both follow the shared view and stay motivated.
5. Parth can later share the dashboard with any other user (read-only or edit), or generate a
   **read-only link** for others to view without logging in.

> **Technical note:** weight data is **owner-write only** — security rules let a user write just
> their own entries. To let co-members and read-only viewers *see* that weight, the implementation
> denormalizes a "viewers" permission list (derived from accepted dashboard memberships + the
> read-only link token) onto the data for **read** authorization. No cross-account *write* path is
> needed, which simplifies the rules. To be finalized during the data-layer milestone.

---

## 4. Data Entry (must be effortless — least clicks possible)

- **Self-only:** every entry flow below adds/edits **the signed-in user's own** weight — there is no
  person picker and no logging for anyone else.
- **Fast single entry = a quick popup.** Logging today's weight happens in a small **modal** (weight +
  date defaulting to today + optional note) without leaving the page; an **"Advanced"** action in the
  popup opens the full entry page for bulk / CSV / back-dating. Keep the popup minimal — **no redundant
  chrome** ("saving to account", "only you may log your own weight", etc.) and **no "Today's weight"**
  framing (an entry can be for any date).
- **Bulk / backfill entry:** on first use a person may need to enter the **previous one or two months**
  of data at once; later they add daily. Both flows must be quick.
- **CSV import:** user can backfill by importing a **CSV**. The importer must be **format-flexible and
  low-friction**: show the expected format up front (and/or offer a template), **auto-detect columns
  and the date format** (ISO `YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`, named-month, etc.) with a
  confirm/override step, **preview parsed rows** before saving, and flag any unparseable rows — fewest
  steps possible.
- **Edit / delete:** any past entry can be corrected or removed.
- **Missing days are normal:** interpolate the trend across gaps, mark gaps honestly, never break the chart.
- **Guidance:** gently suggest weighing first thing in the morning, same conditions, for consistent data.

---

## 5. Daily Checklist (habits)

- A dashboard can hold a **checklist of items** both members aim to complete daily.
- **Habits live inside the dashboard — there is no separate global "Habits" page.** Adding a habit,
  the daily check-off, and the streak/history view all happen on the dashboard surface itself.
- Habits are framed around the **dashboard's shared goal / milestone** — the daily behaviors the
  members believe will move them toward the target — not as a standalone, context-free tracker.
- Items can be **added to the dashboard** and **marked for any date** — **today by default**, but a
  user can back-date a tick for a day they forgot (check off whatever was done).
- **Each member checks off their own** completion (consistent with self-only data); the streak view
  can show progress **per person** and visually highlight days **both** completed.
- A **distinct visualization within the dashboard** shows what was completed over the **last week /
  month** and any **streaks** — a habit-grid / streak view separate from the weight chart, but on
  the same dashboard.

---

## 6. Dashboard Functional Requirements

### 6.1 The Chart (centerpiece)
- **Hero visual = smoothed trend line (EMA)** over faint raw daily dots — so normal daily water-noise
  (±1–2 kg) never reads as failure.
- **Multiple people overlaid**, each their own color, individually toggleable.
- **Switchable layers:**
  - **Projected trend** — recent slope extrapolated forward; hedged honestly (a range, or "unknown"
    if the trend moves away from the goal). No falsely precise single date.
  - **Ideal line to follow** — from today's weight to the target weight by the target date.
  - **Goal line** — with a ± band so daily noise doesn't flip "reached goal" on and off.
- **Configurable date range**; pinch-zoom / pan on mobile.

### 6.2 Progress & Prediction
- Current weight, trend weight, total change, weekly rate of change.
- Multi-window deltas (**1 / 7 / 14 / 28-day**), shown only when enough data exists.
- Projected goal date; on-track / ahead / behind status vs the ideal line.
- BMI + healthy-weight band per person (height optional → BMI shown only if a height is entered).

### 6.3 Goals (held in the dashboard)
- **Per-person goal, target date optional:**
  - *With a date* → draw the ideal descent line + run a pace check (on track / ahead / behind).
  - *Without a date* → compute a realistic ETA at a safe pace.
- **Shared team goal** — a combined collaborative goal (e.g. "together lose 15 kg" or "both log
  12 weeks straight") alongside each person's own goal.

### 6.4 Motivation Engine
- **Trend-driven state machine** with warm, self-compassionate copy, debounced so it doesn't flip
  daily and rotated so it doesn't feel robotic:
  - **On track** — reinforce consistency, attribute success to their actions.
  - **Ahead** — celebrate, gently set sustainable expectations.
  - **Behind** — redirect to controllable process + NSVs, no blame.
  - **Plateau** (flat trend ~2–3+ weeks) — normalize, surface NSVs, re-anchor on process.
  - **Small regain / daily spike** — self-compassion + one easy next action (highest churn-risk state).
  - **Milestone hit** — high-salience intrinsic celebration tied to meaning.
- **Milestone ladder** — 5% / 10% of body weight (thresholds with real health benefits).
- **Forgiving streaks** — grace days / streak repair; a break is recoverable, never "lost."
- **Non-scale-victory (NSV) notes** — optional log of wins like better sleep, looser clothes, more energy.
- **Per-person state.** The state machine runs **per person** — each person sees their own motivation
  message (one may be on a plateau while the other is ahead). Never blend both into a single shared
  "mood," and never show one person a message driven by the other's data.
- **Collaborative framing, not social nudging** — there is a shared team goal and each person is
  measured against their *own* baseline. **No** head-to-head ranking, **no** "your partner hasn't
  logged" nagging/surveillance, and **no social-poke prompts** (e.g. "you both logged this week —
  send a clap"). Motivation comes from a person's own progress, never from prompting pokes.

### 6.5 Customization
- Smoothing window, which people/layers are shown, units display, goals. *(No user theme/accent
  picker — the app keeps one fixed calm accent.)*

### 6.6 Safety
- Safe-pace logic: healthy loss is **0.5–1.0 kg/week**; warn when a goal implies an unsafe pace.
- "Not medical advice" disclaimer surfaced in the UI.

---

## 7. Technical Requirements

- **No server to spawn or host.** Everything runs client-side; deployed as a compiled static bundle
  to GitHub Pages (`vite.config.js` `base: '/<repo-name>/'`).
- **Database:** Firebase Firestore (Spark free tier — 1 GB storage, 50K reads / 20K writes per day;
  far more than a couple needs).
- **Auth:** Firebase Google sign-in. Security Rules: **weight is owner-write only**; dashboard-level
  data is editable by dashboard editors; **read** authorized for dashboard members + tokenized
  read-only links via denormalized viewer lists (§3.4).
- **Charts:** Chart.js + `chartjs-plugin-annotation` (goal/projection/ideal lines) +
  `chartjs-plugin-zoom` (mobile pinch/pan), via `react-chartjs-2`.
- **CSV import** parsing client-side.
- **Mobile-friendly / responsive** throughout.

---

## 8. Health Reference (to encode, with disclaimer)

- **Safe loss rate:** 0.5–1.0 kg/week (CDC/NHS); flag faster than ~1 kg/week or >1%/week as aggressive.
- **Daily fluctuation:** ±1–2 kg from water/sodium/food/glycogen/hormones — fat does not change
  overnight → trend line over raw weight.
- **Weigh-in:** morning, after toilet, before eating/dressing, same conditions.
- **BMI:** `BMI = weight(kg) / height(m)²`. Underweight <18.5, Healthy 18.5–24.9, Overweight
  25–29.9, Obese ≥30. (Consider lower Asian-population cut-offs as a future toggle.)
- **Healthy weight range:** `18.5 × height²` to `24.9 × height²` kg.
- **Plateaus:** normal and universal; detect as no net trend change over ~2–4 weeks; reassure +
  give actionable tips, don't discourage.
- **Goal setting:** realistic milestones (5–10% of body weight over ~6 months); warn against crash
  diets (gallstone & lean-mass risk; VLCDs ≤800 kcal/day need medical supervision).

---

## 9. Milestones (build plan)

### Milestone 1 — Auth shell
- App with a **login page**.
- After login, a **WIP Home page UI** with a **logout button**.

### Milestone 2 — Data entry & view backend (non-shareable yet)
- User can add their **personal data**.
- Add **weight details** — single item **and** bulk items (and CSV import).
- **Create and share a dashboard** (collaboration request).
- Once a collaboration request is **accepted** in another account, the dashboard shows in **both** accounts.
- Each user logs **their own** weight; dashboard editors can change **dashboard-level** data (goals,
  habits) — **not** another member's weight entries (§3.3).
- Keep UI changes **light** at this stage.
- **Goal: make the data entry / data access module rock-solid.**

### Milestone 3 — Home page polish + sharing
- Make the **Home page UI pixel-perfect**.
- Add **dashboard sharing** with other users — with login (read/edit) **and** without login (read-only link).
- Build the **navigation shell** (§11): sidebar with a *Dashboards* list page + the 5
  most-recently-updated dashboards as quick links; stable per-dashboard routes (`/dashboard/:id`).
- Implement **post-login landing** (§11.2): open the most-recently-active dashboard, else the
  dashboards list; handle the no-dashboards empty state.
- Finish off **home-screen features**: login/logout, account info, personal details, notification
  bar, etc. (Leave dashboard-internal features for Milestone 4.)

### Milestone 4 — Dashboard UI & features
- Make the **dashboard UI perfect**.
- Add the **charts** (trend, projection, ideal line, goal band, multi-person).
- Add the **Motivation Engine**.
- Add remaining dashboard features **inside the dashboard**: daily checklist + streak visualization
  (no global habits page — §5), customization, etc.

---

## 10. Scope & Assumptions

### In scope (across milestones)
- Per-account personal data (**weight is self-only**); collaborated dashboards with per-dashboard edit/read access for dashboard-level data.
- Single + bulk + CSV weight entry, edit/delete, gap handling.
- EMA trend chart with raw dots, multiple people, projection / ideal / goal layers.
- Progress stats, multi-window deltas, BMI, predictions.
- Per-person goals (date optional) + shared team goal (in dashboard).
- Daily checklist + streak/history visualization.
- Full motivation engine.
- Dashboard sharing: Google-account read/edit + read-only no-login link.
- Light, clean, mobile-first UI.

### Assumptions
- Weight in kg, height in meters — no imperial/lb toggle.
- No push notifications in v1 (true push needs a server; optional local reminder later).
  A home-screen **notification bar** (in-app) is in scope per Milestone 3.
- Weight is the only tracked health metric — no body-fat / waist measurements for now.

### Out of scope (candidates for later)
- Push notifications / reminders
- Additional body metrics (body fat, measurements)
- CSV export (import is in scope)
- Imperial units
- Native mobile apps

---

## 11. App Shell, Navigation & Landing

The app is **dashboard-centric**: a dashboard is where people actually live, so navigation is built
around getting to the right dashboard fast.

### 11.1 Sidebar
- Brand, then primary navigation.
- A **Dashboards** entry that opens the full **Dashboards list** page (every dashboard the signed-in
  user is a member of — owned or shared with them).
- Directly under it, the **5 most-recently-updated dashboards** the user belongs to (collaboration
  dashboards prioritized over view-only), each a direct link that opens that dashboard. (More than
  5 → the rest live on the Dashboards list page.)
- Account / profile at the bottom (name, sign out).

### 11.2 Post-login landing
On sign-in, route the user to where the action is. **Collaboration dashboards take priority over
view-only ones.**
- If a **collaboration** dashboard was **updated within the last 7 days**, open the
  most-recently-updated one directly.
- Else if a **view-only** dashboard was updated within the last 7 days, open the
  most-recently-updated one of those.
- Otherwise, open the **Dashboards list** (§11.3).
- A **new user with no dashboards** lands on the Dashboards list in an **empty state** that prompts
  them to create a dashboard or accept a pending invite.

### 11.3 Dashboards list ("shared with you")
The list separates a user's dashboards by access, **collaboration shown first**:
- **Collaborating** — dashboards where the user has **edit** access (ones they own + ones shared to
  them as an editor).
- **View only** — dashboards shared to the user's account as **read** access.
- Plus a **Create new dashboard** affordance and any **pending invites** (accept / decline).

### 11.4 "Updated" definition (drives 11.1 recents + 11.2 auto-open)
A dashboard's `updatedAt` is bumped by any change to its data: a new/edited weight entry for a
tracked person, a habit check-off, a goal/target change, an NSV note, or a membership change. The
same timestamp orders the sidebar recents and decides the auto-open.

### 11.5 Routing
- Each dashboard has a **stable route** (`/dashboard/:id`); sidebar recents and the list page link to
  specific dashboards by id.
- The **read-only no-login view** is a separate **tokenized public route** that renders the dashboard
  with **no app chrome and no edit controls** (§3.3).
- **Habits** and dashboard-scoped **weight entry/edit** are reached **within** a dashboard (§5, §4);
  a lightweight "add my own weight" stays available for quick personal logging.

### 11.6 Surfaces & chrome
- **Prefer modals over full pages** for focused actions — quick add-weight, create dashboard, share,
  dashboard settings, goal editor — so the user keeps context. Reserve full pages for the dashboard,
  the dashboards list, the full (advanced) weight-entry page, and login.
- **Create and Share are separate flows.** Creating a dashboard (name + first goal + invite) and
  sharing an existing one (manage members/roles + the read-only link) are **distinct** — do not merge
  them, don't expose "create" from the share surface, and don't put rename-dashboard on share.
- **No "Profile" item in the sidebar nav.** The Profile/account page opens by clicking the **account
  chip** (name / photo / email) at the **bottom of the sidebar**.
