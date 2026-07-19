#!/usr/bin/env node
/**
 * run-timing.mjs — start/end timestamps and a duration estimate for a review.
 *
 * The estimate comes from this project's own prior runs, recorded in the
 * `## Run history` section of .claude/review/PROJECT-REVIEW.md. There is no
 * generic model of how long a review "should" take: a docs repo and a Next.js
 * app with a Playwright suite are hours apart, and the only honest predictor is
 * what this repo actually did last time.
 *
 *   node scripts/run-timing.mjs start --memory <PROJECT-REVIEW.md> [--deep] [--slices 8]
 *   node scripts/run-timing.mjs end   --started <ISO8601>
 *   node scripts/run-timing.mjs entry --started <ISO8601> --sha <sha> [--deep] [--slices 8]
 *
 * `start` prints the start timestamp and a predicted finish.
 * `end`   prints the end timestamp and the actual elapsed time.
 * `entry` prints the line to append to the Run history section.
 */

import { readFileSync, existsSync } from 'node:fs';

// ---------------------------------------------------------------------------
// formatting
// ---------------------------------------------------------------------------

/** Local wall-clock with UTC offset — the reader is a human in a timezone. */
export function formatStamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const off = -date.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const oh = p(Math.floor(Math.abs(off) / 60));
  const om = p(Math.abs(off) % 60);
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} `
    + `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())} ${sign}${oh}:${om}`;
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h${String(m).padStart(2, '0')}m`;
  if (m) return `${m}m${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export function parseDuration(text) {
  const t = String(text ?? '').trim().toLowerCase();
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}

// ---------------------------------------------------------------------------
// run history
// ---------------------------------------------------------------------------

/**
 * Parse `## Run history`. Entry shape:
 *   - 2026-07-18 · c690f94 · 11m42s · 8 slices · standard
 */
export function parseRunHistory(md) {
  const runs = [];
  const malformed = [];
  if (!md) return { runs, malformed };

  let inSection = false;
  for (const raw of String(md).split(/\r?\n/)) {
    const line = raw.trim();
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) { inSection = h[1].toLowerCase() === 'run history'; continue; }
    if (!inSection || !line.startsWith('- ')) continue;

    const parts = line.slice(2).split('·').map((s) => s.trim());
    if (parts.length < 5) { malformed.push({ entry: line, reason: 'expected 5 fields' }); continue; }
    const [date, sha, dur, slices, mode] = parts;
    const seconds = parseDuration(dur);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { malformed.push({ entry: line, reason: `bad date "${date}"` }); continue; }
    if (seconds === null) { malformed.push({ entry: line, reason: `bad duration "${dur}"` }); continue; }
    if (mode !== 'standard' && mode !== 'deep') { malformed.push({ entry: line, reason: `bad mode "${mode}"` }); continue; }
    runs.push({
      date, sha, seconds, mode,
      slices: Number((slices.match(/\d+/) || [])[0]) || null,
    });
  }
  return { runs, malformed };
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/**
 * Estimate this run's duration from prior runs of the same mode.
 *
 * Median of the last three rather than the mean, so one pathological run — a
 * flaky suite, a machine under load — does not drag every future prediction.
 * Returns null when there is nothing comparable; saying "unknown" is correct and
 * a fabricated number would be worse than no number.
 */
export function estimateDuration(runs, { deep = false, now = new Date() } = {}) {
  const mode = deep ? 'deep' : 'standard';
  const sameMode = runs.filter((r) => r.mode === mode);
  const pool = sameMode.length ? sameMode : runs;
  if (!pool.length) return null;

  const recent = pool.slice(-3);
  const seconds = median(recent.map((r) => r.seconds));
  const last = pool[pool.length - 1];

  const notes = [];
  if (!sameMode.length) {
    notes.push(`no prior ${mode} run; basing this on ${last.mode} runs, which are not directly comparable`);
  }
  const ageDays = Math.floor((now - new Date(`${last.date}T00:00:00`)) / 86400000);
  if (ageDays > 90) notes.push(`most recent run was ${ageDays} days ago; the project may have changed size since`);

  return { seconds, basis: recent.length, lastSeconds: last.seconds, lastDate: last.date, notes };
}

