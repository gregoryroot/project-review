/**
 * Tests for the grounding gate.
 *
 * This is the one component whose silent failure is invisible in the output: if
 * it stops verifying quotes, every review still *looks* fine. That is the whole
 * reason this file exists.
 *
 * node --test scripts/
 */

import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  parseSlice, safeResolve, verifyEvidence, acceptFindings,
  parseMemory, validateMemory, suppress, clusterFindings, rankIssues, collate,
} from './merge-review.mjs';

// --- fixture repo -----------------------------------------------------------

function makeRepo() {
  const root = mkdtempSync(path.join(tmpdir(), 'pr-test-'));
  mkdirSync(path.join(root, 'src'), { recursive: true });
  writeFileSync(
    path.join(root, 'src', 'client.js'),
    [
      '// line 1',
      'const KEY = process.env.API_KEY || "sk-demo-abc";',
      'export function go(id) {',
      '  return db.get(`SELECT * FROM t WHERE id = ${id}`);',
      '}',
    ].join('\n')
  );
  return root;
}

function finding(over = {}) {
  return {
    domain: 'security',
    title: 'hardcoded fallback credential',
    severity: 'high',
    confidence: 'confirmed',
    detail: 'd',
    impact: 'i',
    evidence: [{ file: 'src/client.js', line: 2, quote: 'process.env.API_KEY || "sk-demo-abc"' }],
    ...over,
  };
}

// --- parse ------------------------------------------------------------------

test('parseSlice strips code fences', () => {
  const r = parseSlice('```json\n{"slice":"security-privacy","findings":[]}\n```');
  assert.equal(r.ok, true);
  assert.equal(r.slice, 'security-privacy');
});

test('parseSlice tolerates prose around the JSON', () => {
  const r = parseSlice('Here is my analysis:\n{"slice":"x","findings":[]}\nHope that helps.');
  assert.equal(r.ok, true);
});

test('parseSlice does not stop at a brace inside a string', () => {
  const r = parseSlice('{"slice":"x","findings":[],"note":"a } brace"}');
  assert.equal(r.ok, true);
  assert.equal(r.findings.length, 0);
});

test('parseSlice reports failure on pure prose', () => {
  const r = parseSlice('I was unable to complete the review.');
  assert.equal(r.ok, false);
  assert.match(r.reason, /no JSON/);
});

// --- path containment -------------------------------------------------------

test('safeResolve rejects traversal outside the repo root', () => {
  const root = makeRepo();
  assert.equal(safeResolve(root, '../../.ssh/id_rsa'), null);
  assert.equal(safeResolve(root, 'src/../../../etc/passwd'), null);
  assert.notEqual(safeResolve(root, 'src/client.js'), null);
  rmSync(root, { recursive: true, force: true });
});

test('safeResolve rejects absolute paths', () => {
  const root = makeRepo();
  assert.equal(safeResolve(root, '/etc/passwd'), null);
  assert.equal(safeResolve(root, 'C:\\Windows\\win.ini'), null);
  rmSync(root, { recursive: true, force: true });
});

test('a traversing evidence path is rejected, not read', () => {
  const root = makeRepo();
  const { accepted, rejected } = acceptFindings(root, 'security-privacy', [
    finding({ evidence: [{ file: '../../.ssh/id_rsa', line: 1, quote: 'PRIVATE KEY' }] }),
  ]);
  assert.equal(accepted.length, 0);
  assert.match(rejected[0].reason, /escapes repo root/);
  rmSync(root, { recursive: true, force: true });
});

// --- the gate ---------------------------------------------------------------

test('a real quote at the right line is accepted', () => {
  const root = makeRepo();
  const { accepted, rejected } = acceptFindings(root, 'security-privacy', [finding()]);
  assert.equal(accepted.length, 1, JSON.stringify(rejected));
  rmSync(root, { recursive: true, force: true });
});

test('a fabricated quote is rejected', () => {
  const root = makeRepo();
  const { accepted, rejected } = acceptFindings(root, 'security-privacy', [
    finding({ evidence: [{ file: 'src/client.js', line: 2, quote: 'const SECRET = "totally-invented"' }] }),
  ]);
  assert.equal(accepted.length, 0);
  assert.match(rejected[0].reason, /quote not found/);
  rmSync(root, { recursive: true, force: true });
});

