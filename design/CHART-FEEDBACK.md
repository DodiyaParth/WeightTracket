# Chart / Graph — Design Feedback (dedicated)

**Date:** 2026-06-30 · **From:** Product · **Spec:** `../REQUIREMENTS.md` §6.1–6.2, §6.5, §8
**Scope:** the weight-trend graph only. Parth flagged this as the area needing the most work — this doc is the deep pass. Findings are grounded in the current `components/Chart.jsx`.

> Production reminder: the real chart is **Chart.js + chartjs-plugin-annotation + chartjs-plugin-zoom** via `react-chartjs-2`. The prototype hand-draws SVG just to show layout — but the design must specify the behaviors below so the Chart.js build is unambiguous.

---

## TL;DR — the 5 highest-leverage fixes
1. **Add real axes.** There is no date (x) axis and no weight (y) axis labels at all. This is the biggest comprehension gap.
2. **Build real timeline navigation** (your point) — the current zoom is fake and pan is promised but doesn't exist. Add scroll/pinch zoom, drag-pan, and a **scrubber strip**.
3. **Remove on-canvas jargon** (your point) — "gap · interpolated" and "trend moving away — no estimate" are printed as raw text on the plot. Replace with tooltips/badges.
4. **Add a line-style key + hover tooltip** so a first-timer can tell the trend line from raw dots from the ideal/goal/projection lines, and can read any point's value+date.
5. **Make people/goals/projection per-person and N-person**, not hardcoded to the two-person couple.

---

## A. Reading the chart (comprehension)

### A1. No date axis — the graph has no sense of time `[Chart.jsx:78–129]`
Only horizontal gridlines are drawn; there are **no date ticks**, no vertical gridlines, and the data arrays carry no dates. A new user can't tell what span they're viewing or when anything happened, and the "projected late Sep – mid Oct" claim has no visual anchor.
- **Fix:** draw a bottom date axis (~4–6 ticks formatted to the active range, e.g. "Apr 7 · Apr 21 · May 5…") plus a faint **"today"** vertical marker where real data ends and projection begins. Production data must attach an ISO date to every entry (`{x: date, y: kg}`).

### A2. No weight axis labels or units `[Chart.jsx:79–82]`
Five gridlines imply a scale but show **no kg values and no unit**. The y-domain also auto-fits per toggle (`min/max ±1.2`, line 31), so the same trend looks steeper/flatter as you switch range or hide a person — with no axis to calibrate against.
- **Fix:** label each gridline with its kg value (right-aligned in the left gutter, `PAD.l=38` already reserves the space) + a "kg" caption. Consider locking the y-domain across toggles so slope doesn't visually jump.

### A3. Legend exists, but there's no key for the *line types* `[Chart.jsx:56–64, 131–137]`
> Correction to your note: a **person** legend (Parth/Priya color toggles) *does* exist and works. The real gap is different and you're right that the lines aren't legible:
The chart draws many distinct marks that are **never explained**: solid EMA trend vs faint raw dots (a newcomer reads these as two unrelated things), the grey-dashed **ideal** line, the teal-dashed **goal** line, the teal **goal band**, and the dashed **projection** + band. The layer-toggle chips name the layers but don't show their actual line style.
- **Fix:** add a compact **line-style key** — small swatches: solid line = "Trend", dot = "Daily reading", grey dash = "Ideal", teal dash = "Goal", shaded = "Projected range / Goal band". Make the layer-toggle swatches mirror the real style (a dashed mini-line for dashed layers, not the generic dot at line 134).

