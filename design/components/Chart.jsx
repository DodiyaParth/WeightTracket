import React, { useState, useRef, useMemo } from 'react';
import { seriesFor, ema, SMOOTHING, fmtDate } from '../data.js';
import Icon from './Icon.jsx';

const W = 760, H = 300, P = { l: 44, r: 16, t: 16, b: 30 };
const SCRUB_H = 46;
const DAY = 86400000;
const PLOTW = W - P.l - P.r, PLOTH = H - P.t - P.b;
const PRESETS = { '4W': 28, '3M': 90, '6M': 180, All: 9999 };

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

export default function WeightChart({ people = [], focusId, goal, away = false, status = 'On track', enoughData = true }) {
  const [visible, setVisible] = useState(() => Object.fromEntries(people.map((p) => [p.id, true])));
  const [smooth, setSmooth] = useState('Default');
  const [rangeKey, setRangeKey] = useState('3M');
  const [hoverT, setHoverT] = useState(null);
  const mainRef = useRef(null), scrubRef = useRef(null), drag = useRef(null);

  // per-person prepared data
  const data = useMemo(() => people.map((p) => {
    const entries = seriesFor(p.id);
    const e = ema(entries.map((d) => d.kg), SMOOTHING[smooth]);
    const trend = entries.map((d, i) => ({ t: new Date(d.date).getTime(), v: e[i] }));
    const raw = entries.map((d) => ({ t: new Date(d.date).getTime(), v: d.kg }));
    // gaps: consecutive entries > 1.6 days apart
    const gaps = [];
    for (let i = 1; i < entries.length; i++) {
      const a = new Date(entries[i - 1].date).getTime(), b = new Date(entries[i].date).getTime();
      if (b - a > 1.6 * DAY) gaps.push([a, b]);
    }
    return { ...p, trend, raw, gaps };
  }), [people, smooth]);

  const todayT = useMemo(() => Math.max(...data.flatMap((d) => d.trend.map((x) => x.t))), [data]);
  const fullStartT = useMemo(() => Math.min(...data.flatMap((d) => d.trend.map((x) => x.t))), [data]);

  const winStart = useMemo(() => {
    const days = PRESETS[rangeKey];
    return rangeKey === 'All' || rangeKey === 'Custom' ? (rangeKey === 'Custom' ? custom.current : fullStartT) : Math.max(fullStartT, todayT - days * DAY);
  }, [rangeKey, todayT, fullStartT]);
  const custom = useRef(fullStartT);
  const start = rangeKey === 'Custom' ? custom.current : winStart;

  const projDays = away || !enoughData ? 8 : 34;
  const xMin = start, xMax = todayT + projDays * DAY;
  const x = (t) => P.l + ((t - xMin) / (xMax - xMin)) * PLOTW;

  // focused person + projection
  const focus = data.find((d) => d.id === focusId) || data[0];
  const lastTrend = focus ? focus.trend[focus.trend.length - 1] : null;
  const recent = focus ? focus.trend[focus.trend.length - 15] || focus.trend[0] : null;
  const slope = focus && enoughData ? (lastTrend.v - recent.v) / 14 : 0; // per day
  const projEnd = lastTrend ? lastTrend.v + slope * projDays : 0;

  // y-domain: locked across layer toggles (always include data + goal + projection)
  const yVals = [];
  data.forEach((d) => { if (visible[d.id]) d.trend.filter((p) => p.t >= xMin && p.t <= todayT).forEach((p) => yVals.push(p.v)); });
  if (goal) { yVals.push(goal.target + 1, goal.target - 1); }
  if (!away && enoughData) yVals.push(projEnd + 1.5, projEnd - 1.5);
  const yMin = Math.min(...yVals) - 0.8, yMax = Math.max(...yVals) + 0.8;
  const y = (v) => P.t + (1 - (v - yMin) / (yMax - yMin)) * PLOTH;

  const line = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'} ${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');

  // y gridlines (nice-ish)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => +(yMin + f * (yMax - yMin)).toFixed(0));
  // x date ticks (~5 across history)
  const histSpan = todayT - xMin;
  const xTicks = Array.from({ length: 5 }, (_, i) => xMin + (histSpan * i) / 4);

  // hover: nearest day for focus among visible people
  const onMove = (e) => {
    const r = mainRef.current.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    if (vx < P.l || vx > x(todayT)) { setHoverT(null); return; }
    const t = xMin + ((vx - P.l) / PLOTW) * (xMax - xMin);
    setHoverT(Math.round(t / DAY) * DAY);
  };
  const hoverRows = hoverT == null ? [] : data.filter((d) => visible[d.id]).map((d) => {
    const near = (arr) => arr.reduce((b, p) => Math.abs(p.t - hoverT) < Math.abs(b.t - hoverT) ? p : b);
    const tp = near(d.trend); const rp = d.raw.find((p) => Math.abs(p.t - hoverT) < DAY / 2);
    return { id: d.id, name: d.name, color: d.color, trend: tp.v, raw: rp ? rp.v : null, ty: y(tp.v) };
  });

  // scrubber geometry
  const sX = (t) => P.l + ((t - fullStartT) / (todayT - fullStartT)) * PLOTW;
  const sY = (v) => 8 + (1 - (v - yMin) / (yMax - yMin)) * (SCRUB_H - 16);
  const scrubLine = focus ? focus.trend.map((p, i) => `${i ? 'L' : 'M'} ${sX(p.t).toFixed(1)} ${sY(p.v).toFixed(1)}`).join(' ') : '';

  const startScrubDrag = (mode) => (e) => {
    e.preventDefault();
    const r = scrubRef.current.getBoundingClientRect();
    const toT = (cx) => fullStartT + (((cx - r.left) / r.width * W) - P.l) / PLOTW * (todayT - fullStartT);
    const width = todayT - start;
    const move = (ev) => {
      const t = toT(ev.clientX);
      if (mode === 'pan') custom.current = Math.min(todayT - 7 * DAY, Math.max(fullStartT, t - width / 2));
      else custom.current = Math.min(todayT - 7 * DAY, Math.max(fullStartT, t));
      setRangeKey('Custom');
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  const acc = (id) => css(data.find((d) => d.id === id)?.color || '--p1') || '#2aa897';
  const focusColor = acc(focusId);
  const projUp = (k) => projEnd + 0.28 * (projDays / 7) * k, projDn = (k) => projEnd - 0.28 * (projDays / 7) * k;

  return (
    <div className="chart-wrap">
      <div className="row between" style={{ marginBottom: 6 }}>
        <span className="card-title">Weight trend</span>
        <span className={away ? 'pill amber' : 'pill'}>{status}</span>
      </div>

      {/* legend (people) + line-style key */}
      <div className="row between wrap" style={{ marginBottom: 8, rowGap: 8 }}>
        <div className="legend">
          {data.map((d) => (
            <button key={d.id} className={'legend-toggle' + (visible[d.id] ? '' : ' off')} onClick={() => setVisible((s) => ({ ...s, [d.id]: !s[d.id] }))}>
              <span className="swatch" style={{ background: d.color }} />{d.name}
            </button>
          ))}
        </div>
        <div className="line-key">
          <span><svg width="22" height="8"><line x1="1" y1="4" x2="21" y2="4" stroke={focusColor} strokeWidth="2.4" /></svg>Trend</span>
          <span><svg width="22" height="8"><circle cx="11" cy="4" r="2.4" fill={focusColor} opacity="0.35" /></svg>Daily</span>
          <span><svg width="22" height="8"><line x1="1" y1="4" x2="21" y2="4" stroke="var(--muted)" strokeWidth="1.6" strokeDasharray="4 3" /></svg>Ideal</span>
          <span><svg width="22" height="8"><rect x="1" y="1" width="20" height="6" fill={focusColor} opacity="0.16" /></svg>Projected</span>
        </div>
      </div>

      {/* main plot */}
      <svg ref={mainRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMove} onMouseLeave={() => setHoverT(null)}>
        {/* future region tint */}
        <rect x={x(todayT)} y={P.t} width={x(xMax) - x(todayT)} height={PLOTH} fill="var(--surface-2)" />
        {/* y gridlines + labels */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth="1" />
            <text x={P.l - 8} y={y(v) + 3} fontSize="10" fill="var(--muted)" textAnchor="end">{v}{i === yTicks.length - 1 ? ' kg' : ''}</text>
          </g>
        ))}
        {/* gap shading (all persons) */}
        {data.filter((d) => visible[d.id]).flatMap((d) => d.gaps.map((g, i) => (
          <rect key={d.id + i} x={x(g[0])} y={P.t} width={Math.max(2, x(g[1]) - x(g[0]))} height={PLOTH} fill="var(--track)" opacity="0.5" />
        )))}
        {/* goal band + ideal (focused) */}
        {goal && (
          <>
            <rect x={P.l} y={y(goal.target + 0.6)} width={PLOTW} height={y(goal.target - 0.6) - y(goal.target + 0.6)} fill={focusColor} opacity="0.10" />
            <line x1={P.l} x2={W - P.r} y1={y(goal.target)} y2={y(goal.target)} stroke={focusColor} strokeWidth="1.3" strokeDasharray="2 4" opacity="0.7" />
            <text x={W - P.r} y={y(goal.target) - 5} fontSize="9.5" fill="var(--muted)" textAnchor="end">Goal ±0.6 kg</text>
          </>
        )}
        {enoughData && goal && lastTrend && (
          <line x1={x(todayT)} y1={y(lastTrend.v)} x2={x(Math.min(xMax, new Date(goal.targetISO).getTime()))} y2={y(goal.target)} stroke="var(--muted)" strokeWidth="1.6" strokeDasharray="4 3" />
        )}

        {/* raw dots (behind lines) */}
        {data.filter((d) => visible[d.id]).flatMap((d) => d.raw.filter((p) => p.t >= xMin && p.t <= todayT).map((p, i) => (
          <circle key={d.id + 'r' + i} cx={x(p.t)} cy={y(p.v)} r="2.3" fill={d.color} opacity="0.3" />
        )))}

        {/* projection fan (focused, honest) */}
        {!away && enoughData && lastTrend && (
          <>
            <path d={`M ${x(todayT)} ${y(lastTrend.v)} L ${x(xMax)} ${y(projUp(1))} L ${x(xMax)} ${y(projDn(1))} Z`} fill={focusColor} opacity="0.14" />
            <path d={`M ${x(todayT)} ${y(lastTrend.v)} L ${x(xMax)} ${y(projEnd)}`} stroke={focusColor} strokeWidth="1.4" strokeDasharray="2 4" opacity="0.5" />
          </>
        )}
        {/* trend lines */}
        {data.filter((d) => visible[d.id]).map((d) => (
          <path key={d.id} d={line(d.trend.filter((p) => p.t >= xMin - DAY && p.t <= todayT))} stroke={d.color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {/* "you are here" anchor */}
        {data.filter((d) => visible[d.id]).map((d) => { const lp = d.trend[d.trend.length - 1]; return <circle key={d.id + 'a'} cx={x(lp.t)} cy={y(lp.v)} r="4" fill={d.color} stroke="#fff" strokeWidth="2" />; })}

        {/* today divider */}
        <line x1={x(todayT)} x2={x(todayT)} y1={P.t} y2={P.t + PLOTH} stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="3 3" />
        <text x={x(todayT)} y={P.t - 4} fontSize="9.5" fill="var(--muted)" textAnchor="middle">Today</text>

        {/* goal-window bracket on axis (honest range, focused) */}
        {!away && enoughData && goal && slope < -0.001 && (() => {
          const cross = todayT + ((goal.target - lastTrend.v) / slope) * DAY;
          if (cross < todayT || cross > xMax) return null;
          return (
            <g>
              <rect x={x(cross - 9 * DAY)} y={P.t + PLOTH - 3} width={x(cross + 9 * DAY) - x(cross - 9 * DAY)} height="3" fill={focusColor} opacity="0.5" rx="1.5" />
              <text x={x(cross)} y={P.t + PLOTH + 13} fontSize="9.5" fill="var(--text-2)" textAnchor="middle">goal ~{fmtDate(cross)}</text>
            </g>
          );
        })()}

        {/* x date ticks */}
        {xTicks.map((t, i) => <text key={i} x={x(t)} y={H - 8} fontSize="10" fill="var(--muted)" textAnchor="middle">{fmtDate(t)}</text>)}

        {/* away badge */}
        {away && (
          <g>
            <rect x={x(todayT) - 4} y={P.t + 6} width="150" height="22" rx="11" fill="var(--amber-tint)" />
            <text x={x(todayT) + 8} y={P.t + 21} fontSize="11" fill="#b9742a">No estimate — keep logging</text>
          </g>
        )}

        {/* crosshair + tooltip */}
        {hoverT != null && hoverRows.length > 0 && (
          <g>
            <line x1={x(hoverT)} x2={x(hoverT)} y1={P.t} y2={P.t + PLOTH} stroke="var(--text-2)" strokeWidth="1" opacity="0.4" />
            {hoverRows.map((r) => <circle key={r.id} cx={x(hoverT)} cy={r.ty} r="3.5" fill={r.color} stroke="#fff" strokeWidth="1.5" />)}
            {(() => {
              const tw = 150, th = 16 + hoverRows.length * 16; const flip = x(hoverT) > W - tw - 20;
              const tx = flip ? x(hoverT) - tw - 10 : x(hoverT) + 10;
              return (
                <g>
                  <rect x={tx} y={P.t + 6} width={tw} height={th} rx="8" fill="#fff" stroke="var(--border)" />
                  <text x={tx + 10} y={P.t + 21} fontSize="10.5" fontWeight="600" fill="var(--text)">{new Date(hoverT).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</text>
                  {hoverRows.map((r, i) => (
                    <g key={r.id} transform={`translate(${tx + 10}, ${P.t + 36 + i * 16})`}>
                      <circle cx="3" cy="-3" r="3" fill={r.color} />
                      <text x="12" y="0" fontSize="10.5" fill="var(--text-2)">{r.name}</text>
                      <text x={tw - 20} y="0" fontSize="10.5" fontWeight="600" fill="var(--text)" textAnchor="end">{r.trend.toFixed(1)}</text>
                      <text x={tw - 20} y="0" fontSize="8" fill="var(--muted)" textAnchor="start" dx="2">{r.raw == null ? '· no weigh-in' : ''}</text>
                    </g>
                  ))}
                </g>
              );
            })()}
          </g>
        )}
      </svg>

      {/* scrubber strip */}
      <svg ref={scrubRef} viewBox={`0 0 ${W} ${SCRUB_H}`} width="100%" height={SCRUB_H} style={{ display: 'block', marginTop: 6 }}>
        <rect x={P.l} y="2" width={PLOTW} height={SCRUB_H - 4} fill="var(--surface-2)" rx="6" />
        <path d={scrubLine} stroke="var(--muted)" strokeWidth="1.3" fill="none" opacity="0.6" />
        <rect x={sX(start)} y="2" width={sX(todayT) - sX(start)} height={SCRUB_H - 4} fill={focusColor} opacity="0.14" rx="4"
          style={{ cursor: 'grab' }} onPointerDown={startScrubDrag('pan')} />
        <rect x={sX(start) - 3} y="2" width="7" height={SCRUB_H - 4} fill={focusColor} opacity="0.5" rx="2" style={{ cursor: 'ew-resize' }} onPointerDown={startScrubDrag('resize')} />
        <rect x={sX(todayT) - 4} y="2" width="7" height={SCRUB_H - 4} fill={focusColor} opacity="0.5" rx="2" />
      </svg>

      {/* controls: presets + smoothing */}
      <div className="row between wrap" style={{ marginTop: 12, rowGap: 10 }}>
        <div className="range-tabs">
          {Object.keys(PRESETS).map((k) => (
            <button key={k} className={rangeKey === k ? 'on' : ''} onClick={() => setRangeKey(k)}>{k}</button>
          ))}
          {rangeKey === 'Custom' && <button className="on" onClick={() => setRangeKey('3M')}>Reset</button>}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="muted small">Smoothing</span>
          <div className="seg">
            {Object.keys(SMOOTHING).map((k) => <button key={k} className={smooth === k ? 'on' : ''} onClick={() => setSmooth(k)}>{k}</button>)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sparkline({ data, color = 'var(--accent)', w = 320, h = 46 }) {
  const min = Math.min(...data), max = Math.max(...data);
  const xx = (i) => (i / (data.length - 1)) * w;
  const yy = (v) => 4 + (h - 8) - ((v - min) / (max - min || 1)) * (h - 8);
  const d = data.map((v, i) => `${i ? 'L' : 'M'} ${xx(i).toFixed(1)} ${yy(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ display: 'block' }} preserveAspectRatio="none">
      <path d={d} stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
