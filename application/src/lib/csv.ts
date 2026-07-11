// Client-side CSV import (REQUIREMENTS §4). Format-flexible: tokenize with
// papaparse, auto-detect the date & weight columns and the date format, then
// preview parsed rows and flag the unparseable ones.
import Papa from 'papaparse';
import { parseDate, detectDateFormat } from './date.js';

export interface ParsedCsv {
  header: string[];
  rows: string[][];
  hasHeader: boolean;
}

export function parseCsv(text: string): ParsedCsv {
  const res = Papa.parse<string[]>(String(text).trim(), { skipEmptyLines: true });
  const rows = res.data.filter((r) => r.some((c) => String(c).trim() !== ''));
  if (!rows.length) return { header: [], rows: [], hasHeader: false };
  // Treat the first row as a header if none of its cells look like a number.
  const first = rows[0];
  const looksNumeric = (c: string) => c !== '' && !Number.isNaN(Number(c));
  const hasHeader = !first.some(looksNumeric);
  return { header: hasHeader ? first.map((c) => String(c).trim()) : first.map((_, i) => `Column ${i + 1}`),
    rows: hasHeader ? rows.slice(1) : rows, hasHeader };
}

const looksLikeWeight = (c: string): boolean => {
  const n = parseWeightValue(c);
  return !Number.isNaN(n) && n >= 20 && n <= 400;
};
const looksLikeDate = (c: string): boolean => /\d/.test(String(c)) && (/[\/\-.]/.test(String(c)) || /[A-Za-z]/.test(String(c)));

export interface DetectedColumns {
  dateIdx: number;
  weightIdx: number;
}

// Pick date & weight columns by header keywords, falling back to content sniffing.
export function detectColumns(header: string[], rows: string[][]): DetectedColumns {
  const lower = header.map((h) => String(h).toLowerCase());
  let dateIdx = lower.findIndex((h) => /date|day|time|when/.test(h));
  let weightIdx = lower.findIndex((h) => /weight|kg|mass|wt/.test(h));

  const sample = rows.slice(0, 8);
  if (dateIdx < 0) {
    dateIdx = header.findIndex((_, i) => sample.length && sample.every((r) => looksLikeDate(r[i])));
  }
  if (weightIdx < 0) {
    weightIdx = header.findIndex((_, i) => i !== dateIdx && sample.length && sample.every((r) => looksLikeWeight(r[i])));
  }
  if (dateIdx < 0) dateIdx = 0;
  if (weightIdx < 0) weightIdx = header.length > 1 ? (dateIdx === 1 ? 0 : 1) : 0;
  // Never default both columns to the same index — caller can still override.
  if (weightIdx === dateIdx) weightIdx = header.length > 1 ? (dateIdx + 1) % header.length : dateIdx;
  return { dateIdx, weightIdx };
}

export function suggestDateFormat(rows: string[][], dateIdx: number): string {
  return detectDateFormat(rows.map((r) => r[dateIdx]));
}

// Parse a weight cell that may use either decimal convention (82.5 or 82,5)
// and may have thousands separators (1,020.5 or 1.020,5). When both `.` and
// `,` appear, whichever comes LAST in the string is the decimal separator.
// Genuinely ambiguous input (more than one of each) is rejected as NaN rather
// than guessed.
export function parseWeightValue(raw: string | number): number {
  let s = String(raw).trim().replace(/[^0-9.,\-]/g, '');
  if (!/\d/.test(s)) return NaN;
  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;
  if (dots > 1 && commas > 1) return NaN;
  if (dots >= 1 && commas >= 1) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (commas === 1) {
    s = s.replace(',', '.');
  } else if (commas > 1) {
    s = s.replace(/,/g, '');
  } else if (dots > 1) {
    s = s.replace(/\./g, '');
  }
  return Number(s);
}

export interface ImportEntry {
  date: string;
  kg: number;
  note: string;
}
export interface ImportBadRow {
  index: number;
  raw: string;
  kg: string;
  reason: string;
}
export interface ImportResult {
  entries: ImportEntry[];
  bad: ImportBadRow[];
  duplicates: number;
  total: number;
  ready: number;
}

// Build the import preview: good entries + flagged bad rows. A date repeated
// within the file is a correction, not an error — the LAST value for that
// date wins and is merged silently (surfaced via `duplicates`, not `bad`).
export function buildImport(rows: string[][], { dateIdx, weightIdx, fmt }: { dateIdx: number; weightIdx: number; fmt: string }): ImportResult {
  const bad: ImportBadRow[] = [];
  const byDate = new Map<string, ImportEntry>();
  let duplicates = 0;
  rows.forEach((r, i) => {
    const rawDate = r[dateIdx];
    const rawKg = r[weightIdx];
    const date = parseDate(rawDate, fmt);
    const kg = parseWeightValue(rawKg);
    if (!date) { bad.push({ index: i, raw: rawDate, kg: rawKg, reason: 'can’t parse date' }); return; }
    if (Number.isNaN(kg) || kg < 20 || kg > 400) { bad.push({ index: i, raw: rawDate, kg: rawKg, reason: 'invalid weight' }); return; }
    if (byDate.has(date)) duplicates += 1;
    byDate.set(date, { date, kg: +kg.toFixed(2), note: '' });
  });
  const entries = Array.from(byDate.values());
  return { entries, bad, duplicates, total: rows.length, ready: entries.length };
}

export const TEMPLATE_CSV = 'date,weight_kg\n2026-06-30,83.3\n2026-06-29,83.6\n';
