// The copies guard (docs/ci.md "Copies across products"): no NEW source file may be byte-identical in two
// or more product folders. The five products were forked from one another and still hold such copies; each
// one is a module that belongs in packages/ as @liveworkspace/* (docs/structure.md "Getting there, safest
// first"). The copies that exist today are listed in duplicate-baseline.txt, one group per line, and that
// list may only shrink: the guard fails when a group appears that the baseline does not hold, when a
// baseline group gains a copy, and when a baseline group is gone or has lost a copy (moved to packages/,
// changed in one product, deleted), so the list stays tight. `--update` rewrites it after a shrink, and
// refuses to add anything.
//
//   node .github/scripts/duplicate-guard.mjs            check
//   node .github/scripts/duplicate-guard.mjs --update   shrink the baseline to what is left
//
// It reads blob hashes from the index (`git ls-files -s`), so it never reads a file to compare it; it
// opens one copy of each identical group only, to leave out a pure re-export binding. Under a second on
// the whole repository (about 0.1 s).

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BASELINE = '.github/scripts/duplicate-baseline.txt';
export const PRODUCTS = ['livedesign', 'livediagram', 'livedocuments', 'livehuddle', 'liveplanner'];

const SOURCE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)__tests__\//;
// Generated: a framework's or wrangler's declaration files and anything under a generated folder.
const GENERATED =
  /(?:^|\/)(?:next-env\.d\.ts|worker-configuration\.d\.ts)$|(?:^|\/)(?:generated|\.generated)\/|\.generated\.[cm]?[jt]sx?$/;

// A workspace's own tool config (`oxlint.config.ts`, `vitest.config.ts`, `next.config.ts`, …): a few lines over
// a shared config package (@liveworkspace/oxlint-config, vitest-config, next-config) that every new package
// carries, so it is the end state rather than a copy.
const TOOL_CONFIG = /(?:^|\/)[\w-]+\.config\.[cm]?[jt]s$/;

/**
 * Whether a path is a hand-written, non-test source file inside one of the products.
 * @param {string} file
 */
export function isCandidate(file) {
  const product = file.split('/')[0];
  return (
    PRODUCTS.includes(product) &&
    SOURCE.test(file) &&
    !TEST.test(file) &&
    !GENERATED.test(file) &&
    !TOOL_CONFIG.test(file)
  );
}

/**
 * Whether a file's only statements re-export @liveworkspace/* (a product's thin binding of a shared module),
 * comments and blank lines aside. Such a file is the end state of a move, not a copy.
 * @param {string} text
 */
export function isReexportBinding(text) {
  const code = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*['"]use (?:client|server)['"];?\s*$/gm, '')
    .trim();
  if (!code) return false;
  const statements = code
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  return statements.every((s) =>
    /^export\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s+from\s+['"]@liveworkspace\/[^'"]+['"]$/.test(
      s,
    ),
  );
}

/** The value names an import clause binds (`a`, `{ b, c as d }`, `* as e`), type-only names left out. */
function importedNames(/** @type {string} */ clause) {
  if (/^type\s/.test(clause)) return [];
  const names = [];
  const braces = /\{([^}]*)\}/.exec(clause);
  for (const part of braces ? braces[1].split(',') : []) {
    const name = part.trim();
    if (name && !/^type\s/.test(name))
      names.push(
        name
          .split(/\s+as\s+/)
          .pop()
          ?.trim() ?? '',
      );
  }
  const outside = clause.replace(/\{[^}]*\}/, '');
  for (const m of outside.matchAll(/(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)/g)) names.push(m[1]);
  return names.filter(Boolean);
}

/** A file's top-level statements: split at `;` outside brackets, and after a closing `}` at depth 0. */
function topLevelStatements(/** @type {string} */ code) {
  const statements = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    const blockEnd = c === '}' && depth === 0 && /^\s*\n/.test(code.slice(i + 1));
    if ((c === ';' && depth === 0) || blockEnd) {
      statements.push(code.slice(start, c === ';' ? i : i + 1).trim());
      start = i + 1;
    }
  }
  statements.push(code.slice(start).trim());
  return statements.filter(Boolean);
}

