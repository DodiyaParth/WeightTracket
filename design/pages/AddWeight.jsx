import React, { useState } from 'react';
import Layout from '../components/Layout.jsx';
import Icon from '../components/Icon.jsx';
import { Confirm } from '../components/Modal.jsx';
import { useQuickLog } from '../components/QuickLog.jsx';
import { recentEntries } from '../data.js';

function Single() {
  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 4 }}>Add a weigh-in</div>
      <p className="t2 small" style={{ marginTop: 0 }}>For a single date — back-date by changing the date below.</p>
      <div className="col" style={{ gap: 16, marginTop: 8 }}>
        <div>
          <label className="field-label">Weight (kg)</label>
          <div style={{ position: 'relative' }}>
            <input className="input" defaultValue="83.2" style={{ fontSize: 28, fontWeight: 600, padding: '16px 14px' }} />
            <span className="muted" style={{ position: 'absolute', right: 16, top: 24 }}>kg</span>
          </div>
        </div>
        <div>
          <label className="field-label">Date</label>
          <button className="input date-field row between"><span>Jun 30, 2026</span><Icon name="calendar" color="var(--muted)" /></button>
        </div>
        <div>
          <label className="field-label">Note (optional)</label>
          <input className="input" placeholder="e.g. morning, after travel…" />
        </div>
        <div className="tip"><Icon name="bell" size={18} color="var(--accent-dark)" />Weigh first thing in the morning, after the toilet, same conditions — for consistent data.</div>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn primary"><Icon name="check" color="#fff" />Save entry</button>
          <button className="btn">Save &amp; add another</button>
        </div>
      </div>
    </div>
  );
}

function Bulk() {
  const rows = ['Jun 30', 'Jun 29', 'Jun 28', 'Jun 27', 'Jun 26', 'Jun 25'];
  return (
    <div className="card">
      <div className="card-title">Backfill past entries</div>
      <p className="t2 small" style={{ marginTop: 4 }}>Catch up on the last week or two of your own weigh-ins. Leave blanks for missed days — gaps are fine.</p>
      <table className="tbl" style={{ marginTop: 8 }}>
        <thead><tr><th>Date</th><th>Weight (kg)</th><th>Note</th></tr></thead>
        <tbody>
          {rows.map((d, i) => (
            <tr key={d}><td style={{ width: 110 }}>{d}</td><td style={{ width: 160 }}><input className="input" defaultValue={(83.3 + i * 0.3).toFixed(1)} /></td><td><input className="input" placeholder="—" /></td></tr>
          ))}
        </tbody>
      </table>
      <div className="row" style={{ gap: 10, marginTop: 16 }}>
        <button className="btn ghost"><Icon name="plus" color="var(--text-2)" />Add row</button>
        <div style={{ flex: 1 }} /><button className="btn primary">Save 6 entries</button>
      </div>
    </div>
  );
}

const FORMATS = [['iso', 'YYYY-MM-DD'], ['dmy', 'DD/MM/YYYY'], ['mdy', 'MM/DD/YYYY'], ['named', 'Mon DD YYYY']];
const PREVIEW = [
  { raw: '30/06/2026', date: 'Jun 30, 2026', kg: '83.3', ok: true },
  { raw: '29/06/2026', date: 'Jun 29, 2026', kg: '83.6', ok: true },
  { raw: '28/06/2026', date: 'Jun 28, 2026', kg: '83.9', ok: true },
  { raw: '27/06/2026', date: 'Jun 27, 2026', kg: '84.1', ok: true },
  { raw: '31/13/2026', date: '—', kg: '84.0', ok: false },
];

