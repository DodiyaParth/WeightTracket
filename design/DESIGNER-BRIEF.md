# Designer Brief — WeightTracker full prototype (high-level pass)

**Date:** 2026-06-30 · **From:** Product · **Spec:** `../REQUIREMENTS.md`

## Goal of this round
Lock the **high-level page structure, navigation, and the collaboration model** end to end. Build the
full set of high-level pages so we can validate the flow. We go deeper into each page **after** this
shape is approved.

---

## Scope — read first

**In scope (design these):**
- The **navigation shell** (sidebar + post-login landing).
- The **Dashboards list** page with the **collaborator vs view-only** split.
- The **read-only / no-login public dashboard view**.
- Page-level passes of: Login, Create/Share dashboard, Add weight, Profile.
- **Desktop layouts only.**

**Deferred — do NOT design this round:**
- **Mobile / responsive.** Desktop only for now. (The shipped product is mobile-first later — not this pass.)
- **Dashboard interior.** Keep the **existing mocked dashboard** as a placeholder. No rework of the
  chart, projection, stat tiles, goals, BMI, deltas internals.
- **Motivation engine** (states, copy, milestone UI) — excluded entirely this round.
- **Habit interior UI** (checklist + streak grid) — habits *belong inside* the dashboard, but the
  detailed habit UI is part of the deferred dashboard-interior pass.
- In-dashboard warning/empty micro-states (unsafe-pace, honest-projection visuals, not-enough-data).

> These deferrals **override** the matching items in `PM-DESIGN-REVIEW.md`. That review stays as the
> backlog for the later dashboard-interior pass — **except B3 (read-only view), which is in scope now.**

---

## Page inventory (high level)

1. **Login** — keep as is. Google sign-in + "not medical advice" disclaimer.

2. **Dashboards list** *(redesign — this is the main landing)*. Two clearly separated sections:
   - **Collaborating** — dashboards where I have **edit** access (ones I own + ones shared to me as editor).
   - **View only** — dashboards shared to my account as **read** access.
   - **Pending invites** (Accept / Decline) and a **Create new dashboard** affordance.
   - **Empty state** (no dashboards yet) — prompt to create or accept an invite.
   - Each card shows its access plainly (e.g. an "Editor" vs "View only" tag), members, and last-updated.

3. **Dashboard detail** — **keep the current mock as a placeholder.** High-level shell only; don't
   redesign internals. (Habits, motivation, and the detailed chart are a later pass.)

4. **Read-only / no-login dashboard view** *(NEW — design now)*. What the public link opens:
   - **No login, no sidebar, no account menu.**
   - Minimal top bar: app logo + dashboard name + a **"View only"** badge.
   - Renders the (mocked) dashboard content **read-only** — **no** Add / Edit / Share / Edit-goal /
     Add-habit controls anywhere.
   - "Not medical advice" disclaimer present.
   - A subtle **"Sign in to track your own"** CTA.

5. **Add weight** — keep (single entry / bulk backfill / CSV import). This global entry is for
   **my own** weight; editing other people's data happens inside a shared dashboard (later pass).

6. **Create / share dashboard** — keep. Members & roles (**Can edit** / **Read only**), email invite,
   and the **read-only link** toggle. This page is where the collaborator-vs-view-only relationship is set.

7. **Profile / settings** — keep.

---

## Navigation shell (desktop sidebar)
- Brand at top.
- Primary nav: **Dashboards** (→ list), **Add weight**, **Profile**. **Remove the global "Habits" item.**
- Under Dashboards: the **5 most-recently-updated dashboards** as quick links, **collaboration
  dashboards prioritized over view-only**. Show an active/selected state for the current one.
- Account (name, sign out) pinned at the bottom.
- The **read-only no-login view has no sidebar.**

## Post-login landing logic
1. A **collaboration** dashboard updated in the last 7 days → open the most-recent one.
2. Else a **view-only** dashboard updated in the last 7 days → open the most-recent of those.
3. Else → **Dashboards list**.
4. No dashboards → Dashboards list **empty state**.

Collaboration always beats view-only. "Updated" = any weight entry, habit check, goal change, NSV
note, or membership change.

## Collaboration vs view-only — carry this through the whole app
- **Collaborator** = edit access (add/edit weight for everyone tracked, edit goals/habits).
- **View-only** = read access (account-based or via the no-login link) — **no** edit/add/share controls anywhere.
- The Dashboards list sections, the sidebar recents order, and the landing logic all honor this split,
  **collaboration first**.

---

## Deliverables for this round
- Desktop mockups of: **Dashboards list** (with both sections + empty state), the **sidebar shell**
  (recents + active state), and the **read-only no-login view**.
- Show **at least two distinct dashboard cards** — one *Collaborating*, one *View only* — so the split reads clearly.
- Light page-level passes of Login / Create-share / Add weight / Profile only where the nav shell or
  access tags touch them. Leave the dashboard interior as the current mock.

## Resolved decisions (for reference)
1. "Shared with you" = **collaborator vs view-only** split. ✔
2. "Updated" = any weight / habit / goal / NSV / membership change. ✔
3. Several updated within 7 days → open the **single most-recent**, **collaboration before view-only**. ✔
