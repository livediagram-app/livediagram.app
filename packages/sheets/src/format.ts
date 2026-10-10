// Cell formats (docs/specs/029-sheets/sheet.md "Formatting"): validation and the per-key merge every write uses,
// so two people setting different keys of one cell never overwrite each other.
import type { Border, BorderStyle, CellFormat, FontSize, NumberFormatKind } from './sheet';
import { DECIMALS_MAX } from './limits';
import { CURRENCY_SYMBOLS } from './input';

export const NUMBER_FORMATS: readonly NumberFormatKind[] = [
  'auto',
  'number',
  'percent',
  'currency',
  'accounting',
  'scientific',
  'date',
  'time',
  'datetime',
  'duration',
  'text',
];
export const FONT_SIZES: readonly FontSize[] = [
  8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 36, 48, 72,
];
// Any whole size between these is taken (typed into the toolbar's Font Size).
export const FONT_SIZE_MIN = 6;
export const FONT_SIZE_MAX = 96;
// The default a cell without a size of its own is drawn at.
export const FONT_SIZE_DEFAULT = 10;

// The next preset size up or down from `size` (Word's grow and shrink), kept within the limits.
export function stepFontSize(size: number, dir: 1 | -1): number {
  const next =
    dir > 0 ? FONT_SIZES.find((s) => s > size) : [...FONT_SIZES].reverse().find((s) => s < size);
  return next ?? (dir > 0 ? FONT_SIZE_MAX : FONT_SIZE_MIN);
}
// A font id as the editor's fonts name them (`space-grotesk`): this package knows no catalogue, so it checks the
// shape; the drawing side resolves the id, and one it no longer offers draws in the tab's font.
export const FONT_ID_RE = /^[a-z][a-z0-9-]{0,31}$/;

export const BORDER_STYLES: readonly BorderStyle[] = ['solid', 'dashed', 'dotted'];
export const FORMAT_KEYS = [
  'nf',
  'dp',
  'cur',
  'b',
  'i',
  'u',
  'st',
  'fc',
  'bg',
  'ff',
  'fs',
  'ha',
  'va',
  'wr',
  'bt',
  'br',
  'bb',
  'bl',
] as const;
export type FormatKey = (typeof FORMAT_KEYS)[number];

const COLOUR_RE = /^#[0-9a-f]{6}$/;
const FLAG_KEYS = new Set(['b', 'i', 'u', 'st']);
const BORDER_KEYS = new Set(['bt', 'br', 'bb', 'bl']);

export function isColour(v: unknown): v is string {
  return typeof v === 'string' && COLOUR_RE.test(v);
}

export function isBorder(v: unknown): v is Border {
  if (typeof v !== 'object' || v === null) return false;
  const b = v as Record<string, unknown>;
  return (
    (b.w === 1 || b.w === 2 || b.w === 3) &&
    BORDER_STYLES.includes(b.s as BorderStyle) &&
    isColour(b.c) &&
    Object.keys(b).length === 3
  );
}

// Whether one format key's value is valid.
export function validFormatValue(key: string, v: unknown): boolean {
  switch (key) {
    case 'nf':
      return NUMBER_FORMATS.includes(v as NumberFormatKind);
    case 'dp':
      return Number.isInteger(v) && (v as number) >= 0 && (v as number) <= DECIMALS_MAX;
    case 'cur':
      return (CURRENCY_SYMBOLS as readonly string[]).includes(v as string);
    case 'fc':
    case 'bg':
      return isColour(v);
    case 'ff':
      return typeof v === 'string' && FONT_ID_RE.test(v);
    case 'fs':
      return (
        Number.isInteger(v) && (v as number) >= FONT_SIZE_MIN && (v as number) <= FONT_SIZE_MAX
      );
    case 'ha':
      return v === 'l' || v === 'c' || v === 'r';
    case 'va':
      return v === 't' || v === 'm' || v === 'b';
    case 'wr':
      return v === 'o' || v === 'w' || v === 'c';
    default:
      if (FLAG_KEYS.has(key)) return v === true;
      if (BORDER_KEYS.has(key)) return isBorder(v);
      return false;
  }
}

// A format patch: each key set to a value, or null to clear it. Returns null when any key or value is invalid.
export type FormatPatch = Partial<Record<FormatKey, unknown>>;

export function validFormatPatch(patch: unknown): patch is FormatPatch {
  if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) return false;
  for (const [k, v] of Object.entries(patch)) {
    if (!(FORMAT_KEYS as readonly string[]).includes(k)) return false;
    if (v !== null && !validFormatValue(k, v)) return false;
  }
  return true;
}

export function validFormat(format: unknown): format is CellFormat {
  if (!validFormatPatch(format)) return false;
  return Object.values(format).every((v) => v !== null);
}

// The format after a patch; undefined when nothing is left. Keys set to null are cleared.
export function mergeFormat(
  base: CellFormat | undefined,
  patch: FormatPatch | null,
): CellFormat | undefined {
  if (patch === null) return undefined;
  const out: Record<string, unknown> = { ...(base ?? {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined) delete out[k];
    else out[k] = v;
  }
  return Object.keys(out).length === 0 ? undefined : (out as CellFormat);
}

export function formatEquals(a: CellFormat | undefined, b: CellFormat | undefined): boolean {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}
