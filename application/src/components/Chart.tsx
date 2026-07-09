import React, { useMemo, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, LineElement, PointElement, LinearScale, TimeScale, Tooltip, Filler,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import annotationPlugin from 'chartjs-plugin-annotation';
import zoomPlugin from 'chartjs-plugin-zoom';
import { trendSeries, SMOOTHING, projection, currentWeight } from '../lib/stats.js';
import { isoToMs, todayISO, DAY_MS } from '../lib/date.js';

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Tooltip, Filler, annotationPlugin, zoomPlugin);

const PRESETS = { '4W': 28, '3M': 90, '6M': 180, All: 9999 };

function cssVar(name, fallback) {
  if (typeof getComputedStyle === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
const FALLBACK = { '--p1': '#2aa897', '--p2': '#6c7be0', '--p3': '#e69a3b', '--p4': '#e5786f', '--p5': '#7a8aa0', '--muted': '#9aa0a6', '--border': '#e8eced', '--border-strong': '#dfe4e6', '--text-2': '#6b7380' };
function resolve(c) {
  if (!c) return FALLBACK['--p1'];
  const m = String(c).match(/var\((--[\w-]+)\)/);
  return m ? cssVar(m[1], FALLBACK[m[1]] || '#2aa897') : c;
}
const withAlpha = (hex, a) => {
  const h = resolve(hex);
  const aa = Math.round(a * 255).toString(16).padStart(2, '0');
  return /^#([0-9a-f]{6})$/i.test(h) ? h + aa : h;
};
const toPts = (arr) => arr.map((p) => ({ x: isoToMs(p.date), y: p.kg }));

export default function WeightChart({ people = [], series = {}, focusId, goal, status = 'On track', away = false, enoughData = true, settings = {} }) {
  const [visible, setVisible] = useState(() => Object.fromEntries(people.map((p) => [p.uid, settings.shown?.[p.uid] ?? true])));
  const [smooth, setSmooth] = useState('Default');
  const [rangeKey, setRangeKey] = useState('3M');
  const chartRef = useRef(null);
  const layers = { raw: true, projection: true, ideal: true, goal: true, ...settings.layers };

  const focus = people.find((p) => p.uid === focusId) || people[0];
  const focusColor = resolve(focus?.color);
  const alpha = SMOOTHING[smooth];

  const built = useMemo(() => {
    const datasets = [];
    const allMs = [];
    people.forEach((p) => { (series[p.uid] || []).forEach((e) => allMs.push(isoToMs(e.date))); });
    const todayMs = allMs.length ? Math.max(...allMs) : isoToMs(todayISO());
    const minMs = allMs.length ? Math.min(...allMs) : todayMs - 90 * DAY_MS;

    const focusEntries = series[focusId] || [];
    const focusTrend = trendSeries(focusEntries, alpha);
    const lastTrend = focusTrend.length ? focusTrend[focusTrend.length - 1].kg : null;
    const proj = projection(focusEntries, goal, { alpha });
    const projDays = away || !enoughData ? 8 : 34;
    const showBand = layers.projection && enoughData && !away && proj.status === 'ok' && lastTrend != null;
    const endMs = todayMs + projDays * DAY_MS;

    // projection fan (focused) — drawn first so it sits behind the lines
    if (showBand) {
      const slopePerDay = (proj.slopePerWeek || 0) / 7;
      const projEnd = lastTrend + slopePerDay * projDays;
      const pad = 0.4 + (projDays / 7) * 0.28;
      datasets.push({ label: '_bandTop', data: [{ x: todayMs, y: lastTrend }, { x: endMs, y: projEnd + pad }], borderWidth: 0, pointRadius: 0, fill: false });
      datasets.push({ label: '_bandBot', data: [{ x: todayMs, y: lastTrend }, { x: endMs, y: projEnd - pad }], borderWidth: 0, pointRadius: 0, fill: '-1', backgroundColor: withAlpha(focusColor, 0.13) });
      datasets.push({ label: '_proj', data: [{ x: todayMs, y: lastTrend }, { x: endMs, y: projEnd }], borderColor: withAlpha(focusColor, 0.6), borderWidth: 1.4, borderDash: [2, 4], pointRadius: 0, fill: false });
    }

    // ideal line (focused) — today → target by target date
    if (layers.ideal && goal?.targetKg != null && goal?.targetISO) {
      datasets.push({ label: '_ideal', data: [{ x: todayMs, y: currentWeight(focusEntries) ?? lastTrend }, { x: isoToMs(goal.targetISO), y: goal.targetKg }], borderColor: resolve('var(--muted)'), borderWidth: 1.6, borderDash: [5, 4], pointRadius: 0, fill: false });
    }

    // raw daily dots (faint) + trend line, per visible person
    people.forEach((p) => {
      if (!visible[p.uid]) return;
      const col = resolve(p.color);
      const entries = series[p.uid] || [];
      if (layers.raw) {
        datasets.push({ label: `_raw_${p.uid}`, data: toPts(entries), showLine: false, pointRadius: 2.1, pointBackgroundColor: withAlpha(col, 0.32), pointBorderWidth: 0 });
      }
      datasets.push({ label: p.name, data: toPts(trendSeries(entries, alpha)), borderColor: col, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 4, tension: 0.32, fill: false });
    });

    // window
    const days = PRESETS[rangeKey];
    const xMin = rangeKey === 'All' ? minMs : Math.max(minMs, todayMs - days * DAY_MS);
    const xMax = endMs;

    const annotations = {
      today: { type: 'line', xMin: todayMs, xMax: todayMs, borderColor: resolve('var(--border-strong)'), borderWidth: 1, borderDash: [3, 3], label: { display: true, content: 'Today', position: 'start', font: { size: 10 }, color: resolve('var(--muted)'), backgroundColor: 'transparent', yAdjust: -6 } },
    };
    if (layers.goal && goal?.targetKg != null) {
      annotations.goalBand = { type: 'box', yMin: goal.targetKg - 0.6, yMax: goal.targetKg + 0.6, borderWidth: 0, backgroundColor: withAlpha(focusColor, 0.1) };
      annotations.goalLine = { type: 'line', yMin: goal.targetKg, yMax: goal.targetKg, borderColor: withAlpha(focusColor, 0.7), borderWidth: 1.3, borderDash: [2, 4], label: { display: true, content: `Goal ${goal.targetKg} kg`, position: 'end', font: { size: 9.5 }, color: resolve('var(--muted)'), backgroundColor: 'transparent', yAdjust: -8 } };
    }
    const showIdeal = layers.ideal && goal?.targetKg != null && goal?.targetISO;
    return { datasets, xMin, xMax, annotations, showBand, showIdeal };
  }, [people, series, focusId, visible, smooth, rangeKey, goal, away, enoughData, alpha, focusColor, layers.raw, layers.ideal, layers.goal, layers.projection]);

  const data = { datasets: built.datasets };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { type: 'time', min: built.xMin, max: built.xMax, time: { tooltipFormat: 'MMM d, yyyy', displayFormats: { day: 'MMM d', week: 'MMM d', month: 'MMM yyyy' } }, grid: { display: false }, ticks: { color: resolve('var(--muted)'), maxRotation: 0, font: { size: 10 } }, border: { display: false } },
      y: { ticks: { color: resolve('var(--muted)'), font: { size: 10 }, callback: (v) => `${v} kg` }, grid: { color: resolve('var(--border)') }, border: { display: false } },
    },
    plugins: {
      legend: { display: false },
      tooltip: { filter: (i) => !String(i.dataset.label).startsWith('_'), callbacks: { label: (i) => `${i.dataset.label}: ${i.parsed.y.toFixed(1)} kg` } },
      annotation: { annotations: built.annotations || {} },
      zoom: { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: false }, pinch: { enabled: true }, mode: 'x' } },
    },
  };

  const reset = () => { chartRef.current?.resetZoom?.(); };

  return (
    <div className="chart-wrap">
      <div className="row between" style={{ marginBottom: 6 }}>
        <span className="card-title">Weight trend</span>
        <span className={away ? 'pill amber' : 'pill'}>{away ? 'No estimate — keep logging' : status}</span>
      </div>

      <div className="row between wrap" style={{ marginBottom: 8, rowGap: 8 }}>
        <div className="legend">
          {people.map((p) => (
            <button key={p.uid} className={'legend-toggle' + (visible[p.uid] ? '' : ' off')} aria-pressed={!!visible[p.uid]}
              aria-label={`${visible[p.uid] ? 'Hide' : 'Show'} ${p.name} on the chart`} onClick={() => setVisible((s) => ({ ...s, [p.uid]: !s[p.uid] }))}>
              <span className="swatch" style={{ background: p.color }} />{p.name}
            </button>
          ))}
        </div>
        <div className="line-key">
          {people.some((p) => visible[p.uid]) && <span><svg width="22" height="8"><line x1="1" y1="4" x2="21" y2="4" stroke={focusColor} strokeWidth="2.4" /></svg>Trend</span>}
          {layers.raw && people.some((p) => visible[p.uid]) && <span><svg width="22" height="8"><circle cx="11" cy="4" r="2.4" fill={focusColor} opacity="0.35" /></svg>Daily</span>}
          {built.showIdeal && <span><svg width="22" height="8"><line x1="1" y1="4" x2="21" y2="4" stroke="var(--muted)" strokeWidth="1.6" strokeDasharray="4 3" /></svg>Ideal</span>}
          {built.showBand && <span><svg width="22" height="8"><rect x="1" y="1" width="20" height="6" fill={focusColor} opacity="0.16" /></svg>Projected</span>}
        </div>
      </div>

      <div style={{ height: 300, position: 'relative' }} role="img" aria-label={`Weight trend chart for ${focus?.name || 'you'}, status: ${away ? 'no estimate, keep logging' : status}`}>
        <Line ref={chartRef} data={data} options={options} aria-hidden="true" />
        <span className="sr-only">
          {focus?.name || 'You'}’s current trend {currentWeight(series[focusId] || []) != null ? `is ${currentWeight(series[focusId] || [])} kg` : 'has no data yet'}.
          {built.showIdeal ? ' An ideal line toward the goal is shown.' : ''}
          {built.showBand ? ' A projected range fan is shown.' : ''}
        </span>
      </div>

      <div className="row between wrap" style={{ marginTop: 12, rowGap: 10 }}>
        <div className="range-tabs">
          {Object.keys(PRESETS).map((k) => (
            <button key={k} className={rangeKey === k ? 'on' : ''} onClick={() => { setRangeKey(k); reset(); }}>{k}</button>
          ))}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="muted small">Smoothing</span>
          <div className="seg">
            {Object.keys(SMOOTHING).map((k) => <button key={k} className={smooth === k ? 'on' : ''} onClick={() => setSmooth(k)}>{k}</button>)}
          </div>
        </div>
      </div>
      <p className="muted small" style={{ margin: '8px 0 0' }}>Drag to pan · pinch to zoom on mobile. The bold line is your smoothed trend; faint dots are daily weigh-ins.</p>
    </div>
  );
}
