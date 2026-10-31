// A field's formatting (docs/specs/026-plan/items.md "Fields"): `descriptionRich` for the description, and
// `<id>Rich` for a Long Text custom field (docs/specs/026-plan/item-types.md "An item type"), runs of text with the
// editor's marks, beside the field's own value, its plain-text mirror. The run shape matches @liveplanner/project's
// TextRun, checked here because the item store sits below that package.
import type { ItemFields, ItemFieldValue } from './item';
import { ITEM_DESCRIPTION_MAX, ITEM_UNKNOWN_STRING_MAX } from './limits';
import { HEX_COLOUR } from './validate';

export const DESCRIPTION_RICH_FIELD = 'descriptionRich';
// A Long Text custom field's formatting key: its id (CUSTOM_FIELD_ID_PATTERN's `f-` ids) and `Rich`. A custom
// field's id is lower case, so no field's own id ever ends this way.
const CUSTOM_RICH_FIELD = /^f-[a-z0-9-]{1,30}Rich$/;

// The key that holds `field`'s formatting: `description` → `descriptionRich`, `f-steps` → `f-stepsRich`.
export function richFieldOf(field: string): string {
  return `${field}Rich`;
}

// Whether a key holds a field's formatting, and so takes runs.
export function isRichFieldKey(key: string): boolean {
  return key === DESCRIPTION_RICH_FIELD || CUSTOM_RICH_FIELD.test(key);
}

// The most text a formatting key's runs hold: its field's own limit.
export function richTextMaxOf(key: string): number {
  return key === DESCRIPTION_RICH_FIELD ? ITEM_DESCRIPTION_MAX : ITEM_UNKNOWN_STRING_MAX;
}

// A Long Text field's formatting as it reads: its runs while their text still spells the field's value, else none
// (the value was written plain since, by a form, a sheet or an agent), so a field never shows an older text.
export function richRunsOf(fields: ItemFields, field: string): ItemFieldValue[] | undefined {
  const plain = fields[field];
  const runs = fields[richFieldOf(field)];
  if (typeof plain !== 'string' || !Array.isArray(runs) || runs.length === 0) return undefined;
  let text = '';
  for (const r of runs) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return undefined;
    const t = (r as Record<string, unknown>)['text'];
    if (typeof t !== 'string') return undefined;
    text += t;
  }
  return text === plain ? runs : undefined;
}

// Whether any run carries a mark: runs with none are stored as their plain text alone.
export function runsAreMarked(runs: readonly unknown[]): boolean {
  return runs.some((r) => !!r && typeof r === 'object' && Object.keys(r).some((k) => k !== 'text'));
}
// Runs in one description; an edit splits text into a run per change of mark, so this is generous.
export const ITEM_RICH_RUNS_MAX = 2000;
const LINK_MAX = 2048;

const SIZES = ['xs', 'sm', 'md', 'lg'];
const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

// A link a description's run may carry: http(s) or mailto, within the length the store keeps.
export function isRichLink(link: string): boolean {
  return link.length <= LINK_MAX && SAFE_LINK.test(link);
}

const BOOLS = ['bold', 'italic', 'underline', 'strikethrough'] as const;

// The runs, normalised (unknown keys dropped), or undefined when any run is invalid or the text runs
// past `max` (the description's limit by default).
export function normaliseRichRuns(
  v: unknown,
  max: number = ITEM_DESCRIPTION_MAX,
): ItemFieldValue[] | undefined {
  if (!Array.isArray(v) || v.length > ITEM_RICH_RUNS_MAX) return undefined;
  const out: ItemFieldValue[] = [];
  let length = 0;
  for (const r of v) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return undefined;
    const run = r as Record<string, unknown>;
    if (typeof run['text'] !== 'string') return undefined;
    length += run['text'].length;
    if (length > max) return undefined;
    const next: Record<string, ItemFieldValue> = { text: run['text'] };
    for (const k of BOOLS) {
      if (run[k] === undefined) continue;
      if (typeof run[k] !== 'boolean') return undefined;
      if (run[k]) next[k] = true;
    }
    if (run['size'] !== undefined) {
      if (!SIZES.includes(run['size'] as string)) return undefined;
      next['size'] = run['size'] as string;
    }
    if (run['color'] !== undefined) {
      if (typeof run['color'] !== 'string' || !HEX_COLOUR.test(run['color'])) return undefined;
      next['color'] = run['color'];
    }
    if (run['link'] !== undefined) {
      const link = run['link'];
      if (typeof link !== 'string' || !isRichLink(link)) return undefined;
      next['link'] = link;
    }
    if (run['heading'] !== undefined) {
      if (run['heading'] !== 1 && run['heading'] !== 2 && run['heading'] !== 3) return undefined;
      next['heading'] = run['heading'];
    }
    out.push(next);
  }
  return out;
}
