# WeightTracker (application/) — Designer Feedback

**Date:** 2026-07-01 · **From:** Product · **Spec:** `../REQUIREMENTS.md`
**Scope:** the built app in `application/`. Covers the two stakeholder points (numeric display, edit/confirm) plus error-state and a11y/polish. Implementation notes for the developer are in the companion `FEEDBACK-developer.md`.

---

## 1. Show every change as **direction + magnitude**, never a bare minus (stakeholder point 2)

**The problem:** a weight *loss* renders as `−4.7 kg`, which reads as bad even though it's the goal. The app currently uses **four different conventions** for the same kind of number, and the color classes are even named backwards (the "up" color class is applied to losses). In one place color is the only signal (fails color-blind users).

**The single treatment to apply everywhere:**

| Case | Show | Color | Notes |
|---|---|---|---|
| Weight **lost** | `↓ 4.7 kg` (or "4.7 kg lost") | accent (good) | never a `−` sign |
| Weight **gained** | `↑ 2.3 kg` ("gained") | rose (caution) | |
| **No change** | `— No change` / "steady" | muted | fixes today's `−0` glitch |
| **Weekly rate** | `↓ 0.42 kg/wk` **+ keep the safe-pace pill** | arrow muted when unsafe-fast | direction alone isn't the story — the pill (within 0.5–1.0) is |
| **Milestones** | `5% · ↓ 4.1 kg` (not `−4.1kg`); celebratory copy in words | accent | it's an achievement, not a loss-of-value |
| **Team "together" card** | `↓ 12.4 kg` (magnitude only) | accent | today it hardcodes a `−` on a pure win |
| **Maintaining** (at/below goal) | small gain reads **neutral** ("maintaining"), not bad | muted | "down is good" must not be assumed once at goal |

**Rules:** the **arrow + word carry the meaning; color only reinforces** (a11y — don't encode good/bad in color alone). Give the arrow a text label for screen readers. Keep it identical on every surface (stat tiles, deltas, dashboard cards, motivation, public view).

**Exact surfaces to redesign:** Total-change tile, Weekly-rate tile, the 1/7/14/28-day deltas, the dashboards-list "together" card stat, and the milestone chips + milestone-hit copy. *(Dev will centralize this in one formatter + rename the color tokens — see DEV-19.)*

---

## 2. Let people fix mistakes, and give a safety net at save time (stakeholder point 1)

Two separate needs: **(a) recoverability** — right now you can *add* lots of things you can't *edit or delete*; **(b) a safety net at add time.**

### 2a. Edit / delete affordances to design (where each control lives)

| Entity | Edit | Delete | Where the control lives |
|---|---|---|---|
| Weight entry | ✎ (today's edit is **broken on date change** — dev fixing) | 🗑 (works, confirmed) | the "Recent entries" list row |
| Habit item | rename + change emoji (every habit is a hardcoded ⭐ today) | remove | hover controls on the habit row |
| NSV / win note | (optional) | delete own note | hover control on the note row |
| Member | role (add a **confirm** on demote) | remove person | ✕ per member row in the Share modal |
| Dashboard | rename (**no rename exists today**) | delete / leave | a **"Danger zone"** + Name field in Dashboard **Settings** (not Share, per §11.6) |

Design these as quiet hover/secondary affordances (pencil / trash / ✕), consistent across rows, with destructive ones routed through the existing confirm dialog.

### 2b. Confirm-before-add vs. inline Undo — my recommendation

You asked for a **confirmation before adding**. The honest tradeoff: a confirm *dialog* on the quick-log directly fights the "fewest clicks" requirement (§4) for the most frequent daily action. The underlying need — "I don't want a mistake to be permanent" — is better met by **recoverability**:

- **Quick-log (today's weight):** keep the one-tap save, but make the confirmation toast **actionable** → **"Logged 83.2 kg · Undo"** (a few seconds). Same for edits/deletes. This is the safety net without the speed bump.
- **Bulk backfill:** a **"Save 12 entries?"** review/confirm *is* appropriate (batch write). CSV already has a preview step — mirror it.
- **Destructive actions** (delete entry/dashboard, remove member, demote, disable link): keep an explicit **Confirm dialog** (the pattern already exists for weight-delete and disabling the public link — reuse it).
- **Same-date logging:** if an entry already exists for that date, the quick-log should say **"You already logged 84.1 kg for this day — update it?"** instead of silently overwriting (it silently overwrites today).

**This is your call.** If you truly want a pre-add confirm on every log, we can — but I'd recommend the Undo pattern above. The designer should mock: the actionable Undo toast, the destructive Confirm dialog, the bulk "Save N?" confirm, and the "already logged today" update prompt.

---

## 3. Error states (currently misleading)

On a load failure (offline / permission), three screens fall through to the **wrong empty state**:
- Dashboard detail → "Dashboard not found" (implies deleted).
- Dashboards list → "No dashboards yet" (implies you have none).
- Public view → "This link is no longer active" (implies revoked).

Design a distinct **error card with a Retry** for each, visually different from the "genuinely empty" states, so a transient failure doesn't look like data loss or a dead link.

---

## 4. Accessibility & visual polish

- **Clickable cards aren't keyboard-focusable** — the dashboard cards (list + public) are `onClick` `<div>`s with no `role="button"`/`tabIndex`/Enter handling. The sidebar account chip already does this correctly — apply the same pattern to cards.
- **Toggles/segmented controls** (role pickers, the read-only-link switch) are non-semantic — add `role="switch"`/`aria-pressed` and keyboard support; the public-link toggle is a clickable `<span>`, make it a real control.
- **Color-only meaning** appears in the change numbers (fixed by §1) and the streak-grid "some/everyone/missed" legend — pair with shape/text.
- **Stat-tile consistency:** the 4th ("Projected goal") tile is hand-rolled with ad-hoc `fontSize:18` while the others use the shared `Tile` (28px value) — fold it into `Tile` so typography matches. Repeated inline pill spacing across the tiles should move into a CSS rule.
- Minor: some dead/duplicated code and orphaned CSS the dev will clean up (noted in the dev doc).

---

## Priority for the designer
1. **§1 numeric display** and **§2 edit/undo affordances** — your two points, highest impact on daily comprehension and trust.
2. **§3 error states** — cheap, removes a scary "did I lose my data?" moment.
3. **§4 a11y + polish** — the pixel-perfect pass.