/**
 * Whether a file only hands a product's own modules to a shared @liveworkspace/* factory, a product's
 * binding door such as `export const usePanelDock = createUsePanelDock(panelLayout)`. Its text can match in
 * two products while each binds different code, so it is the end state of a move, not a copy. Besides
 * imports, re-exports and types, every top-level statement is a call (or a name, or a `cond ? a : b` of
 * those) assigned to a `const`, a bare call, or a function whose body is one `return` of a call, each call
 * to an imported name, and at least one to a @liveworkspace/* one (or the file only names types over them). No control flow, classes, JSX, operators
 * or block bodies anywhere, so a copied data table or helper never passes.
 * @param {string} text
 */
export function isFactoryBinding(text) {
  let code = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*['"]use (?:client|server)['"];?\s*$/gm, '');
  const imported = new Set();
  const shared = new Set();
  let importsShared = false;
  code = code.replace(
    /^\s*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?/gm,
    (_, /** @type {string} */ clause, /** @type {string} */ source) => {
      if (source.startsWith('@liveworkspace/')) importsShared = true;
      for (const name of importedNames(clause)) {
        imported.add(name);
        if (source.startsWith('@liveworkspace/')) shared.add(name);
      }
      return '';
    },
  );
  if (!importsShared) return false;
  code = code
    .replace(/^\s*export\s+(?:type\s+)?(?:\*[^;]*?|\{[^}]*\})\s+from\s+['"][^'"]+['"];?/gm, '')
    .replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\$])*`/g, "''");
  for (let before = ''; before !== code;) {
    before = code;
    code = code.replace(/\{\s*return\s+((?:[^;{}]|\{[^;{}]*\})*?);?\s*\}/g, '=> ($1);');
  }
  if (
    /\b(?:if|else|for|while|do|switch|case|try|catch|throw|class|new|await|yield|let|var)\b/.test(
      code,
    )
  ) {
    return false;
  }
  if (/<\/|\/>|==|!=|&&|\|\||\+|\*|%|\s-\s|=>\s*\{/.test(code)) return false;
  /** @param {string} expr */
  const bound = (expr) => {
    const e = expr.trim();
    const ternary = /^[\w$.!]+\s*\?([\s\S]+):([\s\S]+)$/.exec(e);
    if (ternary) return bound(ternary[1]) && bound(ternary[2]);
    if (/^(?:null|undefined|[\w$]+(?:\.[\w$]+)*)$/.test(e)) return true;
    const call = /^([\w$]+)(?:\.[\w$]+)*\s*(?:<[^()]*>)?\s*\([\s\S]*\)$/.exec(e);
    if (!call || !imported.has(call[1])) return false;
    return true;
  };
  let onlyTypes = true;
  const ok = topLevelStatements(code).every((s) => {
    if (/^(?:export\s+)?(?:declare\s+)?(?:type|interface)\s/.test(s)) return true;
    onlyTypes = false;
    const declared = /^(?:export\s+)?const\s+(?:[\w$]+|\{[^}]*\})\s*(?::[^=]+)?=([\s\S]+)$/.exec(s);
    if (declared) return bound(declared[1]);
    const fn =
      /^(?:export\s+)?function\s+[\w$]+\s*(?:<[^(]*>)?\([^)]*\)[^=]*=>\s*\(([\s\S]*)\)$/.exec(s);
    if (fn) return bound(fn[1]);
    return /\)$/.test(s) && bound(s);
  });
  const callsShared = [...shared].some((name) =>
    new RegExp(
      `(?<![\\w$.])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\.[\\w$]+)*\\s*(?:<[^()]*>)?\\(`,
    ).test(code),
  );
  return ok && (callsShared || onlyTypes);
}

/**
 * The groups of identical candidate files that span two or more products, each sorted, the list sorted.
 * @param {string} lsFiles the output of `git ls-files -s`
 * @param {(file: string) => string} read a file's text, asked for one copy of each group
 * @returns {string[][]}
 */
export function findGroups(lsFiles, read) {
  /** @type {Map<string, string[]>} */
  const byBlob = new Map();
  for (const line of lsFiles.split('\n')) {
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const file = line.slice(tab + 1);
    if (!isCandidate(file)) continue;
    const blob = line.slice(0, tab).split(' ')[1];
    const files = byBlob.get(blob);
    if (files) files.push(file);
    else byBlob.set(blob, [file]);
  }
  const groups = [];
  for (const files of byBlob.values()) {
    if (new Set(files.map((f) => f.split('/')[0])).size < 2) continue;
    const text = read(files[0]);
    if (isReexportBinding(text) || isFactoryBinding(text)) continue;
    groups.push([...files].sort());
  }
  return groups.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/**
 * The baseline file's groups: one per line, the copies' paths separated by tabs.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseBaseline(text) {
  return text
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => line.split('\t').sort());
}

/** @param {string[][]} groups */
export function formatBaseline(groups) {
  return (
    '# Source files byte-identical in two or more products, one group per line (tab-separated).\n' +
    '# Written by .github/scripts/duplicate-guard.mjs --update; it may only shrink (docs/ci.md).\n' +
    groups.map((g) => g.join('\t')).join('\n') +
    '\n'
  );
}

/**
 * What differs between today's groups and the baseline.
 * @param {string[][]} current
 * @param {string[][]} baseline
 * @returns {{ added: string[][], grown: { group: string[], extra: string[] }[], stale: string[][] }}
 */
export function compare(current, baseline) {
  const key = (/** @type {string[]} */ g) => g.join('\t');
  const baselineKeys = new Set(baseline.map(key));
  const currentKeys = new Set(current.map(key));
  /** @type {Map<string, string[]>} */
  const groupOf = new Map();
  for (const g of baseline) for (const f of g) groupOf.set(f, g);
  const added = [];
  const grown = [];
  for (const g of current) {
    if (baselineKeys.has(key(g))) continue;
    const homes = new Set(g.map((f) => groupOf.get(f)).filter(Boolean));
    const [home] = homes;
    if (homes.size === 1 && home && g.every((f) => home.includes(f))) continue; // a baseline group, shrunk
    if (homes.size === 0) added.push(g);
    else grown.push({ group: g, extra: g.filter((f) => !groupOf.has(f)) });
  }
  const stale = baseline.filter((g) => !currentKeys.has(key(g)));
  return { added, grown, stale };
}

/**
 * The failure message, or null when the tree matches the baseline.
 * @param {ReturnType<typeof compare>} diff
 */
export function report({ added, grown, stale }) {
  const lines = [];
  if (added.length || grown.length) {
    lines.push(
      'New source copies across products. Code two or more products need goes in packages/ as',
      '@liveworkspace/* (AGENTS.md; docs/structure.md "Getting there, safest first"), imported from there,',
      'not copied into another product:',
    );
    for (const g of added) lines.push(`  new group:\n${g.map((f) => `    ${f}`).join('\n')}`);
    for (const { group, extra } of grown)
      lines.push(
        `  a known group gained a copy (${extra.length ? extra.join(', ') : 'merged groups'}):\n${group.map((f) => `    ${f}`).join('\n')}`,
      );
  }
  if (stale.length) {
    if (lines.length) lines.push('');
    lines.push(
      `${stale.length} baseline group(s) no longer exist as listed (moved, changed or deleted), so the baseline`,
      `is looser than the tree. Run with --update to shrink the baseline (${BASELINE}):`,
    );
    for (const g of stale.slice(0, 20)) lines.push(`  ${g.join(' ')}`);
    if (stale.length > 20) lines.push(`  … and ${stale.length - 20} more`);
  }
  return lines.length ? lines.join('\n') : null;
}

function main() {
  const started = performance.now();
  const ls = execFileSync('git', ['ls-files', '-s', '--', ...PRODUCTS], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  });
  const current = findGroups(ls, (file) => readFileSync(path.join(ROOT, file), 'utf8'));
  let baselineText = '';
  try {
    baselineText = readFileSync(path.join(ROOT, BASELINE), 'utf8');
  } catch {
    // No baseline yet: every group is new.
  }
  const baseline = parseBaseline(baselineText);
  const diff = compare(current, baseline);
  const took = `${Math.round(performance.now() - started)} ms`;
  if (process.argv.includes('--update')) {
    // The first run writes the baseline; after that it only shrinks.
    if (baselineText && (diff.added.length || diff.grown.length)) {
      console.error(report({ ...diff, stale: [] }));
      console.error(
        '\n--update only shrinks the baseline; move the new copies to packages/ instead.',
      );
      return 1;
    }
    writeFileSync(path.join(ROOT, BASELINE), formatBaseline(current));
    console.log(
      `[duplicate-guard] baseline: ${baseline.length} -> ${current.length} groups (${took})`,
    );
    return 0;
  }
  const failure = report(diff);
  if (failure) {
    console.error(failure);
    return 1;
  }
  console.log(`[duplicate-guard] ${current.length} known groups, no new copies (${took})`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
