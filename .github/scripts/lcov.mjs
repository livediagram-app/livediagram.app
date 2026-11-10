// Reads CI's lcov reports, for the coverage report and the editor coverage floors (docs/ci.md
// "Coverage report", "Editor coverage floors"). Shards and workspaces overlap on shared files, so
// reports merge: a line counts as hit when any report hit it, a branch as taken when any report took it.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/** Per file: line → hit count, and `line,block,branch` → whether any report took that branch. */
/** @typedef {Map<string, { lines: Map<number, number>, branchKeys: Map<string, boolean> }>} Coverage */

/**
 * Folds an lcov file into `into`.
 * @param {string} text
 * @param {Coverage} into
 */
export function mergeLcov(text, into) {
  let file = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('SF:')) {
      const sf = line.slice(3).replace(/\\/g, '/');
      if (!into.has(sf)) into.set(sf, { lines: new Map(), branchKeys: new Map() });
      file = into.get(sf);
    } else if (!file) continue;
    else if (line.startsWith('DA:')) {
      const [ln, hits] = line.slice(3).split(',').map(Number);
      file.lines.set(ln, Math.max(file.lines.get(ln) ?? 0, hits));
    } else if (line.startsWith('BRDA:')) {
      const [ln, block, branch, taken] = line.slice(5).split(',');
      const key = `${ln},${block},${branch}`;
      const was = file.branchKeys.get(key) ?? false;
      file.branchKeys.set(key, was || (taken !== '-' && Number(taken) > 0));
    } else if (line === 'end_of_record') {
      file = null;
    }
  }
  return into;
}

/** Every lcov.info under `dir`. */
export function lcovFiles(/** @type {string} */ dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...lcovFiles(p));
    else if (entry === 'lcov.info') out.push(p);
  }
  return out;
}

/** The coverage in folders `dirs`, merged. */
export function coverageIn(/** @type {string[]} */ dirs) {
  /** @type {Coverage} */
  const coverage = new Map();
  for (const dir of dirs)
    for (const f of lcovFiles(dir)) mergeLcov(readFileSync(f, 'utf8'), coverage);
  return coverage;
}
