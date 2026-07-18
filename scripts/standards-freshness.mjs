/**
 * standards-freshness.mjs — offline staleness tripwire for reference/standards.md.
 *
 * Reads the Freshness table and reports which standards are past the point where
 * a new edition was expected. Costs nothing: no network, no I/O beyond the one
 * file, and it never changes a finding about the repo under review.
 *
 * The output is a defect report about *this tool*, for whoever maintains it. A
 * standards index that outlives its subject produces findings citing retired
 * requirements with total confidence — the same failure the project-memory
 * staleness rules exist to prevent, one level up.
 *
 * Refreshing is a separate, manual, network-using step: scripts/check-standards.mjs.
 */

/** Months of headroom before a new edition is expected. */
export const CADENCE_MONTHS = {
  continuous: 6,
  annual: 12,
  'multi-year': 36,
  rare: 60,
};

/**
 * Parse the `## Freshness` table out of standards.md.
 * Columns, in order: Key | Standard | Edition | Checked | Cadence
 */
export function parseFreshnessTable(md) {
  const rows = [];
  const malformed = [];
  if (!md) return { rows, malformed };

  const lines = String(md).split(/\r?\n/);
  let inSection = false;

  for (const raw of lines) {
    const line = raw.trim();
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      inSection = heading[1].toLowerCase() === 'freshness';
      continue;
    }
    if (!inSection || !line.startsWith('|')) continue;

    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length !== 5) continue;
    if (/^-+$/.test(cells[0].replace(/[\s:]/g, ''))) continue; // separator row
    if (cells[0].toLowerCase() === 'key') continue;            // header row

    const [key, standard, edition, checked, cadence] = cells;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checked)) {
      malformed.push({ key, reason: `bad Checked date "${checked}", expected YYYY-MM-DD` });
      continue;
    }
    if (!(cadence in CADENCE_MONTHS)) {
      malformed.push({ key, reason: `unknown cadence "${cadence}"` });
      continue;
    }
    rows.push({ key, standard, edition, checked, cadence });
  }
  return { rows, malformed };
}

/** Whole months between two dates, floored. */
function monthsBetween(from, to) {
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12
    + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return months;
}

/**
 * @returns {{ overdue: Array, fresh: Array, malformed: Array, note: string|null }}
 */
export function checkFreshness(md, now = new Date()) {
  const { rows, malformed } = parseFreshnessTable(md);
  const overdue = [];
  const fresh = [];

  for (const row of rows) {
    const checkedAt = new Date(`${row.checked}T00:00:00Z`);
    const budget = CADENCE_MONTHS[row.cadence];
    const age = monthsBetween(checkedAt, now);
    const entry = { ...row, ageMonths: age, budgetMonths: budget };
    if (age > budget) overdue.push({ ...entry, overdueByMonths: age - budget });
    else fresh.push(entry);
  }

  overdue.sort((a, b) => b.overdueByMonths - a.overdueByMonths);

  let note = null;
  if (overdue.length || malformed.length) {
    const parts = overdue.map(
      (o) => `${o.standard} (${o.edition}) last verified ${o.checked}, ${o.ageMonths}mo ago against a ${o.budgetMonths}mo ${o.cadence} cadence`
    );
    for (const m of malformed) parts.push(`${m.key}: ${m.reason}`);
    note = `Standards index may be stale — ${parts.join('; ')}. `
      + 'This is a maintenance note about project-review itself, not a finding about the repo under review. '
      + 'Run `node scripts/check-standards.mjs` to propose an update.';
  }

  return { overdue, fresh, malformed, note };
}
