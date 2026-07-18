#!/usr/bin/env node
/**
 * check-standards.mjs — propose an update to reference/standards.md.
 *
 * Run this deliberately, rarely, by hand:
 *
 *   node scripts/check-standards.mjs            # report only
 *   node scripts/check-standards.mjs --patch    # also print a diff to apply
 *
 * It fetches the current edition of each tracked standard, compares against the
 * Freshness table, and prints what it found. It DOES NOT write to
 * standards.md, and it is never invoked during a review.
 *
 * Why it only proposes:
 *
 *   1. Doctrine that updates itself from the network is remote-controlled
 *      behavior change — an edit to a page somewhere silently alters what this
 *      tool reports in every repo it runs on.
 *   2. A review that reaches the network is nondeterministic, and
 *      examples/expected-review.json stops being a regression test the moment
 *      doctrine drifts on its own.
 *
 * Approve a change the same way you approve a new banned-findings row: by hand,
 * with a CHANGELOG entry, because a user whose findings changed is owed the
 * reason.
 *
 * Network access is required only for this script. The skill itself needs none.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseFreshnessTable, checkFreshness } from './standards-freshness.mjs';

const SKILL_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const STANDARDS = path.join(SKILL_DIR, 'reference', 'standards.md');

/**
 * How to discover the current edition of each tracked standard.
 *
 * `probe` returns a short edition string, or null when it cannot tell. Failing
 * to determine an edition is a normal outcome — these are human-facing pages
 * that get restructured — and it must read as "unknown", never as "unchanged".
 */
const SOURCES = {
  'cwe-top25': {
    url: 'https://cwe.mitre.org/top25/',
    probe: (t) => (t.match(/(20\d\d)\s+CWE\s+Top\s+25/i) || [])[1] ?? null,
  },
  asvs: {
    // /releases/latest can carry a rolling tag like "latest"; walk the list and
    // take the newest tag that is actually a version.
    url: 'https://api.github.com/repos/OWASP/ASVS/releases?per_page=30',
    json: true,
    probe: (j) => firstSemverTag(j),
  },
  scorecard: {
    // checks.md ships with the tool, so the tool release IS the edition.
    url: 'https://api.github.com/repos/ossf/scorecard/releases?per_page=30',
    json: true,
    probe: (j) => firstSemverTag(j),
  },
  'api-top10': {
    url: 'https://owasp.org/API-Security/editions/2023/en/0x11-t10/',
    probe: (t) => (t.match(/OWASP\s+Top\s+10\s+API\s+Security\s+Risks\s+[–-]\s+(20\d\d)/i) || [])[1] ?? null,
  },
  'llm-top10': {
    url: 'https://api.github.com/repos/OWASP/www-project-top-10-for-large-language-model-applications/contents/README.md',
    json: true,
    probe: (j) => {
      const body = j?.content ? Buffer.from(j.content, 'base64').toString('utf8') : '';
      return (body.match(/LLM\s*Applications\s*v?(20\d\d)/i) || [])[1] ?? null;
    },
  },
  wcag: {
    url: 'https://www.w3.org/TR/WCAG22/',
    probe: (t) => (t.match(/WCAG\s*(\d+\.\d+)/i) || [])[1] ?? null,
  },
  slsa: {
    url: 'https://api.github.com/repos/slsa-framework/slsa/releases?per_page=30',
    json: true,
    probe: (j) => firstSemverTag(j),
  },
};

/**
 * Newest release tag that carries a version, as the bare version string.
 *
 * Tags in the wild are messy — OWASP/ASVS ships `v5.0.0_release` alongside a
 * rolling `latest`. Extract rather than exact-match, and skip anything with no
 * version in it at all.
 */
function firstSemverTag(releases) {
  if (!Array.isArray(releases)) return null;
  for (const r of releases) {
    if (r?.draft || r?.prerelease) continue;
    const m = String(r?.tag_name ?? '').match(/^v?(\d+(?:\.\d+){1,2})(?:[_.-].*)?$/);
    if (m) return m[1];
  }
  return null;
}

/**
 * Does this look like an edition at all?
 *
 * A probe that scrapes something unrecognizable must report "unknown", never
 * "changed". A tripwire that cries wolf gets ignored, and an ignored tripwire is
 * indistinguishable from no tripwire — which is the failure this whole layer
 * exists to avoid.
 */
function plausibleEdition(s) {
  const v = String(s ?? '').trim();
  if (!v) return false;
  return /^v?\d+(\.\d+){0,2}$/.test(v) || /^20\d\d$/.test(v);
}

