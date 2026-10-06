// An item's description formatting (docs/specs/026-plan/items.md "Fields"): `descriptionRich`, runs of
// text with the editor's marks, beside `description`, its plain-text mirror. The run shape matches
// @livediagram/document's TextRun, checked here because the item store sits below that package.
import type { ItemFieldValue } from './item';
import { ITEM_DESCRIPTION_MAX } from './limits';

export const DESCRIPTION_RICH_FIELD = 'descriptionRich';
// Runs in one description; an edit splits text into a run per change of mark, so this is generous.
export const ITEM_RICH_RUNS_MAX = 2000;
const LINK_MAX = 2048;

const SIZES = ['xs', 'sm', 'md', 'lg'];
const HEX = /^#[0-9a-fA-F]{6}$/;
const SAFE_LINK = /^(https?:\/\/|mailto:)/i;
const BOOLS = ['bold', 'italic', 'underline', 'strikethrough'] as const;

// The runs, normalised (unknown keys dropped), or undefined when any run is invalid or the text runs
// past the description's limit.
export function normaliseRichRuns(v: unknown): ItemFieldValue[] | undefined {
  if (!Array.isArray(v) || v.length > ITEM_RICH_RUNS_MAX) return undefined;
  const out: ItemFieldValue[] = [];
  let length = 0;
  for (const r of v) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return undefined;
    const run = r as Record<string, unknown>;
    if (typeof run['text'] !== 'string') return undefined;
    length += run['text'].length;
    if (length > ITEM_DESCRIPTION_MAX) return undefined;
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
      if (typeof run['color'] !== 'string' || !HEX.test(run['color'])) return undefined;
      next['color'] = run['color'];
    }
    if (run['link'] !== undefined) {
      const link = run['link'];
      if (typeof link !== 'string' || link.length > LINK_MAX || !SAFE_LINK.test(link))
        return undefined;
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
