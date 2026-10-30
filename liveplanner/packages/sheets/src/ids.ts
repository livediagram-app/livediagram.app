// Sheet ids and row and column ids (docs/specs/029-sheets/sheet-store.md "Rows and columns by id"). Ids are made
// by the client so a write can name the rows it inserts before the server has seen them; a collision is refused
// by validation, never resolved silently.

export const SHEET_ID_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;
export const AXIS_ID_PATTERN = /^[a-z0-9]{4,12}$/;

const SHEET_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const AXIS_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SHEET_ID_LENGTH = 12;
const AXIS_ID_LENGTH = 6;

// A source of random numbers in [0, 1); tests pass a seeded one.
export type Rand = () => number;

function randomString(alphabet: string, length: number, rand: Rand): string {
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(rand() * alphabet.length)];
  return out;
}

export function makeSheetId(rand: Rand = Math.random): string {
  return randomString(SHEET_ID_ALPHABET, SHEET_ID_LENGTH, rand);
}

// `n` new axis ids, distinct from each other and from `taken`.
export function makeAxisIds(
  n: number,
  rand: Rand = Math.random,
  taken: ReadonlySet<string> = new Set(),
): string[] {
  const out: string[] = [];
  const seen = new Set(taken);
  while (out.length < n) {
    const id = randomString(AXIS_ALPHABET, AXIS_ID_LENGTH, rand);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function isSheetId(value: unknown): value is string {
  return typeof value === 'string' && SHEET_ID_PATTERN.test(value);
}

export function isAxisId(value: unknown): value is string {
  return typeof value === 'string' && AXIS_ID_PATTERN.test(value);
}