async function probeOne(key, spec, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(spec.url, {
      signal: ctl.signal,
      headers: { 'user-agent': 'claude-project-review/check-standards', accept: '*/*' },
    });
    if (!res.ok) return { key, edition: null, error: `HTTP ${res.status}` };
    const body = spec.json ? await res.json() : await res.text();
    return { key, edition: spec.probe(body), error: null };
  } catch (err) {
    return { key, edition: null, error: err.name === 'AbortError' ? 'timed out' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

function normalize(s) {
  return String(s ?? '').trim().replace(/^v/i, '').toLowerCase();
}

async function main() {
  const wantPatch = process.argv.includes('--patch');
  const md = readFileSync(STANDARDS, 'utf8');
  const { rows, malformed } = parseFreshnessTable(md);
  const freshness = checkFreshness(md);

  if (!rows.length) {
    console.error('check-standards: no Freshness table found in reference/standards.md');
    process.exit(2);
  }

  console.log(`Checking ${rows.length} tracked standards against ${path.relative(SKILL_DIR, STANDARDS)}\n`);

  if (freshness.overdue.length) {
    console.log('Past expected cadence (offline check):');
    for (const o of freshness.overdue) {
      console.log(`  ! ${o.standard.padEnd(32)} verified ${o.checked}, ${o.ageMonths}mo ago (${o.cadence}, budget ${o.budgetMonths}mo)`);
    }
    console.log('');
  }
  for (const m of malformed) console.log(`  ? malformed row "${m.key}": ${m.reason}`);

  const probes = await Promise.all(
    rows
      .filter((r) => SOURCES[r.key])
      .map((r) => probeOne(r.key, SOURCES[r.key], 15000))
  );
  const byKey = new Map(probes.map((p) => [p.key, p]));

  const changed = [];
  const unknown = [];
  const untracked = rows.filter((r) => !SOURCES[r.key]).map((r) => r.key);

  console.log('Live check:');
  for (const row of rows) {
    const probe = byKey.get(row.key);
    if (!probe) {
      console.log(`  - ${row.key.padEnd(14)} no probe configured — verify by hand`);
      continue;
    }
    if (probe.error || probe.edition == null) {
      unknown.push(row.key);
      console.log(`  ? ${row.key.padEnd(14)} could not determine (${probe.error || 'no match on page'}) — verify by hand`);
      continue;
    }
    if (!plausibleEdition(probe.edition)) {
      unknown.push(row.key);
      console.log(`  ? ${row.key.padEnd(14)} scraped "${probe.edition}", which is not a plausible edition — verify by hand`);
      continue;
    }
    if (normalize(probe.edition) === normalize(row.edition)) {
      console.log(`  = ${row.key.padEnd(14)} ${row.edition} (unchanged)`);
    } else {
      changed.push({ ...row, latest: probe.edition });
      console.log(`  * ${row.key.padEnd(14)} ${row.edition} -> ${probe.edition}  CHANGED`);
    }
  }

  console.log('');
  if (!changed.length && !unknown.length && !untracked.length) {
    console.log('No edition changes detected. Nothing to do.');
    console.log('If you want to re-stamp the Checked dates anyway, edit the table by hand.');
    return;
  }

  if (changed.length) {
    console.log(`${changed.length} standard(s) appear to have a newer edition.\n`);
    console.log('Proposed, NOT applied. For each change you accept:');
    console.log('  1. Read the new edition and update the prose section in standards.md');
    console.log('     — identifiers may have been renumbered, added, or retired.');
    console.log('  2. Check whether any reviewers/*.md hunting order needs to change.');
    console.log('  3. Update the Edition and Checked cells in the Freshness table.');
    console.log('  4. Add a CHANGELOG entry: doctrine changes change what users see.\n');
  }
  if (unknown.length) {
    console.log(`Could not verify by probe: ${unknown.join(', ')} — check these by hand before trusting the table.\n`);
  }

  if (wantPatch && changed.length) {
    const today = new Date().toISOString().slice(0, 10);
    console.log('--- suggested Freshness table edits (review each before applying) ---');
    for (const c of changed) {
      console.log(`-| ${c.key} | ${c.standard} | ${c.edition} | ${c.checked} | ${c.cadence} |`);
      console.log(`+| ${c.key} | ${c.standard} | ${c.latest} | ${today} | ${c.cadence} |`);
    }
    console.log('--- end ---');
    console.log('\nDo not apply these mechanically. The Edition cell is the cheap part;');
    console.log('the prose and the reviewer doctrine behind it are the actual work.');
  }

  // Exit 1 so CI or a wrapper can notice, without implying the tool is broken.
  if (changed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`check-standards: ${err.message}`);
  process.exit(2);
});
