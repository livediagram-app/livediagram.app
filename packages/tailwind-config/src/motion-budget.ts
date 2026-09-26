// The static motion-budget guard (docs/specs/004-interface-design/motion.md,
// blueprint: docs/specs/004-interface-design/blueprints/motion.md).
//
// Reads chrome stylesheets and component sources and computes an UPPER BOUND for
// every duration and delay it finds. Anything it cannot bound is reported rather
// than assumed small, so the guard can only ever err towards failing.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  MOTION_CASCADE_CAP_MS,
  MOTION_CASCADE_STEP_MS,
  MOTION_CEILING_MS,
  MOTION_HOVER_CEILING_MS,
  MOTION_MS,
} from './motion';

export type TokenMap = ReadonlyMap<string, number>;

export type MotionViolation = {
  file: string;
  line: number;
  rule: 'ceiling' | 'hover-ceiling' | 'unbounded' | 'token-drift';
  found: string;
  limit: number;
};

/** Every CSS variable whose value the guard trusts, in milliseconds. */
export const MOTION_TOKENS: TokenMap = new Map([
  ['--transition-duration-micro', MOTION_MS.micro],
  ['--transition-duration-short', MOTION_MS.short],
  ['--transition-duration-long', MOTION_MS.long],
  ['--default-transition-duration', MOTION_MS.micro],
  ['--motion-cascade-step', MOTION_CASCADE_STEP_MS],
  ['--motion-cascade-cap', MOTION_CASCADE_CAP_MS],
]);

const TIME = /^(\d*\.?\d+)(ms|s)$/;
const TEMPLATE_TOKEN = /^\$\{MOTION_MS\.(micro|short|long)\}ms$/;
const NON_TIME_FUNCTIONS = /^(cubic-bezier|steps|linear)\(/;
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.next-dev',
  'out',
  'coverage',
  'e2e',
  '.turbo',
  'dist',
]);

// ---------------------------------------------------------------- values

/** Split on a separator that sits outside parentheses and quotes. */
function splitTopLevel(text: string, separator: ',' | ' '): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '(' || ch === '{') {
      depth++;
    } else if (ch === ')' || ch === '}') {
      depth--;
    } else if (depth === 0 && (separator === ' ' ? /\s/.test(ch) : ch === separator)) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** The inside of `name(...)` when `text` is exactly one such call. */
function callArgs(text: string, name: string): string | null {
  if (!text.startsWith(`${name}(`) || !text.endsWith(')')) return null;
  return text.slice(name.length + 1, -1);
}

/** The largest value `value` can take, in ms; `Infinity` when it cannot be bounded. */
export function durationBoundMs(value: string, tokens: TokenMap): number {
  const v = value.replace(/!important/g, '').trim();
  if (!v) return Infinity;
  // A scroll-driven animation's `auto` duration fills its scroll range; it is not time.
  if (v === 'auto') return 0;

  const literal = TIME.exec(v);
  if (literal) return Number(literal[1]) * (literal[2] === 's' ? 1000 : 1);

  const template = TEMPLATE_TOKEN.exec(v);
  if (template) return tokens.get(`--transition-duration-${template[1]}`) ?? Infinity;

  const varArgs = callArgs(v, 'var');
  if (varArgs !== null) {
    const name = splitTopLevel(varArgs, ',')[0] ?? '';
    return tokens.get(name) ?? Infinity;
  }

  const minArgs = callArgs(v, 'min');
  if (minArgs !== null) {
    const bounds = splitTopLevel(minArgs, ',').map((a) => durationBoundMs(a, tokens));
    return bounds.length ? Math.min(...bounds) : Infinity;
  }

  const maxArgs = callArgs(v, 'max');
  if (maxArgs !== null) {
    const bounds = splitTopLevel(maxArgs, ',').map((a) => durationBoundMs(a, tokens));
    return bounds.length ? Math.max(...bounds) : Infinity;
  }

  const calcArgs = callArgs(v, 'calc');
  if (calcArgs !== null) {
    return /[*/]|\s[+-]\s/.test(calcArgs) ? Infinity : durationBoundMs(calcArgs, tokens);
  }

  return Infinity;
}

