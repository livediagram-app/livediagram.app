// Value + attribute codec for the text DSL (spec/66). The DSL keeps the common
// element fields in readable positional syntax (id / kind / label / @x,y / WxH /
// endpoints) and pushes every other field into a generic `{ key: value }`
// attribute block. This module is the single encoder/decoder for those values,
// so a new model field round-trips through the DSL with no per-field work:
//
//   - scalars (string / number / boolean / null) write as bare tokens where
//     they're unambiguous (enum words like `dashed`, `both`, numbers, bools),
//     and quoted / JSON-encoded otherwise.
//   - structured values (arrays / objects — table cells, freehand points,
//     pie slices, curve offsets, …) write as compact inline JSON.
//
// Faithful by construction: `parseAttrs(serializeAttrs(obj, consumed))` revives
// every non-consumed own field with the same value, so the round-trip is exact
// (see round-trip.test.ts). Readability stops at vector payloads — that's the
// intentional trade in spec/66 (Boundaries).

const RESERVED_WORDS = new Set(['true', 'false', 'null']);

// A token safe to write unquoted: an identifier-ish run that can't be mistaken
// for a number, boolean, or null. Enum values (`hollow-triangle`, `progress-bar`,
// `lg`, `TB`) qualify; anything with spaces / punctuation / a leading digit does
// not and gets JSON-quoted instead.
function isBareWord(s: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_-]*$/.test(s) && !RESERVED_WORDS.has(s);
}

// Quote a string the JSON way (handles escapes + newlines), used for labels and
// any string value that isn't a safe bare word.
export function quoteString(s: string): string {
  return JSON.stringify(s);
}

// Encode one attribute / setting value. Bare where unambiguous, JSON otherwise.
export function encodeValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0';
  if (typeof value === 'string') return isBareWord(value) ? value : quoteString(value);
  // Arrays + objects: compact inline JSON.
  return JSON.stringify(value);
}

// Serialize the own fields of `obj` NOT already written positionally into a
// ` { k: v, k2: v2 }` block (or '' when nothing is left). Keys are sorted so
// output is deterministic; undefined-valued fields are dropped so the text
// stays clean (they're absent on the parsed result too).
export function serializeAttrs(
  obj: Record<string, unknown>,
  consumed: ReadonlySet<string>,
): string {
  const keys = Object.keys(obj)
    .filter((k) => !consumed.has(k) && obj[k] !== undefined)
    .sort();
  if (keys.length === 0) return '';
  const parts = keys.map((k) => `${k}: ${encodeValue(obj[k])}`);
  return ` { ${parts.join(', ')} }`;
}

// --- Parsing --------------------------------------------------------------

// Decode a bare (unquoted) token to its scalar value: boolean / null / number /
// otherwise the literal string (an enum word). Module-private: only the attr
// parser below consumes it.
function decodeBareScalar(token: string): unknown {
  if (token === 'true') return true;
  if (token === 'false') return false;
  if (token === 'null') return null;
  // Match integers, decimals, and exponential form (String(n) emits `1e-7` for
  // very small / large magnitudes), so an extreme numeric attribute survives as
  // a number rather than degrading to a string.
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(token)) return Number(token);
  return token;
}

// Read one value starting at `i` in `s`, returning the decoded value and the
// index just past it. Handles JSON strings (`"…"`), balanced JSON arrays /
// objects (`[…]` / `{…}`, quote-aware so braces inside strings don't fool the
// balance count), and bare scalar tokens (terminated by `,` or `}`). Throws on
// malformed JSON so the caller can surface a parse error.
function readValue(s: string, i: number): { value: unknown; next: number } {
  while (i < s.length && /\s/.test(s[i]!)) i++;
  const ch = s[i];
  if (ch === '"') {
    const end = scanJsonString(s, i);
    return { value: JSON.parse(s.slice(i, end)), next: end };
  }
  if (ch === '[' || ch === '{') {
    const end = scanBalanced(s, i);
    return { value: JSON.parse(s.slice(i, end)), next: end };
  }
  // Bare token: up to the next top-level ',' or '}'.
  let j = i;
  while (j < s.length && s[j] !== ',' && s[j] !== '}') j++;
  const token = s.slice(i, j).trim();
  return { value: decodeBareScalar(token), next: j };
}

// Index just past a JSON string literal beginning at `start` (s[start] === '"').
function scanJsonString(s: string, start: number): number {
  let i = start + 1;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '"') return i + 1;
    i++;
  }
  throw new Error('Unterminated string literal');
}

// Index just past a balanced [...] / {...} region beginning at `start`, ignoring
// brackets that appear inside string literals.
function scanBalanced(s: string, start: number): number {
  let depth = 0;
  let i = start;
  while (i < s.length) {
    const c = s[i];
    if (c === '"') {
      i = scanJsonString(s, i);
      continue;
    }
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  throw new Error('Unbalanced brackets');
}

// Split a statement line into its leading text and a trailing `{ … }`
// attribute block. The first top-level `{` (one not inside a quoted label)
// begins the block; everything before it is the `head` the caller parses
// positionally. Returns an empty record when there's no block.
export function splitTrailingAttrs(line: string): {
  head: string;
  attrs: Record<string, unknown>;
} {
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === '"') {
      i = scanJsonString(line, i);
      continue;
    }
    if (c === '{') break;
    i++;
  }
  if (i >= line.length) return { head: line.trim(), attrs: {} };
  const close = scanBalanced(line, i);
  const inner = line.slice(i + 1, close - 1);
  const head = (line.slice(0, i) + line.slice(close)).trim();
  return { head, attrs: parseAttrs(inner) };
}

// Parse the inside of an attribute block (the text between `{` and `}`) into a
// plain record. Tolerant of trailing commas + arbitrary whitespace. Throws on a
// missing colon or malformed value so the parser can report a clear error.
export function parseAttrs(inner: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let i = 0;
  while (i < inner.length) {
    while (i < inner.length && (/\s/.test(inner[i]!) || inner[i] === ',')) i++;
    if (i >= inner.length) break;
    const keyMatch = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(inner.slice(i));
    if (!keyMatch) throw new Error(`Expected an attribute name near "${inner.slice(i, i + 16)}"`);
    const key = keyMatch[0];
    i += key.length;
    while (i < inner.length && /\s/.test(inner[i]!)) i++;
    if (inner[i] !== ':') throw new Error(`Expected ':' after attribute "${key}"`);
    i++;
    const { value, next } = readValue(inner, i);
    out[key] = value;
    i = next;
  }
  return out;
}
