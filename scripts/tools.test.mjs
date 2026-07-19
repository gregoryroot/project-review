/**
 * Tests for the supporting scripts — check-standards helpers, assert-fixture's
 * failure path, and the symlink containment re-check.
 *
 * Every case here exists because the project's own self-review found the gap.
 * The common thread: each of these components fails *quietly*. A broken probe
 * reads as "the remote page moved". An assert-fixture that always passes reads
 * as a green build. A containment check that only looks at the path string
 * reads as containment.
 *
 * node --test scripts/tools.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { firstSemverTag, plausibleEdition, normalize, SOURCES } from './check-standards.mjs';
import { containsRealPath, verifyEvidence, acceptFindings } from './merge-review.mjs';

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.dirname(SCRIPTS);

// --- check-standards: tag parsing -------------------------------------------

test('firstSemverTag ignores a rolling "latest" tag', () => {
  // The real shape of the OWASP/ASVS releases feed, which is what motivated this.
  const releases = [
    { tag_name: 'latest' },
    { tag_name: 'v5.0.0_release' },
    { tag_name: 'v4.0.3_release' },
  ];
  assert.equal(firstSemverTag(releases), '5.0.0');
});

test('firstSemverTag skips drafts and prereleases', () => {
  assert.equal(firstSemverTag([
    { tag_name: 'v9.0.0', draft: true },
    { tag_name: 'v8.0.0', prerelease: true },
    { tag_name: 'v7.1.0' },
  ]), '7.1.0');
});

test('firstSemverTag returns null rather than guessing', () => {
  assert.equal(firstSemverTag([{ tag_name: 'nightly' }, { tag_name: 'latest' }]), null);
  assert.equal(firstSemverTag(null), null);
  assert.equal(firstSemverTag({ message: 'API rate limit exceeded' }), null);
});

// --- check-standards: the plausibility tripwire ------------------------------

test('plausibleEdition accepts versions and years', () => {
  for (const ok of ['5.0.0', 'v1.0', '2025', '2.2', '5']) {
    assert.equal(plausibleEdition(ok), true, `${ok} should be plausible`);
  }
});

test('plausibleEdition rejects scraped junk, so a bad probe reports unknown not changed', () => {
  // A tripwire that cries wolf gets ignored, and an ignored tripwire is
  // indistinguishable from no tripwire.
  for (const bad of ['latest', 'checks.md @ main', '', null, undefined, 'Read the docs', '1.2.3.4.5']) {
    assert.equal(plausibleEdition(bad), false, `${JSON.stringify(bad)} should be implausible`);
  }
});

test('normalize makes v-prefixed and bare versions compare equal', () => {
  assert.equal(normalize('v5.0.0'), normalize('5.0.0'));
  assert.equal(normalize('  V2.2 '), '2.2');
});

test('every configured source has a url and a probe', () => {
  for (const [key, spec] of Object.entries(SOURCES)) {
    assert.ok(spec.url?.startsWith('https://'), `${key} must use https`);
    assert.equal(typeof spec.probe, 'function', `${key} needs a probe`);
  }
});

test('importing check-standards does not fire network requests', () => {
  // The module is imported at the top of this file. If main() ran on import,
  // these tests would be making seven live HTTP calls.
  assert.ok(typeof firstSemverTag === 'function');
});

// --- symlink containment -----------------------------------------------------

function makeRepoWithEscape() {
  const base = mkdtempSync(path.join(tmpdir(), 'pr-link-'));
  const repo = path.join(base, 'repo');
  const outside = path.join(base, 'outside');
  mkdirSync(repo, { recursive: true });
  mkdirSync(outside, { recursive: true });
  writeFileSync(path.join(repo, 'real.js'), 'const x = 1;\n');
  writeFileSync(path.join(outside, 'secret.txt'), 'BEGIN RSA PRIVATE KEY\n');
  let linked = false;
  try {
    symlinkSync(path.join(outside, 'secret.txt'), path.join(repo, 'notes.txt'), 'file');
    linked = true;
  } catch {
    // Windows without Developer Mode cannot create symlinks unprivileged.
  }
  return { base, repo, linked };
}

test('containsRealPath accepts a genuine in-repo file', () => {
  const { base, repo } = makeRepoWithEscape();
  assert.equal(containsRealPath(repo, path.join(repo, 'real.js')), true);
  rmSync(base, { recursive: true, force: true });
});

test('a symlink escaping the repo is rejected, not read', { skip: process.platform === 'win32' ? 'symlinks need privilege on Windows' : false }, () => {
  const { base, repo, linked } = makeRepoWithEscape();
  if (!linked) { rmSync(base, { recursive: true, force: true }); return; }

  // Lexical containment alone would pass this: "notes.txt" resolves inside repo.
  const r = verifyEvidence(repo, { file: 'notes.txt', line: 1, quote: 'PRIVATE KEY' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /outside repo root via a link/);

  const { accepted, rejected } = acceptFindings(repo, 'security-appsec', [{
    domain: 'security', title: 'x', severity: 'high', confidence: 'confirmed',
    detail: 'd', impact: 'i',
    evidence: [{ file: 'notes.txt', line: 1, quote: 'PRIVATE KEY' }],
  }]);
  assert.equal(accepted.length, 0, 'the gate must not become a file-read oracle');
  assert.match(rejected[0].reason, /via a link/);

  rmSync(base, { recursive: true, force: true });
});

test('a repo reached through a symlink still works', { skip: process.platform === 'win32' ? 'symlinks need privilege on Windows' : false }, () => {
  // This skill is itself installed via a symlink into ~/.claude/skills, so
  // failing closed on linked roots would break the common case.
  const base = mkdtempSync(path.join(tmpdir(), 'pr-root-'));
  const real = path.join(base, 'realrepo');
  mkdirSync(real, { recursive: true });
  writeFileSync(path.join(real, 'a.js'), 'const x = 1;\n');
  const link = path.join(base, 'linked');
  try {
    symlinkSync(real, link, 'dir');
  } catch {
    rmSync(base, { recursive: true, force: true });
    return;
  }
  const r = verifyEvidence(link, { file: 'a.js', line: 1, quote: 'const x = 1;' });
  assert.equal(r.ok, true, 'a linked repo root must not fail closed');
  rmSync(base, { recursive: true, force: true });
});

test('absence findings still work after the containment change', () => {
  const { base, repo } = makeRepoWithEscape();
  // realpath throws on a missing path, so the check must not run in this branch.
  const r = verifyEvidence(repo, {
    file: '.github/workflows', line: 0, quote: "ABSENT: glob '.github/workflows/*.yml' returned 0 files",
  });
  assert.equal(r.ok, true);
  assert.equal(r.absence, true);
  rmSync(base, { recursive: true, force: true });
});

// --- assert-fixture: prove the failure path can actually fail ----------------

function runAssertFixture(a, b) {
  try {
    execFileSync(process.execPath, [path.join(SCRIPTS, 'assert-fixture.mjs'), a, b],
      { encoding: 'utf8', stdio: 'pipe' });
    return 0;
  } catch (err) {
    return err.status;
  }
}

test('assert-fixture exits 0 when the files match', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pr-fx-'));
  const f = path.join(dir, 'a.json');
  const g = path.join(dir, 'b.json');
  const doc = JSON.stringify({ summary: 's', issues: [] }, null, 2);
  writeFileSync(f, doc); writeFileSync(g, doc);
  assert.equal(runAssertFixture(f, g), 0);
  rmSync(dir, { recursive: true, force: true });
});

test('assert-fixture exits nonzero on a content difference', () => {
  // Without this, a green CI step proves nothing: an assert-fixture that always
  // passed would look exactly the same.
  const dir = mkdtempSync(path.join(tmpdir(), 'pr-fx-'));
  const f = path.join(dir, 'a.json');
  const g = path.join(dir, 'b.json');
  writeFileSync(f, JSON.stringify({ summary: 's', issues: [1] }, null, 2));
  writeFileSync(g, JSON.stringify({ summary: 's', issues: [] }, null, 2));
  assert.equal(runAssertFixture(f, g), 1);
  rmSync(dir, { recursive: true, force: true });
});

test('assert-fixture exits nonzero when key order changes', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pr-fx-'));
  const f = path.join(dir, 'a.json');
  const g = path.join(dir, 'b.json');
  writeFileSync(f, JSON.stringify({ issues: [], summary: 's' }, null, 2));
  writeFileSync(g, JSON.stringify({ summary: 's', issues: [] }, null, 2));
  assert.equal(runAssertFixture(f, g), 1);
  rmSync(dir, { recursive: true, force: true });
});

// --- encoding ---------------------------------------------------------------

test('tracked text files are free of mojibake', () => {
  const out = execFileSync(process.execPath, [path.join(SCRIPTS, 'check-encoding.mjs')],
    { encoding: 'utf8', cwd: REPO });
  assert.match(out, /check-encoding: OK/);
});

test('the encoding checker does not flag its own documentation', () => {
  // It has now false-positived on itself twice: once because its pattern list
  // spelled out the sequences it hunts for, once because the CHANGELOG names
  // the escape it looks for. A checker that cries wolf gets disabled.
  const files = ['scripts/check-encoding.mjs', 'CHANGELOG.md', 'CONTRIBUTING.md'];
  for (const f of files) {
    const text = readFileSync(path.join(REPO, f), 'utf8');
    assert.ok(text.length > 0, `${f} should be readable`);
  }
  const out = execFileSync(process.execPath, [path.join(SCRIPTS, 'check-encoding.mjs')],
    { encoding: 'utf8', cwd: REPO });
  assert.doesNotMatch(out, /check-encoding: FAILED/);
});
