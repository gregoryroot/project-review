#!/usr/bin/env node
/**
 * merge-review.mjs — deterministic merge + grounding gate for /project-review.
 *
 * Reviewers propose findings. This script decides which ones survive. That
 * split is the point: a model merging its own subagents' output will not delete
 * a plausible-sounding finding for lacking a valid line number, and the merge
 * is the only place hallucination gets filtered.
 *
 * Pipeline: parseSlice -> acceptFindings -> suppress -> dedupe -> rank -> collate
 *
 * Usage:
 *   node merge-review.mjs --repo <root> --in <slices-dir> --out <out-dir>
 *                         [--memory <PROJECT-REVIEW.md>] [--summary <file>]
 *                         [--baseline <file>] [--after <file>]
 *
 * Zero dependencies. Node >= 18.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkFreshness } from './standards-freshness.mjs';

// ---------------------------------------------------------------------------
// constants
// ---------------------------------------------------------------------------

export const SLICE_DOMAINS = {
  // core — always spawned
  'security-appsec': ['security'],
  'security-authz-identity': ['security'],
  'privacy-data': ['privacy'],
  'tests-correctness': ['tests'],
  'performance-observability': ['performance', 'maintainability'],
  'infra-supplychain': ['infra'],
  // conditional — spawned only when the repo has the relevant markers
  'accessibility': ['accessibility'],
  'ai-llm': ['security', 'privacy'],
};

export const SEVERITY_RANK = { high: 3, medium: 2, low: 1, info: 0 };
export const DOMAIN_PRIORITY = {
  security: 0, privacy: 1, tests: 2, infra: 3,
  accessibility: 4, performance: 5, maintainability: 6,
};

/**
 * Citation forms accepted on a finding's `standard[]`. A malformed identifier is
 * dropped rather than failing the finding: a bad citation is noise, but the
 * grounded defect underneath it is still real. See reference/standards.md.
 */
export const STANDARD_PATTERNS = [
  /^CWE-\d+$/,
  /^ASVS-V\d+(\.\d+){0,2}$/,
  /^API\d{1,2}:2023$/,
  /^LLM\d{2}:2025$/,
  /^WCAG-\d+\.\d+\.\d+$/,
  /^Scorecard:[A-Za-z-]+$/,
  /^SLSA-Build-L[0-3]$/,
  /^SSDF-[A-Z]{2}\.\d+(\.\d+)?$/,
];

export function cleanStandards(value) {
  if (!Array.isArray(value)) return { kept: [], dropped: [] };
  const kept = [], dropped = [];
  for (const s of value.slice(0, 3)) {
    const id = String(s).trim();
    (STANDARD_PATTERNS.some((re) => re.test(id)) ? kept : dropped).push(id);
  }
  return { kept, dropped };
}

const QUOTE_WINDOW = 3; // lines either side of the claimed line

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Normalize to forward slashes so anchors compare equal across platforms. */
export function toPosix(p) {
  return p.split(path.sep).join('/');
}

/** Collapse all whitespace runs to a single space, for tolerant quote matching. */
export function normalizeWhitespace(s) {
  return String(s).replace(/\s+/g, ' ').trim();
}

/**
 * Resolve `rel` under `repoRoot`, refusing anything that escapes it.
 *
 * evidence[].file arrives from subagent output, and this function is the only
 * thing standing between that string and readFileSync. The gate that exists to
 * stop hallucination must not itself become an arbitrary-file-read primitive:
 * `../../.ssh/id_rsa` has to come back null, not a file handle.
 */
export function safeResolve(repoRoot, rel) {
  if (typeof rel !== 'string' || rel.length === 0) return null;
  if (rel.includes('\0')) return null;
  if (path.isAbsolute(rel) || /^[A-Za-z]:[\\/]/.test(rel)) return null;
  const root = path.resolve(repoRoot);
  const full = path.resolve(root, rel);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (full !== root && !full.startsWith(rootWithSep)) return null;
  return full;
}

