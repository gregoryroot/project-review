#!/usr/bin/env node
/**
 * check-encoding.mjs — catch mojibake in tracked text files.
 *
 * This exists because it already happened: a PowerShell round-trip through
 * Get-Content -Raw on Windows PowerShell 5.1 read UTF-8 files as ANSI and turned
 * every em-dash into "a-circumflex euro". The corruption is easy to miss in a
 * diff and lands in doctrine that gets read by both humans and models.
 *
 *   node scripts/check-encoding.mjs
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * The classic UTF-8-read-as-CP1252 signatures, built from code points rather
 * than written literally — a detector that spells out the strings it hunts for
 * flags its own source, which is how this file failed its own check the first
 * time it ran.
 */
const MOJIBAKE = [
  [0xe2, 0x80, 0x94], // em dash   U+2014
  [0xe2, 0x80, 0x93], // en dash   U+2013
  [0xe2, 0x80, 0x99], // right single quote U+2019
  [0xe2, 0x80, 0x9c], // left double quote  U+201C
  [0xc2, 0xb7],       // middle dot U+00B7
  [0xc3, 0xa9],       // e-acute    U+00E9
  [0xef, 0xbb, 0xbf], // BOM read as text
].map((codes) => String.fromCharCode(...codes));

const TEXT = /\.(md|mjs|js|json|yml|yaml|txt)$/;

let files;
try {
  files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter((f) => TEXT.test(f));
} catch {
  console.error('check-encoding: not a git repo');
  process.exit(2);
}

const hits = [];
for (const file of files) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  for (const seq of MOJIBAKE) {
    const idx = text.indexOf(seq);
    if (idx !== -1) {
      const line = text.slice(0, idx).split('\n').length;
      hits.push(`${file}:${line} contains a mojibake sequence`);
      break;
    }
  }
  // A literal backslash-r-backslash-n in prose is almost always a botched
  // search-and-replace. Inside a code span or fence it is documentation — this
  // file and the CHANGELOG both legitimately name the sequence — so strip code
  // before looking. Source files are skipped entirely; escapes are their job.
  if (!/\.(mjs|js|json)$/.test(file)) {
    const prose = text
      .replace(/```[\s\S]*?```/g, '')  // fenced blocks
      .replace(/`[^`\n]*`/g, '');      // inline code spans
    const idx = prose.indexOf('\\r\\n');
    if (idx !== -1) {
      const line = prose.slice(0, idx).split('\n').length;
      hits.push(`${file}:~${line} contains a literal \\r\\n escape outside a code span`);
    }
  }
}

if (hits.length) {
  console.error('check-encoding: FAILED\n');
  for (const h of hits) console.error('  ' + h);
  console.error('\nLikely cause: a text round-trip through a tool that guessed the encoding.');
  process.exit(1);
}

console.log(`check-encoding: OK — ${files.length} tracked text files clean`);