test('a line past EOF is rejected', () => {
  const root = makeRepo();
  const { accepted, rejected } = acceptFindings(root, 'security-privacy', [
    finding({ evidence: [{ file: 'src/client.js', line: 900, quote: 'anything' }] }),
  ]);
  assert.equal(accepted.length, 0);
  assert.match(rejected[0].reason, /past EOF/);
  rmSync(root, { recursive: true, force: true });
});

test('a quote off by two lines still verifies (±3 window)', () => {
  const root = makeRepo();
  const { accepted } = acceptFindings(root, 'security-privacy', [
    finding({ evidence: [{ file: 'src/client.js', line: 4, quote: 'process.env.API_KEY' }] }),
  ]);
  assert.equal(accepted.length, 1);
  rmSync(root, { recursive: true, force: true });
});

test('whitespace differences do not break a quote match', () => {
  const root = makeRepo();
  const { accepted } = acceptFindings(root, 'security-privacy', [
    finding({ evidence: [{ file: 'src/client.js', line: 2, quote: 'process.env.API_KEY   ||   "sk-demo-abc"' }] }),
  ]);
  assert.equal(accepted.length, 1);
  rmSync(root, { recursive: true, force: true });
});

test('one bad evidence item kills the whole finding', () => {
  const root = makeRepo();
  const { accepted } = acceptFindings(root, 'security-privacy', [
    finding({
      evidence: [
        { file: 'src/client.js', line: 2, quote: 'process.env.API_KEY' },
        { file: 'src/client.js', line: 2, quote: 'this text is not in the file' },
      ],
    }),
  ]);
  assert.equal(accepted.length, 0);
  rmSync(root, { recursive: true, force: true });
});

test('a finding with no evidence is rejected', () => {
  const root = makeRepo();
  const { accepted, rejected } = acceptFindings(root, 'security-privacy', [finding({ evidence: [] })]);
  assert.equal(accepted.length, 0);
  assert.match(rejected[0].reason, /no evidence/);
  rmSync(root, { recursive: true, force: true });
});

// --- absence findings -------------------------------------------------------

test('an absence finding (line 0) is accepted when the path really is missing', () => {
  const root = makeRepo();
  const { accepted, rejected } = acceptFindings(root, 'infra-supplychain', [
    finding({
      domain: 'infra',
      severity: 'medium',
      evidence: [{ file: '.github/workflows', line: 0, quote: "ABSENT: glob '.github/workflows/*.yml' returned 0 files" }],
    }),
  ]);
  assert.equal(accepted.length, 1, JSON.stringify(rejected));
  rmSync(root, { recursive: true, force: true });
});

test('an absence finding is rejected when the path exists after all', () => {
  const root = makeRepo();
  const { accepted, rejected } = acceptFindings(root, 'infra-supplychain', [
    finding({
      domain: 'infra',
      severity: 'medium',
      evidence: [{ file: 'src/client.js', line: 0, quote: 'ABSENT: no client' }],
    }),
  ]);
  assert.equal(accepted.length, 0);
  assert.match(rejected[0].reason, /absence claimed but path exists/);
  rmSync(root, { recursive: true, force: true });
});

test('line 0 without an ABSENT: quote is rejected', () => {
  const root = makeRepo();
  const { accepted, rejected } = acceptFindings(root, 'infra-supplychain', [
    finding({ domain: 'infra', evidence: [{ file: 'nope/missing.yml', line: 0, quote: 'there is no CI' }] }),
  ]);
  assert.equal(accepted.length, 0);
  assert.match(rejected[0].reason, /ABSENT:/);
  rmSync(root, { recursive: true, force: true });
});

// --- slice boundaries and confidence ---------------------------------------

test('an off-slice domain is dropped', () => {
  const root = makeRepo();
  const { accepted, rejected } = acceptFindings(root, 'security-privacy', [finding({ domain: 'performance' })]);
  assert.equal(accepted.length, 0);
  assert.match(rejected[0].reason, /outside slice/);
  rmSync(root, { recursive: true, force: true });
});

test('inferred + high is downgraded to medium, not dropped', () => {
  const root = makeRepo();
  const { accepted } = acceptFindings(root, 'security-privacy', [finding({ confidence: 'inferred' })]);
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].severity, 'medium');
  assert.match(accepted[0].downgraded, /downgraded from high/);
  rmSync(root, { recursive: true, force: true });
});

test('inferred + medium is left alone', () => {
  const root = makeRepo();
  const { accepted } = acceptFindings(root, 'security-privacy', [finding({ confidence: 'inferred', severity: 'medium' })]);
  assert.equal(accepted[0].severity, 'medium');
  assert.equal(accepted[0].downgraded, undefined);
  rmSync(root, { recursive: true, force: true });
});