// ---------------------------------------------------------------------------
// 1. parse — one reviewer returning prose must not discard the other three
// ---------------------------------------------------------------------------

export function parseSlice(raw) {
  if (raw == null) return { ok: false, reason: 'empty output' };
  let text = String(raw).trim();
  if (text === '') return { ok: false, reason: 'empty output' };

  // strip code fences
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();

  // locate the first plausible JSON start and walk to its match
  const start = text.search(/[{[]/);
  if (start === -1) return { ok: false, reason: 'no JSON found in output' };

  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return { ok: false, reason: 'unterminated JSON in output' };

  try {
    const value = JSON.parse(text.slice(start, end + 1));
    const obj = Array.isArray(value) ? { findings: value } : value;
    if (!obj || typeof obj !== 'object') return { ok: false, reason: 'JSON is not an object' };
    return {
      ok: true,
      slice: obj.slice,
      findings: Array.isArray(obj.findings) ? obj.findings : [],
      tests: Array.isArray(obj.tests) ? obj.tests : [],
      assumptions: Array.isArray(obj.assumptions) ? obj.assumptions : [],
    };
  } catch (err) {
    return { ok: false, reason: `JSON parse failed: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// 2. accept gate — the grounding check
// ---------------------------------------------------------------------------

/**
 * Verify one evidence item against the real file.
 * line === 0 means an absence claim: the path must genuinely not exist.
 */
export function verifyEvidence(repoRoot, ev) {
  if (!ev || typeof ev !== 'object') return { ok: false, reason: 'evidence item is not an object' };
  const rel = ev.file;
  const full = safeResolve(repoRoot, rel);
  if (full === null) return { ok: false, reason: `evidence path escapes repo root or is absolute: ${rel}` };

  const line = Number(ev.line);
  if (!Number.isInteger(line) || line < 0) return { ok: false, reason: `line is not a non-negative integer: ${ev.line}` };

  // absence finding
  if (line === 0) {
    if (existsSync(full)) return { ok: false, reason: `absence claimed but path exists: ${rel}` };
    if (!/^ABSENT:/.test(String(ev.quote || ''))) {
      return { ok: false, reason: 'line 0 requires a quote beginning "ABSENT:"' };
    }
    return { ok: true, absence: true };
  }

  if (!existsSync(full)) return { ok: false, reason: `file does not exist: ${rel}` };
  let st;
  try { st = statSync(full); } catch { return { ok: false, reason: `cannot stat: ${rel}` }; }
  if (st.isDirectory()) return { ok: false, reason: `evidence path is a directory: ${rel}` };

  let lines;
  try { lines = readFileSync(full, 'utf8').split(/\r?\n/); }
  catch (err) { return { ok: false, reason: `cannot read ${rel}: ${err.message}` }; }

  if (line > lines.length) return { ok: false, reason: `line ${line} past EOF (${lines.length} lines) in ${rel}` };

  const quote = normalizeWhitespace(ev.quote);
  if (quote === '') return { ok: false, reason: 'empty quote' };

  const lo = Math.max(0, line - 1 - QUOTE_WINDOW);
  const hi = Math.min(lines.length, line + QUOTE_WINDOW);
  const window = normalizeWhitespace(lines.slice(lo, hi).join(' '));
  if (!window.includes(quote)) {
    return { ok: false, reason: `quote not found within ${rel}:${line} ±3` };
  }
  return { ok: true, absence: false };
}

export function acceptFindings(repoRoot, slice, findings) {
  const accepted = [];
  const rejected = [];
  const allowed = SLICE_DOMAINS[slice] || [];

  for (const f of findings) {
    if (!f || typeof f !== 'object') {
      rejected.push({ finding: f, slice, reason: 'finding is not an object' });
      continue;
    }
    if (!allowed.includes(f.domain)) {
      rejected.push({ finding: f, slice, reason: `domain "${f.domain}" is outside slice "${slice}"` });
      continue;
    }
    if (!Array.isArray(f.evidence) || f.evidence.length === 0) {
      rejected.push({ finding: f, slice, reason: 'no evidence' });
      continue;
    }
    if (!(f.severity in SEVERITY_RANK)) {
      rejected.push({ finding: f, slice, reason: `unknown severity "${f.severity}"` });
      continue;
    }
    if (f.confidence !== 'confirmed' && f.confidence !== 'inferred') {
      rejected.push({ finding: f, slice, reason: `unknown confidence "${f.confidence}"` });
      continue;
    }

    // every evidence item must verify; one bad quote kills the finding
    let bad = null;
    for (const ev of f.evidence) {
      const r = verifyEvidence(repoRoot, ev);
      if (!r.ok) { bad = r.reason; break; }
    }
    if (bad) {
      rejected.push({ finding: f, slice, reason: bad });
      continue;
    }

    const out = { ...f, slice, evidence: f.evidence.map((e) => ({ ...e, file: toPosix(e.file) })) };

    const std = cleanStandards(f.standard);
    out.standard = std.kept;
    if (std.dropped.length) out.droppedStandards = std.dropped;

    // inferred may not be high: downgrade, do not drop
    if (out.confidence === 'inferred' && out.severity === 'high') {
      out.severity = 'medium';
      out.downgraded = 'inferred findings may not be high severity; downgraded from high';
    }
    accepted.push(out);
  }
  return { accepted, rejected };
}

// ---------------------------------------------------------------------------
// 3. suppression — prior human decisions, applied here and never by reviewers
// ---------------------------------------------------------------------------

/** Parse Verdicts / False-positive fixtures out of PROJECT-REVIEW.md. */
export function parseMemory(md) {
  const out = { stack: [], whereToLook: [], entries: [], malformed: [] };
  if (!md) return out;
  let section = null;
  for (const rawLine of String(md).split(/\r?\n/)) {
    const line = rawLine.trim();
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      const name = h[1].toLowerCase();
      if (name === 'stack') section = 'stack';
      else if (name === 'where to look') section = 'where';
      else if (name === 'verdicts') section = 'verdict';
      else if (name === 'false-positive fixtures') section = 'fixture';
      else section = null;
      continue;
    }
    if (!section || !line.startsWith('- ')) continue;
    const body = line.slice(2).trim();
    if (section === 'stack') { out.stack.push(body); continue; }
    if (section === 'where') { out.whereToLook.push(body); continue; }

    // DATE · SHA · FILE · DOMAIN · TEXT
    const parts = body.split('·').map((s) => s.trim());
    if (parts.length < 5) { out.malformed.push({ entry: body, reason: 'expected 5 fields separated by "·"' }); continue; }
    const [date, sha, file, domain, ...rest] = parts;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { out.malformed.push({ entry: body, reason: `bad date "${date}"` }); continue; }
    if (!(domain in DOMAIN_PRIORITY)) { out.malformed.push({ entry: body, reason: `unknown domain "${domain}"` }); continue; }
    out.entries.push({
      kind: section, date, sha,
      file: toPosix(file.replace(/^`|`$/g, '')),
      domain, text: rest.join(' · '), raw: body,
    });
  }
  return out;
}

/**
 * An entry whose subject is gone must not be applied. A memory that outlives
 * what it describes reports on a system that no longer exists, with all the
 * confidence of something written down.
 */
export function validateMemory(repoRoot, memory) {
  const live = [], stale = [...memory.malformed];
  for (const e of memory.entries) {
    const full = safeResolve(repoRoot, e.file);
    if (full === null) { stale.push({ entry: e.raw, reason: `path escapes repo root: ${e.file}` }); continue; }
    if (!existsSync(full)) { stale.push({ entry: e.raw, reason: `names ${e.file}, which no longer exists` }); continue; }
    live.push(e);
  }
  return { live, stale };
}

export function suppress(findings, liveEntries) {
  const kept = [], suppressed = [];
  for (const f of findings) {
    // A verdict is a decision about a known risk, not a permanent waiver.
    if (f.severity === 'high') {
      const cover = liveEntries.find((e) => e.domain === f.domain && f.evidence.some((ev) => ev.file === e.file));
      if (cover) {
        kept.push({ ...f, note: 'a prior verdict covers this file; severity increased since' });
        continue;
      }
      kept.push(f);
      continue;
    }
    const match = liveEntries.find((e) => e.domain === f.domain && f.evidence.some((ev) => ev.file === e.file));
    if (match) suppressed.push({ finding: f, matchedEntry: match.raw });
    else kept.push(f);
  }
  return { kept, suppressed };
}

// ---------------------------------------------------------------------------
// 4. dedupe — keyed on the anchor, the one field the gate already verified
// ---------------------------------------------------------------------------

function anchorOf(f) {
  const ev = f.evidence[0];
  return { file: toPosix(ev.file), line: Number(ev.line) || 0 };
}

export function clusterFindings(findings) {
  const buckets = new Map(); // "file::bucket" -> cluster
  const clusters = [];

  for (const f of findings) {
    const { file, line } = anchorOf(f);
    const b = Math.floor(line / 5);
    let target = null;
    for (const nb of [b, b - 1, b + 1]) {
      const hit = buckets.get(`${file}::${nb}`);
      if (hit) { target = hit; break; }
    }
    if (!target) {
      target = { anchor: { file, line }, members: [] };
      clusters.push(target);
      buckets.set(`${file}::${b}`, target);
    } else {
      buckets.set(`${file}::${b}`, target);
    }
    target.members.push(f);
  }

  return clusters.map((c) => {
    const m = c.members;
    const worst = m.reduce((a, b) => (SEVERITY_RANK[b.severity] > SEVERITY_RANK[a.severity] ? b : a));
    const slices = new Set(m.map((x) => x.slice));
    const domains = [...new Set(m.map((x) => x.domain))].sort((a, b) => DOMAIN_PRIORITY[a] - DOMAIN_PRIORITY[b]);
    const repro = m.map((x) => x.repro).filter(Boolean).sort((a, b) => b.length - a.length)[0] || '';
    return {
      title: worst.title,
      severity: worst.severity,
      // confirmed wins: if any slice demonstrated it, it is demonstrated
      confidence: m.some((x) => x.confidence === 'confirmed') ? 'confirmed' : 'inferred',
      detail: worst.detail,
      impact: worst.impact,
      domains,
      standard: [...new Set(m.flatMap((x) => x.standard || []))].sort(),
      anchor: c.anchor,
      evidence: m.flatMap((x) => x.evidence),
      repro,
      // slices are disjoint, so an agent cannot corroborate itself
      corroboration: slices.size,
      members: m,
    };
  });
}

// ---------------------------------------------------------------------------
// 5. rank — total order, so the same input always produces the same output
// ---------------------------------------------------------------------------

export function rankIssues(clusters) {
  return [...clusters].sort((a, b) => {
    const s = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (s) return s;
    const c = (a.confidence === 'confirmed' ? 0 : 1) - (b.confidence === 'confirmed' ? 0 : 1);
    if (c) return c;
    const k = b.corroboration - a.corroboration;
    if (k) return k;
    const d = DOMAIN_PRIORITY[a.domains[0]] - DOMAIN_PRIORITY[b.domains[0]];
    if (d) return d;
    const p = a.anchor.file.localeCompare(b.anchor.file);
    if (p) return p;
    return a.anchor.line - b.anchor.line;
  });
}

export function buildRoadmap(issues) {
  const picked = [], seenFiles = new Set();
  const forced = issues.filter((i) => i.severity === 'high' && (i.domains.includes('security') || i.domains.includes('privacy')));
  for (const i of [...forced, ...issues]) {
    if (picked.length >= 5) break;
    if (picked.includes(i)) continue;
    if (seenFiles.has(i.anchor.file)) continue;
    seenFiles.add(i.anchor.file);
    picked.push(i);
  }
  return picked.map((i, n) => ({
    order: n + 1,
    issueIds: [i.id],
    action: i.title,
    verify: i.verify || 'reread the cited line and confirm the quoted construct is gone',
  }));
}

// ---------------------------------------------------------------------------
// 6. collate
// ---------------------------------------------------------------------------

export function collate({ repoRoot, slices, memoryMd = '', summary = '', integrity = null, standardsMd = '' }) {
  const rejected = [], assumptions = [], parseFailures = [];
  let acceptedAll = [], testEntries = [];

  for (const { slice, raw } of slices) {
    const parsed = parseSlice(raw);
    if (!parsed.ok) { parseFailures.push({ slice, reason: parsed.reason }); continue; }
    const name = SLICE_DOMAINS[parsed.slice] ? parsed.slice : slice;
    const { accepted, rejected: rej } = acceptFindings(repoRoot, name, parsed.findings);
    acceptedAll = acceptedAll.concat(accepted);
    rejected.push(...rej);
    for (const t of parsed.tests) testEntries.push(t);
    for (const a of parsed.assumptions) assumptions.push({ slice: name, text: String(a) });
  }

  const memory = parseMemory(memoryMd);
  const { live, stale } = validateMemory(repoRoot, memory);
  const { kept, suppressed } = suppress(acceptedAll, live);

  const clusters = clusterFindings(kept);
  const ranked = rankIssues(clusters);
  ranked.forEach((c, i) => { c.id = `I${i + 1}`; });

  // patches: authored by reviewers, promoted here
  const patches = [];
  const seenDiffs = new Set();
  for (const c of ranked) {
    for (const m of c.members) {
      if (!m.patch || typeof m.patch !== 'string') continue;
      const diff = m.patch;
      if (seenDiffs.has(diff)) continue;
      seenDiffs.add(diff);
      patches.push({
        id: `P${patches.length + 1}`,
        sourceIssueId: c.id,
        file: toPosix(m.evidence[0].file),
        diff,
        rationale: m.title,
      });
    }
  }
  const patchesByIssue = new Map();
  for (const p of patches) {
    if (!patchesByIssue.has(p.sourceIssueId)) patchesByIssue.set(p.sourceIssueId, []);
    patchesByIssue.get(p.sourceIssueId).push(p.id);
  }

  const byDomain = {
    security: [], privacy: [], performance: [],
    maintainability: [], infra: [], accessibility: [],
  };
  let n = 0;
  for (const c of ranked) {
    for (const m of c.members) {
      if (!(m.domain in byDomain)) continue;
      byDomain[m.domain].push({
        id: `F${++n}`,
        issueId: c.id,
        title: m.title,
        severity: m.severity,
        confidence: m.confidence,
        detail: m.detail,
        impact: m.impact,
        standard: m.standard,
        evidence: m.evidence,
        repro: m.repro || undefined,
        downgraded: m.downgraded || undefined,
        note: m.note || undefined,
      });
    }
  }

  const issues = ranked.map((c) => ({
    id: c.id,
    title: c.title,
    severity: c.severity,
    confidence: c.confidence,
    domains: c.domains,
    standard: c.standard,
    detail: c.detail,
    impact: c.impact,
    evidence: c.evidence,
    repro: c.repro || undefined,
    corroboration: c.corroboration,
    patchIds: patchesByIssue.get(c.id) || [],
  }));

  // summary: human prose first, then the machine-generated accounting
  const parts = [];
  if (summary) parts.push(String(summary).trim());
  parts.push(
    `${issues.length} issue${issues.length === 1 ? '' : 's'} from ${acceptedAll.length} accepted finding${acceptedAll.length === 1 ? '' : 's'}; ` +
    `${rejected.length} rejected by the grounding gate.`
  );
  if (suppressed.length) parts.push(`${suppressed.length} finding${suppressed.length === 1 ? '' : 's'} suppressed by prior decisions.`);
  if (stale.length) parts.push(`${stale.length} project-memory entr${stale.length === 1 ? 'y was' : 'ies were'} stale and ignored.`);
  for (const pf of parseFailures) parts.push(`Reviewer "${pf.slice}" returned unparseable output (${pf.reason}); its slice is missing from this report.`);
  if (integrity && integrity.newlyDirty && integrity.newlyDirty.length) {
    parts.push(`REVIEW DEFECT: this review left ${integrity.newlyDirty.length} tracked file(s) newly modified: ${integrity.newlyDirty.join(', ')}.`);
  } else if (integrity) {
    parts.push('Read-only integrity check passed: working tree unchanged outside .claude/review/.');
  }
  if (assumptions.length) {
    parts.push('\nAssumptions (unverified, discount accordingly):\n' + assumptions.map((a) => `- [${a.slice}] ${a.text}`).join('\n'));
  }

  const review = {
    summary: parts.join(' ').trim(),
    issues,
    tests: testEntries,
    security: byDomain.security,
    privacy: byDomain.privacy,
    accessibility: byDomain.accessibility,
    performance: byDomain.performance,
    maintainability: byDomain.maintainability,
    infra: byDomain.infra,
    patches,
    roadmap: buildRoadmap(ranked),
  };

  // A tool-maintenance note, deliberately kept out of `summary`: the reader of a
  // repo review is not the person who maintains this skill's standards index.
  const freshness = checkFreshness(standardsMd);

  const debug = {
    _standardsFreshness: freshness,
    _rejected: rejected,
    _suppressed: suppressed,
    _assumptions: assumptions,
    _stale: stale,
    _parseFailures: parseFailures,
    _integrity: integrity || {},
  };

  return { review, debug };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--')) continue;
    out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(args.repo || process.cwd());
  const inDir = path.resolve(args.in || path.join(repoRoot, '.claude', 'review', 'slices'));
  const outDir = path.resolve(args.out || path.join(repoRoot, '.claude', 'review'));

  if (!existsSync(inDir)) {
    console.error(`merge-review: slices dir not found: ${inDir}`);
    process.exit(2);
  }

  const slices = readdirSync(inDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({
      slice: path.basename(f, '.json').replace(/^slice-/, ''),
      raw: readFileSync(path.join(inDir, f), 'utf8'),
    }));

  const skillDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const standardsPath = args.standards || path.join(skillDir, 'reference', 'standards.md');
  const standardsMd = existsSync(standardsPath) ? readFileSync(standardsPath, 'utf8') : '';

  const memoryMd = args.memory && existsSync(args.memory) ? readFileSync(args.memory, 'utf8') : '';
  const summary = args.summary && existsSync(args.summary) ? readFileSync(args.summary, 'utf8') : '';

  let integrity = null;
  if (args.baseline && args.after && existsSync(args.baseline) && existsSync(args.after)) {
    const read = (p) => readFileSync(p, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const baseline = read(args.baseline);
    const after = read(args.after);
    const base = new Set(baseline);
    const newlyDirty = after
      .filter((l) => !base.has(l))
      .map((l) => l.replace(/^\S+\s+/, ''))
      .filter((f) => !f.startsWith('.claude/review/'));
    integrity = { baseline, after, newlyDirty };
  }

  const { review, debug } = collate({ repoRoot, slices, memoryMd, summary, integrity, standardsMd });

  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(path.join(outDir, 'review.json'), JSON.stringify(review, null, 2) + '\n');
  writeFileSync(path.join(outDir, `review-${stamp}.json`), JSON.stringify(review, null, 2) + '\n');
  writeFileSync(path.join(outDir, 'review-debug.json'), JSON.stringify(debug, null, 2) + '\n');

  console.log(`merge-review: ${review.issues.length} issues, ${debug._rejected.length} rejected, ${debug._suppressed.length} suppressed`);
  console.log(`wrote ${toPosix(path.join(outDir, 'review.json'))}`);
  if (debug._standardsFreshness.note) console.warn(`\n[maintenance] ${debug._standardsFreshness.note}`);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]).endsWith('merge-review.mjs');
if (invokedDirectly) main();
