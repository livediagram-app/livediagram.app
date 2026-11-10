// The file size guard (docs/ci.md "File size"): no hand-written source file may grow past 800 lines. A
// file that size holds several concerns, and the repository's rule is to split on cohesion (no god
// files). The files over the limit today are listed in file-size-baseline.txt, one path per line: flat
// data (tables, catalogues, registries of strings), which is exempt, and the real code still waiting for
// its split. That list may only shrink: the guard fails when a file not on it passes the limit (a new file
// or one that grew), and when a listed file is gone or back under the limit, so the list stays tight.
// `--update` rewrites it after a shrink, and refuses to add anything.
//
//   node .github/scripts/file-size-guard.mjs            check
//   node .github/scripts/file-size-guard.mjs --update   shrink the baseline to what is left
//
// It takes the tracked files from the index (`git ls-files`) and counts each candidate's lines: about
// 1.2 s of CPU time on the whole repository, most of it reading the files.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BASELINE = '.github/scripts/file-size-baseline.txt';
export const LIMIT = 800;

const SOURCE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)__tests__\//;
// Declaration files and generated code: written by a tool, never split by hand.
const GENERATED =
  /\.d\.[cm]?ts$|(?:^|\/)(?:generated|\.generated)\/|\.generated\.[cm]?[jt]sx?$|(?:^|\/)node_modules\//;

/**
 * Whether a tracked path is a hand-written, non-test source file.
 * @param {string} file
 */
export function isCandidate(file) {
  return SOURCE.test(file) && !TEST.test(file) && !GENERATED.test(file);
}

/**
 * A file's line count, as `wc -l` gives it plus a last line with no newline.
 * @param {string} text
 */
export function countLines(text) {
  if (!text) return 0;
  let lines = 0;
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) lines++;
  return text.endsWith('\n') ? lines : lines + 1;
}

/**
 * The candidate files over the limit, with their line counts, sorted by path.
 * @param {string[]} files tracked paths
 * @param {(file: string) => string | null} read a file's text, or null when it is not on disk
 * @returns {{ file: string, lines: number }[]}
 */
export function findOversized(files, read) {
  const over = [];
  for (const file of files) {
    if (!isCandidate(file)) continue;
    const text = read(file);
    if (text === null || text.length <= LIMIT) continue; // under LIMIT characters can't hold LIMIT lines
    const lines = countLines(text);
    if (lines > LIMIT) over.push({ file, lines });
  }
  return over.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

/**
 * The baseline file's paths, one per line; `#` starts a comment line.
 * @param {string} text
 * @returns {string[]}
 */
export function parseBaseline(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

/** @param {string[]} files */
export function formatBaseline(files) {
  return (
    `# Source files over ${LIMIT} lines allowed to stay that way, one path per line: flat data (exempt)\n` +
    '# and real code still waiting for its split. Written by .github/scripts/file-size-guard.mjs --update;\n' +
    '# it may only shrink (docs/ci.md "File size").\n' +
    [...files].sort().join('\n') +
    '\n'
  );
}

/**
 * What differs between today's oversized files and the baseline.
 * @param {{ file: string, lines: number }[]} current
 * @param {string[]} baseline
 * @returns {{ added: { file: string, lines: number }[], stale: string[] }}
 */
export function compare(current, baseline) {
  const listed = new Set(baseline);
  const over = new Set(current.map((c) => c.file));
  return {
    added: current.filter((c) => !listed.has(c.file)),
    stale: baseline.filter((file) => !over.has(file)),
  };
}

/**
 * The failure message, or null when the tree matches the baseline.
 * @param {ReturnType<typeof compare>} diff
 */
export function report({ added, stale }) {
  const lines = [];
  if (added.length) {
    lines.push(
      `Source files over ${LIMIT} lines. Split each into cohesive modules (no god files; docs/ci.md`,
      '"File size"), keeping the file as the entry that re-exports them so no importer changes:',
    );
    for (const { file, lines: n } of added) lines.push(`  ${file} (${n} lines)`);
  }
  if (stale.length) {
    if (lines.length) lines.push('');
    lines.push(
      `${stale.length} baseline file(s) are now ${LIMIT} lines or under, or gone, so the baseline is looser`,
      `than the tree. Run with --update to shrink the baseline (${BASELINE}):`,
    );
    for (const file of stale.slice(0, 20)) lines.push(`  ${file}`);
    if (stale.length > 20) lines.push(`  … and ${stale.length - 20} more`);
  }
  return lines.length ? lines.join('\n') : null;
}

function main() {
  const started = performance.now();
  const files = execFileSync('git', ['ls-files', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  })
    .split('\0')
    .filter(Boolean);
  const current = findOversized(files, (file) => {
    try {
      return readFileSync(path.join(ROOT, file), 'utf8');
    } catch {
      return null; // deleted in the working tree but not yet from the index
    }
  });
  let baselineText = '';
  try {
    baselineText = readFileSync(path.join(ROOT, BASELINE), 'utf8');
  } catch {
    // No baseline yet: every oversized file is new.
  }
  const baseline = parseBaseline(baselineText);
  const diff = compare(current, baseline);
  const took = `${Math.round(performance.now() - started)} ms`;
  if (process.argv.includes('--update')) {
    // The first run writes the baseline; after that it only shrinks.
    if (baselineText && diff.added.length) {
      console.error(report({ ...diff, stale: [] }));
      console.error('\n--update only shrinks the baseline; split the files instead.');
      return 1;
    }
    writeFileSync(path.join(ROOT, BASELINE), formatBaseline(current.map((c) => c.file)));
    console.log(
      `[file-size-guard] baseline: ${baseline.length} -> ${current.length} files (${took})`,
    );
    return 0;
  }
  const failure = report(diff);
  if (failure) {
    console.error(failure);
    return 1;
  }
  console.log(
    `[file-size-guard] ${current.length} known files over ${LIMIT} lines, no new ones (${took})`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