function isTimeLike(token: string): boolean {
  if (TIME.test(token) || token.startsWith('${')) return true;
  return /^[a-z-]+\(/.test(token) && !NON_TIME_FUNCTIONS.test(token);
}

type Shorthand = { bound: number; ambient: boolean };

/** Each comma-separated part of a `transition` / `animation` shorthand, bounded. */
function shorthandParts(value: string, kind: 'transition' | 'animation', tokens: TokenMap) {
  return splitTopLevel(value.replace(/!important/g, ''), ',').map((part): Shorthand => {
    const words = splitTopLevel(part, ' ');
    const times = words.filter(isTimeLike);
    const ambient =
      kind === 'animation' &&
      words.some((w) => w === 'infinite' || (/^\d+$/.test(w) && Number(w) >= 2));
    const [duration, delay] = times;
    const bound =
      (duration === undefined ? 0 : durationBoundMs(duration, tokens)) +
      (delay === undefined ? 0 : durationBoundMs(delay, tokens));
    return { bound, ambient };
  });
}

function listBound(value: string, tokens: TokenMap): number {
  const bounds = splitTopLevel(value, ',').map((v) => durationBoundMs(v, tokens));
  return bounds.length ? Math.max(...bounds) : 0;
}

type Check = { bound: number; limit: number; drift?: boolean };

/** How one declaration is bounded, or null when it isn't motion. */
function checkDeclaration(
  prop: string,
  value: string,
  hover: boolean,
  tokens: TokenMap,
): Check | null {
  const ceiling = hover ? MOTION_HOVER_CEILING_MS : MOTION_CEILING_MS;
  const shorthand = (kind: 'transition' | 'animation'): Check => {
    const parts = shorthandParts(value, kind, tokens).filter((p) => !p.ambient);
    return { bound: parts.length ? Math.max(...parts.map((p) => p.bound)) : 0, limit: ceiling };
  };

  if (prop === 'transition') return shorthand('transition');
  if (prop === 'animation' || prop.startsWith('--animate-')) return shorthand('animation');
  if (prop === 'transition-duration' || prop === 'animation-duration') {
    return { bound: listBound(value, tokens), limit: ceiling };
  }
  if (prop === 'transition-delay' || prop === 'animation-delay') {
    return { bound: listBound(value, tokens), limit: MOTION_CASCADE_CAP_MS };
  }
  if (prop.startsWith('--transition-duration-') || prop.startsWith('--motion-')) {
    const bound = durationBoundMs(value, tokens);
    const expected = tokens.get(prop);
    return {
      bound,
      limit: MOTION_CEILING_MS,
      drift: expected !== undefined && bound !== expected,
    };
  }
  if (prop === '--default-transition-duration') {
    const bound = durationBoundMs(value, tokens);
    return { bound, limit: MOTION_CEILING_MS, drift: bound !== tokens.get(prop) };
  }
  return null;
}

function violationFor(
  check: Check,
  hover: boolean,
  file: string,
  line: number,
  found: string,
): MotionViolation | null {
  const trimmed = found.replace(/\s+/g, ' ').trim().slice(0, 120);
  if (check.bound === Infinity) {
    return { file, line, rule: 'unbounded', found: trimmed, limit: check.limit };
  }
  if (check.bound > check.limit) {
    const rule = hover && check.limit === MOTION_HOVER_CEILING_MS ? 'hover-ceiling' : 'ceiling';
    return { file, line, rule, found: trimmed, limit: check.limit };
  }
  if (check.drift) return { file, line, rule: 'token-drift', found: trimmed, limit: check.limit };
  return null;
}

// ----------------------------------------------------------- stylesheets

/**
 * Blank every block comment with spaces of the same shape, so indices and lines survive.
 * One linear pass: an unterminated comment runs to the end of the text, as CSS reads it.
 */
function blankBlockComments(text: string): string {
  let out = '';
  let from = 0;
  for (;;) {
    const open = text.indexOf('/*', from);
    if (open === -1) return out + text.slice(from);
    const close = text.indexOf('*/', open + 2);
    const end = close === -1 ? text.length : close + 2;
    out += text.slice(from, open) + text.slice(open, end).replace(/[^\n]/g, ' ');
    from = end;
  }
}

type Declaration = { selector: string; prop: string; value: string; index: number };

/** Walk a stylesheet into declarations, each with the selector of its rule. */
function declarations(css: string): { decls: Declaration[]; selectors: string[] } {
  const decls: Declaration[] = [];
  const selectors: string[] = [];

  const walk = (start: number, end: number, selector: string): void => {
    let i = start;
    let segmentStart = start;
    let quote: string | null = null;
    let parens = 0;
    while (i < end) {
      const ch = css[i];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '(') {
        parens++;
      } else if (ch === ')') {
        parens--;
      } else if (parens === 0 && ch === '{') {
        const prelude = css.slice(segmentStart, i).trim();
        const close = matchingBrace(css, i);
        if (!/^@(-webkit-)?keyframes\b/.test(prelude)) {
          let inner = selector;
          if (prelude.startsWith('@theme')) inner = '@theme';
          else if (!prelude.startsWith('@')) {
            inner = prelude;
            selectors.push(...splitTopLevel(prelude, ','));
          }
          walk(i + 1, close, inner);
        }
        i = close + 1;
        segmentStart = i;
        continue;
      } else if (parens === 0 && ch === ';') {
        pushDeclaration(segmentStart, i, selector);
        segmentStart = i + 1;
      }
      i++;
    }
    pushDeclaration(segmentStart, end, selector);
  };

  const pushDeclaration = (from: number, to: number, selector: string): void => {
    const raw = css.slice(from, to);
    const colon = raw.indexOf(':');
    if (colon < 0 || raw.trim().startsWith('@')) return;
    const prop = raw.slice(0, colon).trim().toLowerCase();
    if (!/^(--)?[a-z][a-z0-9-]*$/.test(prop)) return;
    const offset = raw.length - raw.trimStart().length;
    decls.push({ selector, prop, value: raw.slice(colon + 1).trim(), index: from + offset });
  };

  walk(0, css.length, '');
  return { decls, selectors };
}