### A4. Raw-dots vs trend distinction is too faint to teach the core idea `[Chart.jsx:96–97, 100]`
The hero premise (§6.1: smoothed trend over faint raw dots so daily noise doesn't read as failure) only works if the user *understands* dots = noisy daily readings, line = real signal. At `r=2, opacity 0.22` the dots are nearly invisible and unlabeled — the teaching moment is lost.
- **Fix:** raise dot visibility slightly, add the key from A3, and consider a one-time inline hint ("the line smooths daily ups and downs"). Tie to the smoothing control (E1).

### A5. No hover / tooltip anywhere `[Chart.jsx:78–129]`
There's no crosshair, tooltip, or point read-out. For a chart-centric product, "what did I weigh on May 12 / what's the trend here?" is table stakes.
- **Fix:** design a hover/tap tooltip — vertical crosshair snapped to the nearest date, showing each visible person's trend value + raw value + date; on gap days, "estimated (no weigh-in)". Tap-to-inspect on mobile. (Free with Chart.js, but specify content + styling.)

---

## B. Navigating the timeline (your point #1.3 — confirmed, and worse)

### B1. The zoom control is fake `[Chart.jsx:65–69]`
The `+`/`−` buttons don't zoom — they hard-jump the range to `All` / `4w`. There's no zoom **percentage**, no incremental zoom, no zoom read-out.

### B2. Pan is promised but doesn't exist `[Chart.jsx:66]`
The wrapper's `title="Zoom (drag chart to pan)"` advertises panning, but there is **no drag/pan handler anywhere**. The tooltip lies to the user.

### B3. No scrubber / slider / minimap to move through time
Once you pick a range you're stuck at its right edge — you can't inspect "weeks 2–5 of the full history." There's no brush or scrubber. (This is your "slider to view through the timeline.")

### B4. Two controls fight over one state `[Chart.jsx:65–74]`
The fake zoom buttons and the range tabs both write the same `range` variable with mismatched metaphors ("zoom in/out" vs "pick a window"), so the zoom buttons feel broken.

### B5. Range tabs don't actually differ `[Chart.jsx:6]`
`RANGE_PTS = {'4w':14,'8w':22,'12w':30,'All':30}` — "All" equals "12w", and the labels (weeks) don't match the point counts. With only 30 data points, 8w/12w/All render near-identical views, which also masks B3 (nothing to pan to).

**Fix for B (the navigation model to design):**
- **Real zoom:** scroll/pinch to zoom, with an optional **zoom-% read-out** and a **"Reset zoom"** affordance (production: `chartjs-plugin-zoom`).
- **Real pan:** drag to pan once zoomed (and remove the misleading tooltip until it works).
- **Scrubber strip:** a mini full-history sparkline beneath the main chart with a **draggable window** so the user can slide through time and always see where they are.
- **One model, not two:** keep range presets as quick jumps *and* free zoom/pan + scrubber; drop the fake `+`/`−`. 
- Drive ranges off **dates**, not point counts; make "All" truly span the full history (and give the prototype enough dated data that ranges visibly differ).

---

## C. Honesty (projection, gaps, few-data)

### C1. Remove on-canvas jargon — "gap · interpolated" `[Chart.jsx:126–128]` (your point #1.4 — confirmed)
"Interpolated" is engineering jargon stamped on the user's weight chart. §4 says mark gaps *honestly* — honest means legible to a human, not exposing the algorithm's name.
- **Fix:** render the trend across the gap as a lighter/dashed segment with **no word "interpolated"**; if any label is needed, "no entries these days," and ideally only in the hover tooltip ("estimated — no weigh-ins Apr 24–26"). A subtle shaded vertical band over the missing dates communicates the gap without naming the method.

### C2. The "no estimate" message is also raw on-canvas text `[Chart.jsx:118–120]`
"trend moving away — no estimate" is bare amber text floating near the last point with no background — it will collide with gridlines, the end-dot, and the goal/ideal lines. The *state* is correct (§6.1) but it's presented as debug text.
- **Fix:** render as a proper **pill/badge** (rounded chip, `--amber-tint`), anchored in a clear empty region or attached to the projection legend entry — and keep the wording identical to the stat tile ("trend moving away" / "No estimate").

### C3. The projection band doesn't *read* as an honest range `[Chart.jsx:37–42, 113–117]`
A band exists (good), but a solid-ish dashed **centerline** sits on top and visually dominates — so it still reads as "one predicted path," the exact false precision §6.1 warns against. The band width is also cosmetic (fixed ±0.25/step), not tied to real uncertainty, and the honest end-date *range* lives only in the stat text, never on the chart.
- **Fix:** de-emphasize or drop the centerline so the **band is the message**; widen the band with real uncertainty; project it **down to the date axis as a shaded "goal likely in this window" range**, not a single tick. Label it "Projected range (estimate)" in the key.

### C4. Few-data honesty isn't applied inside the chart `[Chart.jsx vs DashboardBody.jsx:44–48]`
The stat tiles correctly **lock** projection under 14 days, but the chart still draws a confident EMA + projection + ideal off a handful of noisy points. A single point has no defined look, and there's no "one person logged, the other hasn't" partial state on the chart.
- **Fix:** mirror the 14-day rule in the chart — hide projection/ideal until enough points exist; show raw dots + a tentative short trend + "more data needed for projection"; define the 0/1-point look; draw "person A has data, B doesn't" as A's line + B shown "no data yet" in the legend.

### C5. Gap rendering uses a brittle hack `[Chart.jsx:102–109]`
The "paint a `--canvas`-colored stroke over the trend, then a dashed stroke on top" technique will also erase the goal band/gridlines underneath, distinguishes the gap by dash+opacity alone (weak for a11y), is hardcoded to indices `[17,18,19]`, and applies only to Parth.
- **Fix:** represent gaps as a **shaded vertical band** over the missing dates (works for all series) with a lighter dashed trend across it + the tooltip from C1. Make it general, not per-person-hardcoded.

---

## D. Multi-person & goals (per-person / N-person)

### D1. The chart is hard-capped at two people `[Chart.jsx:13, 57–64, 96–123]`
Toggles, colors, projection (Parth-only, line 27), and end-dots are all bespoke per name (`people.parth`/`people.priya`). A 3–4 member dashboard (which the data model already has) structurally can't be drawn, and the color pool even reuses colors (`mom`/`priya` both `--p2`), so two lines could be indistinguishable.
- **Fix:** iterate over the dashboard's tracked-people list (N series) — generate legend toggles, colors, dots, and projection per person; assign **unique colors per dashboard** at render time. Show the design with 3–4 people so it's clearly not couple-only.

### D2. Goal/ideal are hardcoded to one person `[Chart.jsx:29, 86, 91–93]`
`target=80` (Parth's) is drawn for **everyone** — toggle Priya solo and she still sees an 80 kg goal line that's meaningless (her target is 66). The ideal line also runs from the last point to the right edge, not "from today to target **by the target date**" (§6.1/§6.3) — and without a date axis it can't express the target date at all. The ± band is unlabeled.
- **Fix:** make goal/ideal **per-person**, following the focused/visible people (one faint goal line per visible person in their color, or the focused person's). Anchor the ideal line to the actual target **date** on the x-axis. Label the band ("Goal ±0.6 kg"). Decide + document behavior when 2+ people with different goals show at once.

---

## E. Customization

### E1. The required smoothing-window control is missing from the chart `[spec §6.5; alpha hardcoded in data.js:37]`
Smoothing is an explicit requirement and directly changes how the hero line looks, but there's no control near the chart. A user who finds the trend too jumpy/laggy has no recourse.
- **Fix:** add a small **"Smoothing"** control to the chart's customization cluster (a slider or 3-step "Less / Default / More" mapping to EMA windows), updating the trend live. (May also live in dashboard settings, but expose it near the chart.)

---

## How your three points map
| Your point | Verdict | Where |
|---|---|---|
| 1.2 "no legend for the lines" | **Refined** — a person legend exists, but no key for line *types* and it's 2-person-capped | A3, D1 |
| 1.3 "no slider / custom zoom % / navigation" | **Confirmed & worse** — fake zoom, non-existent pan, no scrubber, ranges identical | B1–B5 |
| 1.4 "'gap-interpolated' shown — not needed" | **Confirmed** — plus a second raw label ("trend moving away") | C1, C2 |

## Suggested build order for the chart
1. Axes + units + "today" marker (A1, A2). 2. Line-style key + hover tooltip (A3, A5). 3. Real zoom/pan + scrubber; kill fake controls; date-driven ranges (B). 4. Strip on-canvas text → tooltips/badges; honest projection band + few-data rule (C). 5. N-person + per-person goals/ideal (D). 6. Smoothing control (E).