// --- dedupe -----------------------------------------------------------------

test('two slices on one line dedupe to one issue with corroboration 2', () => {
  const a = { ...finding(), slice: 'security-privacy', domain: 'security' };
  const b = {
    ...finding({ domain: 'privacy', title: 'credential exposed in tracked source', severity: 'medium' }),
    slice: 'security-privacy',
  };
  b.slice = 'performance-maintainability';
  b.domain = 'maintainability';
  const clusters = clusterFindings([a, b]);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].corroboration, 2);
  assert.equal(clusters[0].severity, 'high', 'cluster takes the max severity');
  assert.deepEqual(clusters[0].domains, ['security', 'maintainability']);
});

test('the same slice twice does not inflate corroboration', () => {
  const a = { ...finding(), slice: 'security-privacy' };
  const b = { ...finding({ title: 'other wording' }), slice: 'security-privacy' };
  const clusters = clusterFindings([a, b]);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].corroboration, 1);
});

test('findings far apart in one file stay separate', () => {
  const a = { ...finding(), slice: 'security-privacy' };
  const b = {
    ...finding({ evidence: [{ file: 'src/client.js', line: 4, quote: 'SELECT * FROM t WHERE id' }] }),
    slice: 'security-privacy',
  };
  // lines 2 and 4 land in bucket 0 -> same cluster; check a genuinely distant one
  const c = {
    ...finding({ evidence: [{ file: 'src/other.js', line: 40, quote: 'x' }] }),
    slice: 'security-privacy',
  };
  assert.equal(clusterFindings([a, b]).length, 1);
  assert.equal(clusterFindings([a, c]).length, 2);
});

// --- ranking ----------------------------------------------------------------

test('ranking is a total order: high before medium, security before perf', () => {
  const mk = (sev, dom, file) => ({
    severity: sev, confidence: 'confirmed', corroboration: 1,
    domains: [dom], anchor: { file, line: 1 }, title: `${sev}-${dom}`,
  });
  const ranked = rankIssues([
    mk('medium', 'performance', 'b.js'),
    mk('high', 'security', 'a.js'),
    mk('medium', 'security', 'a.js'),
  ]);
  assert.deepEqual(ranked.map((r) => r.title), ['high-security', 'medium-security', 'medium-performance']);
});

// --- project memory ---------------------------------------------------------

const MEMORY = `# Project review memory

## Stack
- test: \`npm test\`

## Where to look
- user data: src/client.js

## Verdicts
- 2026-07-18 · a1b2c3d · src/client.js · security · demo key is not live: won't fix

## False-positive fixtures
- 2026-07-18 · a1b2c3d · gone/deleted.js · performance · "unbounded query": the array is fixed
- this line is malformed
`;

test('parseMemory reads all four sections and flags malformed entries', () => {
  const m = parseMemory(MEMORY);
  assert.equal(m.stack.length, 1);
  assert.equal(m.whereToLook.length, 1);
  assert.equal(m.entries.length, 2);
  assert.equal(m.malformed.length, 1);
});

test('an entry naming a deleted file is flagged stale and not applied', () => {
  const root = makeRepo();
  const { live, stale } = validateMemory(root, parseMemory(MEMORY));
  assert.equal(live.length, 1);
  assert.equal(live[0].file, 'src/client.js');
  assert.ok(stale.some((s) => /no longer exists/.test(s.reason)));
  rmSync(root, { recursive: true, force: true });
});