/** The human-facing start banner. */
export function renderStart({ memoryMd = '', deep = false, slices = null, now = new Date() } = {}) {
  const { runs, malformed } = parseRunHistory(memoryMd);
  const est = estimateDuration(runs, { deep, now });
  const lines = [`Review started: ${formatStamp(now)}`];

  if (!est) {
    lines.push('Estimated finish: unknown — no prior run recorded for this project.');
    lines.push('This run will be timed, so the next one can be predicted.');
  } else {
    const end = new Date(now.getTime() + est.seconds * 1000);
    lines.push(`Estimated finish: ${formatStamp(end)}  (~${formatDuration(est.seconds)})`);
    lines.push(
      `Basis: median of the last ${est.basis} ${deep ? 'deep' : 'standard'} run${est.basis === 1 ? '' : 's'}`
      + ` for this project; most recent was ${formatDuration(est.lastSeconds)} on ${est.lastDate}.`
    );
    for (const n of est.notes) lines.push(`Caveat: ${n}.`);
  }
  if (slices) lines.push(`Reviewers this run: ${slices}.`);
  if (malformed.length) lines.push(`(${malformed.length} unreadable run-history entr${malformed.length === 1 ? 'y' : 'ies'} ignored.)`);
  lines.push('An estimate, not a promise — test-suite time dominates and varies.');
  return lines.join('\n');
}

/** The human-facing end banner. */
export function renderEnd({ startedAt, now = new Date(), memoryMd = '', deep = false } = {}) {
  const started = new Date(startedAt);
  const seconds = (now - started) / 1000;
  const lines = [
    `Review finished: ${formatStamp(now)}`,
    `Elapsed: ${formatDuration(seconds)}.`,
  ];
  const est = estimateDuration(parseRunHistory(memoryMd).runs, { deep, now });
  if (est) {
    const delta = seconds - est.seconds;
    const pct = Math.abs(Math.round((delta / est.seconds) * 100));
    if (pct >= 25) {
      lines.push(`That is ${pct}% ${delta > 0 ? 'longer' : 'shorter'} than the ${formatDuration(est.seconds)} estimate.`);
    }
  }
  return lines.join('\n');
}

export function renderHistoryEntry({ startedAt, now = new Date(), sha, deep = false, slices }) {
  const seconds = (now - new Date(startedAt)) / 1000;
  const d = now;
  const p = (n) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return `- ${date} · ${sha} · ${formatDuration(seconds)} · ${slices} slices · ${deep ? 'deep' : 'standard'}`;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--deep') { out.deep = true; continue; }
    if (argv[i].startsWith('--')) { out[argv[i].slice(2)] = argv[++i]; continue; }
    out._.push(argv[i]);
  }
  return out;
}

function main() {
  const a = args(process.argv.slice(2));
  const cmd = a._[0];
  const memoryMd = a.memory && existsSync(a.memory) ? readFileSync(a.memory, 'utf8') : '';

  if (cmd === 'start') {
    console.log(renderStart({ memoryMd, deep: !!a.deep, slices: a.slices ? Number(a.slices) : null }));
  } else if (cmd === 'end') {
    if (!a.started) { console.error('run-timing end: --started <ISO8601> is required'); process.exit(2); }
    console.log(renderEnd({ startedAt: a.started, memoryMd, deep: !!a.deep }));
  } else if (cmd === 'entry') {
    if (!a.started || !a.sha) { console.error('run-timing entry: --started and --sha are required'); process.exit(2); }
    console.log(renderHistoryEntry({ startedAt: a.started, sha: a.sha, deep: !!a.deep, slices: a.slices || 6 }));
  } else {
    console.error('usage: run-timing.mjs <start|end|entry> [--memory <path>] [--started <iso>] [--sha <sha>] [--slices <n>] [--deep]');
    process.exit(2);
  }
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('run-timing.mjs');
if (invokedDirectly) main();
