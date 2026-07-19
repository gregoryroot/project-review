/**
 * Tests for run timing and duration estimation.
 *
 * The property that matters most: with no comparable prior run, the estimate is
 * null and the banner says "unknown". A fabricated duration is worse than an
 * absent one, because the user plans their afternoon around it.
 *
 * node --test scripts/run-timing.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert';

import {
  formatDuration, parseDuration, parseRunHistory,
  estimateDuration, renderStart, renderEnd, renderHistoryEntry, formatStamp,
} from './run-timing.mjs';

const MEMORY = `# Project review memory

## Stack
- test: \`npm test\`

## Run history
- 2026-07-10 · aaa1111 · 9m30s · 6 slices · standard
- 2026-07-12 · bbb2222 · 12m00s · 8 slices · standard
- 2026-07-14 · ccc3333 · 11m00s · 8 slices · standard
- 2026-07-15 · ddd4444 · 41m20s · 8 slices · deep
- 2026-07-16 · eee5555 · not-a-duration · 8 slices · standard

## Verdicts
- 2026-07-18 · a1b2c3d · src/x.js · security · fine
`;

// --- duration formatting ----------------------------------------------------

test('formatDuration is readable at every scale', () => {
  assert.equal(formatDuration(45), '45s');
  assert.equal(formatDuration(702), '11m42s');
  assert.equal(formatDuration(3780), '1h03m');
  assert.equal(formatDuration(0), '0s');
});

test('parseDuration round-trips what formatDuration writes', () => {
  for (const s of [45, 702, 3780, 60]) {
    assert.equal(parseDuration(formatDuration(s)), s, `${s}s should round-trip`);
  }
});

test('parseDuration rejects junk rather than guessing', () => {
  for (const bad of ['soon', '', 'about 10 minutes', null, '12']) {
    assert.equal(parseDuration(bad), null, `${JSON.stringify(bad)} should not parse`);
  }
});

test('formatStamp includes a UTC offset', () => {
  assert.match(formatStamp(new Date()), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{2}:\d{2}$/);
});

// --- parsing ----------------------------------------------------------------

test('parseRunHistory reads only its own section', () => {
  const { runs, malformed } = parseRunHistory(MEMORY);
  assert.equal(runs.length, 4, 'the verdict line must not be read as a run');
  assert.equal(malformed.length, 1);
  assert.match(malformed[0].reason, /bad duration/);
  assert.equal(runs[0].slices, 6);
  assert.equal(runs[3].mode, 'deep');
});

test('an absent section yields no runs rather than throwing', () => {
  assert.deepEqual(parseRunHistory('# nothing here').runs, []);
  assert.deepEqual(parseRunHistory('').runs, []);
});

// --- estimation -------------------------------------------------------------

test('estimate is the median of the last three same-mode runs', () => {
  const { runs } = parseRunHistory(MEMORY);
  const est = estimateDuration(runs, { deep: false, now: new Date('2026-07-17') });
  // standard runs: 9m30s(570), 12m(720), 11m(660) -> median 660
  assert.equal(est.seconds, 660);
  assert.equal(est.basis, 3);
});

test('median resists a single pathological run', () => {
  const runs = [
    { date: '2026-07-01', seconds: 600, mode: 'standard' },
    { date: '2026-07-02', seconds: 9999, mode: 'standard' },
    { date: '2026-07-03', seconds: 620, mode: 'standard' },
  ];
  const est = estimateDuration(runs, { now: new Date('2026-07-04') });
  assert.equal(est.seconds, 620, 'a mean would have been dragged to ~3700s');
});

test('deep and standard runs are never averaged together', () => {
  const { runs } = parseRunHistory(MEMORY);
  const deep = estimateDuration(runs, { deep: true, now: new Date('2026-07-17') });
  assert.equal(deep.seconds, 2480, 'the single deep run, not a blend');
  assert.equal(deep.notes.length, 0);
});

test('falling back across modes says so', () => {
  const runs = [{ date: '2026-07-01', seconds: 2400, mode: 'deep' }];
  const est = estimateDuration(runs, { deep: false, now: new Date('2026-07-02') });
  assert.equal(est.seconds, 2400);
  assert.match(est.notes.join(' '), /not directly comparable/);
});

test('a long-stale history is flagged', () => {
  const runs = [{ date: '2025-01-01', seconds: 600, mode: 'standard' }];
  const est = estimateDuration(runs, { now: new Date('2026-07-18') });
  assert.match(est.notes.join(' '), /days ago/);
});

test('no history means no estimate — never a fabricated one', () => {
  assert.equal(estimateDuration([], {}), null);
});

// --- rendering --------------------------------------------------------------

test('the first run on a project reports unknown, honestly', () => {
  const out = renderStart({ memoryMd: '', now: new Date('2026-07-18T12:00:00') });
  assert.match(out, /Review started:/);
  assert.match(out, /Estimated finish: unknown/);
  assert.match(out, /no prior run recorded/);
  assert.doesNotMatch(out, /~\d+m/, 'must not print a duration it does not have');
});

test('a start banner with history predicts a finish time', () => {
  const out = renderStart({ memoryMd: MEMORY, slices: 8, now: new Date('2026-07-18T12:00:00') });
  assert.match(out, /Review started: 2026-07-18 12:00:00/);
  assert.match(out, /Estimated finish: 2026-07-18 12:11:00/);
  assert.match(out, /~11m00s/);
  assert.match(out, /median of the last 3 standard runs/);
  assert.match(out, /Reviewers this run: 8/);
  assert.match(out, /estimate, not a promise/);
});

test('the start banner reports unreadable entries rather than hiding them', () => {
  const out = renderStart({ memoryMd: MEMORY, now: new Date('2026-07-18T12:00:00') });
  assert.match(out, /1 unreadable run-history entry ignored/);
});

test('the end banner reports elapsed time', () => {
  const out = renderEnd({
    startedAt: '2026-07-18T12:00:00',
    now: new Date('2026-07-18T12:11:42'),
  });
  assert.match(out, /Review finished: 2026-07-18 12:11:42/);
  assert.match(out, /Elapsed: 11m42s/);
});

test('a big divergence from the estimate is called out', () => {
  const out = renderEnd({
    startedAt: '2026-07-18T12:00:00',
    now: new Date('2026-07-18T12:30:00'),
    memoryMd: MEMORY,
  });
  assert.match(out, /longer than the 11m00s estimate/);
});

test('a run close to its estimate is not editorialized', () => {
  const out = renderEnd({
    startedAt: '2026-07-18T12:00:00',
    now: new Date('2026-07-18T12:11:30'),
    memoryMd: MEMORY,
  });
  assert.doesNotMatch(out, /longer|shorter/);
});

test('the history entry it writes is one it can read back', () => {
  const line = renderHistoryEntry({
    startedAt: '2026-07-18T12:00:00',
    now: new Date('2026-07-18T12:11:42'),
    sha: 'abc1234',
    slices: 8,
  });
  assert.equal(line, '- 2026-07-18 · abc1234 · 11m42s · 8 slices · standard');
  const { runs, malformed } = parseRunHistory(`## Run history\n${line}\n`);
  assert.equal(malformed.length, 0, 'what it writes must parse');
  assert.equal(runs[0].seconds, 702);
  assert.equal(runs[0].slices, 8);
});

test('a deep run is recorded as deep', () => {
  const line = renderHistoryEntry({
    startedAt: '2026-07-18T12:00:00',
    now: new Date('2026-07-18T12:40:00'),
    sha: 'abc1234', slices: 8, deep: true,
  });
  assert.match(line, /· deep$/);
  assert.equal(parseRunHistory(`## Run history\n${line}\n`).runs[0].mode, 'deep');
});