function matchingBrace(css: string, open: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < css.length; i++) {
    const ch = css[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return css.length;
}

const INTERACTION = /:(hover|focus-visible|focus-within|focus)\b/;

function withoutInteraction(selector: string): string {
  return selector
    .replace(/:not\((?:[^()]|\([^()]*\))*\)/g, '')
    .replace(/:(hover|focus-visible|focus-within|focus)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lineAt(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === '\n') line++;
  return line;
}

/** Every motion violation in one stylesheet. */
export function scanStylesheet(text: string, file: string, tokens: TokenMap): MotionViolation[] {
  const css = blankBlockComments(text);
  const { decls, selectors } = declarations(css);
  const hoverBases = new Set(
    selectors.filter((s) => INTERACTION.test(s)).map((s) => withoutInteraction(s)),
  );
  const isHover = (selector: string) =>
    splitTopLevel(selector, ',').some(
      (s) => !INTERACTION.test(s) && hoverBases.has(withoutInteraction(s)),
    );

  const out: MotionViolation[] = [];
  for (const d of decls) {
    const hover = isHover(d.selector);
    const check = checkDeclaration(d.prop, d.value, hover, tokens);
    if (!check) continue;
    const v = violationFor(check, hover, file, lineAt(css, d.index), `${d.prop}: ${d.value}`);
    if (v) out.push(v);
  }
  return out;
}

// --------------------------------------------------------------- sources

/** Blank out comments in TS/TSX, leaving `//` inside URLs (`https://`) alone. */
function blankSourceComments(src: string): string {
  return blankBlockComments(src).replace(
    /(^|[\s;{}(),])\/\/[^\n]*/g,
    (c, lead: string) => lead + ' '.repeat(c.length - 1),
  );
}

/** The string literal around `index`: from the nearest quote before it to its match after. */
function literalAround(src: string, index: number, end: number): string {
  let open = index - 1;
  while (open >= 0 && !`"'\``.includes(src[open] ?? '')) open--;
  if (open < 0) return src.slice(index, end);
  const quote = src[open] ?? '"';
  const close = src.indexOf(quote, end);
  return src.slice(open + 1, close < 0 ? src.length : close);
}

const CLASS =
  /(?<![\w-])((?:[\w-]+:)*)(duration|delay)-(\d+|micro|short|long|\[[^\]\s]+\])(?![\w-])/g;
const INLINE =
  /\b(transition|transitionDuration|transitionDelay)\s*[:=]\s*(['"`])((?:(?!\2)[^\\]|\\.)*)\2/g;
const HOVER_CLASS = /(?<![\w-])(group-hover|peer-hover|hover|focus|focus-visible|focus-within):/;

function classBound(value: string, tokens: TokenMap): number {
  if (/^\d+$/.test(value)) return Number(value);
  if (value.startsWith('[')) return durationBoundMs(value.slice(1, -1), tokens);
  return tokens.get(`--transition-duration-${value}`) ?? Infinity;
}

/** Every motion violation in one TS / TSX source. */
export function scanSource(text: string, file: string, tokens: TokenMap): MotionViolation[] {
  const src = blankSourceComments(text);
  const out: MotionViolation[] = [];

  for (const m of src.matchAll(CLASS)) {
    const index = m.index ?? 0;
    const [token, , kind, value = ''] = m;
    const hover =
      kind === 'duration' && HOVER_CLASS.test(literalAround(src, index, index + token.length));
    const limit =
      kind === 'delay'
        ? MOTION_CASCADE_CAP_MS
        : hover
          ? MOTION_HOVER_CEILING_MS
          : MOTION_CEILING_MS;
    const v = violationFor(
      { bound: classBound(value, tokens), limit },
      hover,
      file,
      lineAt(src, index),
      token,
    );
    if (v) out.push(v);
  }

  for (const m of src.matchAll(INLINE)) {
    const [whole, prop = '', , value = ''] = m;
    if (!/\d|\$\{/.test(value)) continue;
    const check: Check =
      prop === 'transition'
        ? checkDeclaration('transition', value, false, tokens)!
        : prop === 'transitionDelay'
          ? { bound: listBound(value, tokens), limit: MOTION_CASCADE_CAP_MS }
          : { bound: listBound(value, tokens), limit: MOTION_CEILING_MS };
    const v = violationFor(check, false, file, lineAt(src, m.index ?? 0), whole);
    if (v) out.push(v);
  }

  return out.sort((a, b) => a.line - b.line);
}

// ------------------------------------------------------------- workspace

function walkFiles(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkFiles(full, out);
    else if (/\.(css|tsx?)$/.test(name) && !/\.(test|spec)\.|\.d\.ts$/.test(name)) out.push(full);
  }
}

/** Every motion violation under `root`, sorted by file then line. */
export function checkMotionBudget(options: {
  root: string;
  canvasStylesheets?: string[];
}): MotionViolation[] {
  const canvas = new Set(options.canvasStylesheets ?? []);
  const files: string[] = [];
  walkFiles(options.root, files);
  const rel = (f: string) => relative(options.root, f).split(sep).join('/');
  const present = new Set(files.map(rel));

  const out: MotionViolation[] = [];
  for (const path of canvas) {
    if (!present.has(path)) {
      out.push({
        file: path,
        line: 0,
        rule: 'unbounded',
        found: 'classified canvas stylesheet is missing',
        limit: 0,
      });
    }
  }
  for (const full of files) {
    const path = rel(full);
    if (canvas.has(path)) continue;
    const text = readFileSync(full, 'utf8');
    out.push(
      ...(path.endsWith('.css')
        ? scanStylesheet(text, path, MOTION_TOKENS)
        : scanSource(text, path, MOTION_TOKENS)),
    );
  }
  return out.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

/** One `motion-budget:` line per violation. */
export function formatViolations(violations: MotionViolation[]): string {
  return violations
    .map((v) => `motion-budget: ${v.file}:${v.line} ${v.rule} ${v.found} (> ${v.limit}ms)`)
    .join('\n');
}
