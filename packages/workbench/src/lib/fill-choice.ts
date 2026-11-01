// The Fill tool's colour, as this browser last set it (livediagram docs/specs/023-draw-mode/fill-tool.md
// "Its colour", livedesign docs/specs/023-draw-mode/drawing-tools.md "The Fill tool"): a `#rrggbb`
// picked in the shared colour picker, or `transparent`. Null until the person picks one, when each
// product pours its theme's first fill. The person's, never the document's; each product binds its
// own storage key.
import { readLocalStorageSafe, writeLocalStorageSafe } from './local-storage-safe';

export const FILL_TRANSPARENT = 'transparent';
/** A `#rrggbb` or `transparent`; null for the product's default. */
export type FillChoice = string | null;

const HEX = /^#[0-9a-f]{6}$/i;

/** A stored choice, or null (the default) for anything else. */
export function parseFillChoice(raw: unknown): FillChoice {
  if (raw === FILL_TRANSPARENT) return FILL_TRANSPARENT;
  return typeof raw === 'string' && HEX.test(raw) ? raw.toLowerCase() : null;
}

export function loadFillChoice(key: string): FillChoice {
  return parseFillChoice(readLocalStorageSafe(key));
}

export function saveFillChoice(key: string, choice: string): void {
  const parsed = parseFillChoice(choice);
  if (parsed) writeLocalStorageSafe(key, parsed);
}