test('suppression matches on file + domain, and reports what matched', () => {
  const root = makeRepo();
  const { live } = validateMemory(root, parseMemory(MEMORY));
  const f = { ...finding({ severity: 'medium' }), slice: 'security-privacy' };
  const { kept, suppressed } = suppress([f], live);
  assert.equal(kept.length, 0);
  assert.equal(suppressed.length, 1);
  assert.match(suppressed[0].matchedEntry, /won't fix/);
  rmSync(root, { recursive: true, force: true });
});

test('a different domain on the same file is not suppressed', () => {
  const root = makeRepo();
  const { live } = validateMemory(root, parseMemory(MEMORY));
  const f = { ...finding({ severity: 'medium', domain: 'privacy' }), slice: 'security-privacy' };
  const { kept } = suppress([f], live);
  assert.equal(kept.length, 1);
  rmSync(root, { recursive: true, force: true });
});

test('a verdict never suppresses a high finding; it annotates it', () => {
  const root = makeRepo();
  const { live } = validateMemory(root, parseMemory(MEMORY));
  const { kept, suppressed } = suppress([{ ...finding(), slice: 'security-privacy' }], live);
  assert.equal(suppressed.length, 0);
  assert.equal(kept.length, 1);
  assert.match(kept[0].note, /severity increased since/);
  rmSync(root, { recursive: true, force: true });
});

// --- end to end -------------------------------------------------------------

test('one reviewer returning prose does not discard the other three', () => {
  const root = makeRepo();
  const { review, debug } = collate({
    repoRoot: root,
    slices: [
      { slice: 'security-privacy', raw: JSON.stringify({ slice: 'security-privacy', findings: [finding()] }) },
      { slice: 'tests-correctness', raw: 'I could not run the suite, sorry.' },
      { slice: 'performance-maintainability', raw: JSON.stringify({ slice: 'performance-maintainability', findings: [] }) },
      { slice: 'infra-supplychain', raw: JSON.stringify({ slice: 'infra-supplychain', findings: [] }) },
    ],
  });
  assert.equal(review.issues.length, 1);
  assert.equal(debug._parseFailures.length, 1);
  assert.match(review.summary, /tests-correctness.*unparseable/);
  rmSync(root, { recursive: true, force: true });
});

test('collate emits exactly the ten contract keys, in order', () => {
  const root = makeRepo();
  const { review } = collate({ repoRoot: root, slices: [] });
  assert.deepEqual(Object.keys(review), [
    'summary', 'issues', 'tests', 'security', 'privacy',
    'performance', 'maintainability', 'infra', 'patches', 'roadmap',
  ]);
  assert.ok(review.summary.length > 0, 'summary is never empty, even with no findings');
  rmSync(root, { recursive: true, force: true });
});

test('patches are hoisted, numbered, deduped, and back-linked', () => {
  const root = makeRepo();
  const diff = '--- a/src/client.js\n+++ b/src/client.js\n@@\n-bad\n+good\n';
  const { review } = collate({
    repoRoot: root,
    slices: [
      { slice: 'security-privacy', raw: JSON.stringify({ slice: 'security-privacy', findings: [finding({ patch: diff })] }) },
      { slice: 'performance-maintainability', raw: JSON.stringify({
        slice: 'performance-maintainability',
        findings: [finding({ domain: 'maintainability', severity: 'low', patch: diff })],
      }) },
    ],
  });
  assert.equal(review.patches.length, 1, 'byte-identical diffs collapse to one');
  assert.equal(review.patches[0].id, 'P1');
  assert.equal(review.patches[0].sourceIssueId, review.issues[0].id);
  assert.deepEqual(review.issues[0].patchIds, ['P1']);
  rmSync(root, { recursive: true, force: true });
});

test('a newly dirty tracked file is reported as a review defect', () => {
  const root = makeRepo();
  const { review } = collate({
    repoRoot: root,
    slices: [],
    integrity: { baseline: [], after: [' M src/client.js'], newlyDirty: ['src/client.js'] },
  });
  assert.match(review.summary, /REVIEW DEFECT/);
  assert.match(review.summary, /src\/client\.js/);
  rmSync(root, { recursive: true, force: true });
});

test('summary reports the suppression count so it is never silent', () => {
  const root = makeRepo();
  const { review, debug } = collate({
    repoRoot: root,
    memoryMd: MEMORY,
    slices: [{
      slice: 'security-privacy',
      raw: JSON.stringify({ slice: 'security-privacy', findings: [finding({ severity: 'medium' })] }),
    }],
  });
  assert.equal(review.issues.length, 0);
  assert.equal(debug._suppressed.length, 1);
  assert.match(review.summary, /1 finding suppressed by prior decisions/);
  assert.match(review.summary, /stale and ignored/);
  rmSync(root, { recursive: true, force: true });
});

test('roadmap collapses so no two entries touch the same file', () => {
  const root = makeRepo();
  const { review } = collate({
    repoRoot: root,
    slices: [{
      slice: 'security-privacy',
      raw: JSON.stringify({
        slice: 'security-privacy',
        findings: [
          finding(),
          finding({ severity: 'medium', evidence: [{ file: 'src/client.js', line: 4, quote: 'SELECT * FROM t' }] }),
        ],
      }),
    }],
  });
  const files = review.roadmap.map((r) => review.issues.find((i) => i.id === r.issueIds[0]).evidence[0].file);
  assert.equal(new Set(files).size, files.length);
  rmSync(root, { recursive: true, force: true });
});
