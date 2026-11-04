// The drift report (docs/ci.md "Drift report"): how far livehuddle's copy of livediagram has moved from it.
//
// livehuddle was forked in-tree from livediagram (livehuddle/.forked-from) and both still carry Workshop
// mode. This compares the two product folders file by file, with the product names ignored (livediagram and
// livehuddle, in any case, in paths and in contents, read as the same word), and counts the files that are
// identical, changed, or in one product only, per app and package, in the shape of docs/structure.md's
// liveplanner table. The owner reads it to see the copies diverge and pick the next extraction to
// `packages/` (livehuddle's build plan, "Keeping the two products from drifting").
//
//   node .github/scripts/drift-report.mjs
//
// It informs and never gates: it always exits 0, and CI's Plan job runs it with continue-on-error. It
// prints the report, and appends it to $GITHUB_STEP_SUMMARY when that is set. It reads only the files git
// tracks, once each, so its time grows with the two folders' size (about 11,000 files, under a second).

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

export const LEFT = 'livediagram';
export const RIGHT = 'livehuddle';

// Either product's name in any case (livediagram, LiveDiagram, LIVEHUDDLE, Livehuddle), as one word.
const PRODUCT_NAME = /live(?:diagram|huddle)/gi;
const NEUTRAL = 'liveproduct';

/**
 * A path or text with either product's name replaced by one neutral word, keeping its case shape so
 * `LiveDiagram` and `LiveHuddle` still match each other and not `livediagram`.
 * @param {string} text
 * @returns {string}
 */
export function normaliseNames(text) {
  return text.replace(PRODUCT_NAME, (name) => {
    if (name === name.toUpperCase()) return NEUTRAL.toUpperCase();
    if (name === name.toLowerCase()) return NEUTRAL;
    // Mixed: LiveDiagram / Livediagram keep the shape of their first five letters.
    return name.slice(0, 4) + (name[4] === name[4].toUpperCase() ? 'Product' : 'product');
  });
}

/**
 * Whether a file's bytes are text: no NUL byte in its first 8 KiB, as git decides.
 * @param {Buffer} bytes
 */
export function isText(bytes) {
  return !bytes.subarray(0, 8192).includes(0);
}

/**
 * A file's content as compared: text with the product names normalised, other files byte for byte.
 * @param {Buffer} bytes
 * @returns {string}
 */
export function comparable(bytes) {
  return isText(bytes) ? normaliseNames(bytes.toString('utf8')) : bytes.toString('base64');
}

/**
 * The row a product-relative path counts in: each app and package on its own, then `docs/specs`, the
 * rest of `docs`, and everything else as `(other)`.
 * @param {string} path relative to the product folder
 */
export function areaOf(path) {
  const parts = path.split('/');
  if ((parts[0] === 'apps' || parts[0] === 'packages') && parts.length > 2)
    return `${parts[0]}/${parts[1]}`;
  if (parts[0] === 'docs') return parts[1] === 'specs' && parts.length > 2 ? 'docs/specs' : 'docs';
  return '(other)';
}

/**
 * Compares two products' files. Each side maps a normalised product-relative path to its comparable
 * content (or to a function that reads it, so a file in one product only is never read).
 * @param {Map<string, string | (() => string)>} left
 * @param {Map<string, string | (() => string)>} right
 * @returns {Map<string, {identical: number, changed: number, leftOnly: number, rightOnly: number}>}
 */
export function compareTrees(left, right) {
  /** @type {Map<string, {identical: number, changed: number, leftOnly: number, rightOnly: number}>} */
  const rows = new Map();
  const row = (path) => {
    const area = areaOf(path);
    let r = rows.get(area);
    if (!r) rows.set(area, (r = { identical: 0, changed: 0, leftOnly: 0, rightOnly: 0 }));
    return r;
  };
  const read = (v) => (typeof v === 'function' ? v() : v);
  for (const [path, content] of left) {
    if (!right.has(path)) {
      row(path).leftOnly += 1;
      continue;
    }
    if (read(content) === read(right.get(path))) row(path).identical += 1;
    else row(path).changed += 1;
  }
  for (const path of right.keys()) if (!left.has(path)) row(path).rightOnly += 1;
  return rows;
}

const fmt = (n) => n.toLocaleString('en-US');