function Csv() {
  const [step, setStep] = useState('empty');
  const [fmt, setFmt] = useState('dmy');
  if (step === 'empty') {
    return (
      <div className="card">
        <div className="card-title">Import from CSV</div>
        <p className="t2 small" style={{ marginTop: 4 }}>Bring in months of history at once — your own weight only.</p>
        <div className="dropzone" style={{ marginTop: 8, cursor: 'pointer' }} onClick={() => setStep('review')}>
          <Icon name="upload" size={28} color="var(--muted)" />
          <div style={{ marginTop: 10, fontWeight: 600, color: 'var(--text)' }}>Drop your CSV here</div>
          <div className="small">or <span style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>browse files</span></div>
          <div className="small muted" style={{ marginTop: 10 }}>Needs a <b>date</b> column and a <b>weight (kg)</b> column. Any date format works — other columns are ignored.</div>
        </div>
        <div className="row between" style={{ marginTop: 16 }}><span className="field-label" style={{ margin: 0 }}>Example</span><button className="btn ghost sm"><Icon name="upload" size={16} color="var(--text-2)" />Download template</button></div>
        <div className="ex-table" style={{ marginTop: 8 }}>
          <div className="r head"><div className="c">date</div><div className="c">weight_kg</div></div>
          <div className="r"><div className="c">2026-06-30</div><div className="c">83.3</div></div>
          <div className="r"><div className="c">2026-06-29</div><div className="c">83.6</div></div>
        </div>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="section-head"><span className="card-title">Review import</span><button className="btn ghost sm" onClick={() => setStep('empty')}><Icon name="close" size={16} color="var(--text-2)" />Replace file</button></div>
      <div className="csv-file" style={{ marginTop: 12 }}><Icon name="upload" color="var(--accent-dark)" /><div className="grow"><div className="name">weight-2026.csv</div><div className="muted small">84 rows detected</div></div><span className="pill">Auto-detected</span></div>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div><label className="field-label">Date column</label><div className="link-box between"><span><b>Column A</b> · date</span><Icon name="chevron" color="var(--muted)" /></div></div>
        <div><label className="field-label">Weight column</label><div className="link-box between"><span><b>Column B</b> · weight_kg</span><Icon name="chevron" color="var(--muted)" /></div></div>
      </div>
      <label className="field-label" style={{ marginTop: 16 }}>Date format <span className="muted" style={{ fontWeight: 400 }}>· detected DD/MM/YYYY — confirm or override</span></label>
      <div className="fmt-opts">{FORMATS.map(([k, l]) => (<button key={k} className={'toggle' + (fmt === k ? ' on' : '')} onClick={() => setFmt(k)}><span style={{ width: 8, height: 8, borderRadius: 8, background: fmt === k ? 'var(--accent)' : 'var(--muted)' }} />{l}</button>))}</div>
      <label className="field-label" style={{ marginTop: 18 }}>Preview · first rows</label>
      <table className="tbl">
        <thead><tr><th>From file</th><th>Date</th><th>Weight</th><th /></tr></thead>
        <tbody>{PREVIEW.map((r, i) => (<tr key={i} className={r.ok ? '' : 'bad'}><td className="muted">{r.raw}</td><td>{r.date}</td><td>{r.ok ? `${r.kg} kg` : '—'}</td><td style={{ textAlign: 'right' }}>{r.ok ? <Icon name="check" size={16} color="var(--accent)" /> : <span className="pill amber">can’t parse date</span>}</td></tr>))}</tbody>
      </table>
      <div className="row-warn" style={{ marginTop: 12 }}><Icon name="warn" size={16} color="#b9742a" />2 rows couldn’t be parsed and won’t be imported. Fix the file or change the date format above.</div>
      <div className="row" style={{ marginTop: 16, alignItems: 'center' }}><span className="muted small">84 rows · 82 ready · 2 need attention</span><div style={{ flex: 1 }} /><button className="btn primary">Import 82 entries</button></div>
    </div>
  );
}

export default function AddWeight() {
  const [tab, setTab] = useState('single');
  const [del, setDel] = useState(null);
  const quick = useQuickLog();
  return (
    <Layout title="Log a weigh-in" sub="Your own weight · single entry, backfill, or CSV import" primary={null}>
      <div className="tabs">
        {[['single', 'Single entry'], ['bulk', 'Bulk backfill'], ['csv', 'CSV import']].map(([k, l]) => (<button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>))}
      </div>
      <div className="addweight-grid">
        <div>{tab === 'single' && <Single />}{tab === 'bulk' && <Bulk />}{tab === 'csv' && <Csv />}</div>
        <div className="card" style={{ alignSelf: 'start' }}>
          <div className="card-title" style={{ marginBottom: 8 }}>Recent entries</div>
          <div className="entry-list">
            {recentEntries.map((e) => (
              <div key={e.id} className="entry-row">
                <div className="col"><span style={{ fontWeight: 600 }}>{e.kg} kg</span><span className="muted small">{e.date}{e.note ? ` · ${e.note}` : ''}</span></div>
                <div className="row entry-actions">
                  <button className="icon-btn ghost-ib" title="Edit" onClick={() => quick.open(e)}><Icon name="edit" size={16} color="var(--muted)" /></button>
                  <button className="icon-btn ghost-ib" title="Delete" onClick={() => setDel(e)}><Icon name="trash" size={16} color="var(--muted)" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {del && <Confirm title="Delete this entry?" message={`${del.kg} kg on ${del.date} will be removed from your history. This can’t be undone.`} confirmLabel="Delete" danger onCancel={() => setDel(null)} onConfirm={() => setDel(null)} />}
    </Layout>
  );
}
