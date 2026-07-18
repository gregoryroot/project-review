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

// The classic UTF-8-read-as-Latin-1 signatures.
const MOJIBAKE = [
  'Ã¢â‚¬', // em/en dash, quotes
  'Ã©',                   // e-acute
  'Ã¯Â»Â¿', // BOM read as ANSI
  'â€”',             // em dash
  'â€“',             // en dash
  'â€™',             // right single quote
  'Â·',                   // middle dot
];

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
  if (text.includes('\\r\\n')) {
    const idx = text.indexOf('\\r\\n');
    const line = text.slice(0, idx).split('\n').length;
    // A literal backslash-r-backslash-n in a text file is almost always a
    // botched search-and-replace, not intent.
    if (!file.endsWith('.mjs') && !file.endsWith('.js')) {
      hits.push(`${file}:${line} contains a literal \\r\\n escape`);
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