/**
 * The report as Markdown: one row per area that holds files in both products (sorted by how many
 * files changed), then one row each for the areas in one product only, then the totals.
 * @param {ReturnType<typeof compareTrees>} rows
 * @param {{ forkedFrom?: string }} [meta]
 * @returns {string}
 */
export function renderReport(rows, meta = {}) {
  const both = [];
  const leftOnly = [];
  const rightOnly = [];
  const total = { identical: 0, changed: 0, leftOnly: 0, rightOnly: 0 };
  for (const [area, r] of rows) {
    for (const k of Object.keys(total)) total[k] += r[k];
    if (r.identical + r.changed > 0) both.push([area, r]);
    else if (r.leftOnly > 0 && r.rightOnly === 0) leftOnly.push(area);
    else if (r.rightOnly > 0 && r.leftOnly === 0) rightOnly.push(area);
    else both.push([area, r]);
  }
  both.sort((a, b) => b[1].changed - a[1].changed || a[0].localeCompare(b[0]));
  const lines = [
    `## Drift report: ${LEFT} and ${RIGHT}`,
    '',
    `Files compared with the product names ignored${meta.forkedFrom ? ` (${RIGHT} forked from ${meta.forkedFrom})` : ''}. ` +
      'Information only: this never fails a build.',
    '',
    `| | identical | changed | only in ${LEFT} | only in ${RIGHT} |`,
    '| --- | ---: | ---: | ---: | ---: |',
  ];
  for (const [area, r] of both) {
    lines.push(
      `| \`${area}\` | ${fmt(r.identical)} | ${fmt(r.changed)} | ${fmt(r.leftOnly)} | ${fmt(r.rightOnly)} |`,
    );
  }
  const sumOf = (areas, key) => areas.reduce((n, a) => n + rows.get(a)[key], 0);
  if (leftOnly.length > 0) {
    lines.push(
      `| ${LEFT} only: ${leftOnly
        .sort()
        .map((a) => `\`${a}\``)
        .join(', ')} | 0 | 0 | ${fmt(sumOf(leftOnly, 'leftOnly'))} | 0 |`,
    );
  }
  if (rightOnly.length > 0) {
    lines.push(
      `| ${RIGHT} only: ${rightOnly
        .sort()
        .map((a) => `\`${a}\``)
        .join(', ')} | 0 | 0 | 0 | ${fmt(sumOf(rightOnly, 'rightOnly'))} |`,
    );
  }
  lines.push(
    `| **Total** | **${fmt(total.identical)}** | **${fmt(total.changed)}** | **${fmt(total.leftOnly)}** | **${fmt(total.rightOnly)}** |`,
  );
  return `${lines.join('\n')}\n`;
}

/**
 * A product's tracked files, keyed by normalised product-relative path, each read only when compared.
 * @param {string} product
 * @param {string} cwd
 */
function trackedFiles(product, cwd) {
  const out = execFileSync('git', ['ls-files', '-z', '--', `${product}/`], {
    cwd,
    maxBuffer: 64 * 1024 * 1024,
  });
  /** @type {Map<string, () => string>} */
  const files = new Map();
  for (const path of out.toString('utf8').split('\0')) {
    if (!path) continue;
    const rel = path.slice(product.length + 1);
    files.set(normaliseNames(rel), () => {
      try {
        return comparable(readFileSync(`${cwd}/${path}`));
      } catch {
        // Tracked but missing from the working tree (a sparse checkout): counts as changed.
        return `\0missing:${path}`;
      }
    });
  }
  return files;
}

function main() {
  try {
    const cwd = execFileSync('git', ['rev-parse', '--show-toplevel']).toString().trim();
    const started = process.hrtime.bigint();
    const rows = compareTrees(trackedFiles(LEFT, cwd), trackedFiles(RIGHT, cwd));
    let forkedFrom;
    try {
      forkedFrom = readFileSync(`${cwd}/${RIGHT}/.forked-from`, 'utf8')
        .trim()
        .replace(/^.* at /, '');
    } catch {
      forkedFrom = undefined;
    }
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const report = renderReport(rows, { forkedFrom });
    console.log(report);
    console.log(`[drift-report] compared in ${Math.round(ms)} ms`);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
  } catch (error) {
    // Information only: a failure says so and leaves the build alone.
    console.log(
      `[drift-report] could not compare: ${error instanceof Error ? error.message : error}`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
