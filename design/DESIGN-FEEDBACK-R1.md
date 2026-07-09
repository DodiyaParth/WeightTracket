# Design Feedback — Round 1 (on the current prototype)

**Date:** 2026-06-30 · **From:** Product · **Spec:** `../REQUIREMENTS.md` · builds on `DESIGNER-BRIEF.md`

Feedback on the as-built prototype. One headline product change (§0) plus page-level fixes. Items
combine Parth's notes with my review. Dashboard interior stays a placeholder this round (confirmed).

---

## 0. Headline change — weight logging is now **self-only** (product decision)

**A user logs and edits only their *own* weight. No one can add or edit anyone else's weight.** This
reverses the earlier "co-editors edit each other's weight" model.

What changes in the UI:
- **Add weight (single entry):** **remove the "For: [person]" picker.** Entries are always for the
  signed-in user.
- **Bulk backfill + CSV import:** for the signed-in user's own data only.
- **Create / Share dashboard:** the "edit" role now means *edit the dashboard's shared content*
  (goals, habits, team goal, members, sharing) — **not** other people's weight. Fix the copy (see §3).
- A dashboard still **shows** both people's weight (read) and all the shared goals/habits — only the
  *writing* of a weight number is restricted to its owner.

**Why:** cleaner data ownership and privacy, and a much simpler security model. The collaboration
value lives in shared goals, habits, and motivation — not in editing each other's numbers.

*Requirements updated:* §2 (Edit access), §3.1–§3.4, §4, §7, §9 (M2), §10.

---

## 1. Add weight page

### 1.1 CSV import — make the format obvious and flexible *(priority)*
**Problem:** from the page you can't tell what file/format is expected, and dates come in many formats.
**Changes:**
- In the empty/dropzone state, **state the expected format up front** — which columns are needed
  ("a date column + a weight column in kg") — and **offer a downloadable template / visible example**.
- On upload, **auto-detect the columns and the date format**, then let the user **confirm or override**
  the date format (ISO `YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`, named-month like `Jun 30 2026`).
- **Preview the first parsed rows** before saving; show the row count and **flag any rows that can't
  be parsed** (don't silently drop them).
- Target flow = **detect → confirm → import** (fewest steps).

### 1.2 Recent entries box — visual cleanup
**Problem:** the box reads as off / inconsistent with the rest of the UI.
**Changes:**
- Align it to the app's list style: consistent row rhythm and spacing, a hover state, and the same
  icon-button treatment used elsewhere for edit/delete.
- **Drop the redundant "who"** — all entries are the signed-in user now (§0).
- Consider grouping by date with lighter dividers so it doesn't feel boxy.

### 1.3 Remove the person picker
Covered by §0 — calling it out so it isn't missed.

---

## 2. Profile page

- **2.1 Don't place Display name + Height side by side.** Stack them full-width (no real product puts
  these two in one row). Keep height **optional** with its helper text about BMI.
- **2.2 Remove the Theme accent card entirely.** The app keeps one fixed calm accent — no user picker.
  *(Requirements §6.5 updated.)*
- **2.3 Remove the "Your dashboards" card from Profile.** Dashboards are reached from the sidebar /
  Dashboards list — they don't belong on the profile.
- **2.4 Reflow after removals.** With Theme accent and the dashboards card gone, the right column is
  nearly empty — rebalance to a clean single column (or keep just the Account card), so the page
  doesn't look lopsided.
- **(Open, non-blocking)** "Trend smoothing" and "Show raw daily dots" are *chart* preferences. They
  may fit better on the dashboard (with the chart) than in global Profile — flagging for when we build
  the dashboard interior. No action now.

---

## 3. Create / Share dashboard page — copy fix (driven by §0)

The current line **"Editors can add and edit weight data for everyone tracked in this dashboard"** is
now incorrect. Replace with, e.g.:

> *"Editors can edit the dashboard's goals and habits. Each person always logs their own weight."*

Keep the **Can edit / Read only** role control as is — it now applies to dashboard-level content.

---

## 4. Dashboard placeholders — unchanged this round
Confirmed: the dashboard interior stays as the current mock; we iterate next phase.

---

## What I changed in REQUIREMENTS.md
- **§2 Key Decisions** — "Edit access" row rewritten (weight self-only; edit role = dashboard-level).
- **§3.1–§3.4** — self-only weight ownership; dashboard edit scope clarified; worked example + the
  data-layer technical note updated (owner-write, read via denormalized viewer list).
- **§4 Data Entry** — self-only note; CSV importer requirements (format-flexible, auto-detect, preview).
- **§6.5 Customization** — removed the theme/accent picker.
- **§7 Technical** — security-rules summary updated (owner-write weight; read via viewer lists).
- **§9 M2 / §10 Scope** — wording aligned to self-only.
