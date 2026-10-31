// A Choice or Multiple Choice field's options as the card panel draws and edits them (docs/specs/026-plan/item-types.md
// "Choice and Multiple Choice in the card panel"). Pure.
import { LABEL_COLOURS } from './label-colour';

// An option's colour: its place in the field's option list, the label swatches in turn, so a field's options never
// share one while it has eight or fewer. Undefined for a value that is no longer an option.
export function choiceColour(options: readonly string[], option: string): string | undefined {
  const at = options.indexOf(option);
  return at < 0 ? undefined : LABEL_COLOURS[at % LABEL_COLOURS.length];
}

// The picks a stored value holds: its strings, once each, those still options in option order, then any that are no
// longer options (renamed or removed in the type editor) in the order stored, so nothing is hidden or dropped.
export function choicePicks(options: readonly string[], value: unknown): string[] {
  const stored = Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && v !== '')
    : typeof value === 'string' && value !== ''
      ? [value]
      : [];
  const held = new Set(stored);
  const known = options.filter((o) => held.has(o));
  const stale = [...held].filter((v) => !options.includes(v));
  return [...known, ...stale];
}

// The picks with `option` toggled: added in its option-order place, or taken off.
export function toggledChoice(
  options: readonly string[],
  picks: readonly string[],
  option: string,
): string[] {
  return picks.includes(option)
    ? picks.filter((p) => p !== option)
    : choicePicks(options, [...picks, option]);
}

// The options whose name holds the typed text, case aside; every option for no text.
export function matchOptions(options: readonly string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  return q ? options.filter((o) => o.toLowerCase().includes(q)) : [...options];
}
