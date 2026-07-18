#!/usr/bin/env node
/**
 * assert-fixture.mjs — assert a fresh merge reproduces the committed fixture.
 *
 *   node scripts/assert-fixture.mjs <actual.json> <expected.json>
 *
 * This is the regression test that a unit test cannot be: it runs the whole
 * merge over real reviewer output and checks the result byte-for-byte, so a
 * change to ranking, clustering, or the accept gate that nobody intended shows
 * up as a diff rather than as silently different reports.
 *
 * The rank tiebreak on path exists for exactly this — the merge must be a total
 * order, or this check would flake across platforms.
 */

import { readFileSync } from 'node:fs';

const [, , actualPath, expectedPath] = process.argv;
if (!actualPath || !expectedPath) {
  console.error('usage: assert-fixture.mjs <actual.json> <expected.json>');
  process.exit(2);
}

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const actual = read(actualPath);
const expected = read(expectedPath);

const problems = [];

const aKeys = Object.keys(actual);
const eKeys = Object.keys(expected);
if (aKeys.join(',') !== eKeys.join(',')) {
  problems.push(`key set or order changed:\n  expected ${eKeys.join(',')}\n  actual   ${aKeys.join(',')}`);
}

// Compare the parts that must be stable. Deliberately excludes nothing — if a
// field is genuinely allowed to vary, it does not belong in the fixture.
const a = JSON.stringify(actual, null, 2);
const e = JSON.stringify(expected, null, 2);

if (a !== e) {
  const aLines = a.split('\n');
  const eLines = e.split('\n');
  const max = Math.max(aLines.length, eLines.length);
  let shown = 0;
  for (let i = 0; i < max && shown < 12; i++) {
    if (aLines[i] !== eLines[i]) {
      problems.push(`line ${i + 1}:\n  expected: ${eLines[i] ?? '<missing>'}\n  actual:   ${aLines[i] ?? '<missing>'}`);
      shown++;
    }
  }
  if (shown === 0) problems.push('content differs but no line diff found (line-ending or encoding drift?)');
}

if (problems.length) {
  console.error('assert-fixture: FAILED — the merge no longer reproduces examples/expected-review.json\n');
  for (const p of problems) console.error(p + '\n');
  console.error('If this change was intended, re-run the merge and commit the new fixture,');
  console.error('and say in the commit message what changed about the output and why.');
  process.exit(1);
}

console.log(`assert-fixture: OK — ${actual.issues.length} issues, output identical to the committed fixture`);
