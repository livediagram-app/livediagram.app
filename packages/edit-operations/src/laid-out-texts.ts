// The texts of the pages a change_pages call laid out (each paged product's docs/specs/024-agents/pages-for-agents.md
// "A laid-out page's texts"): each text's ref, slot and words in the answer, so the sample text left to replace and
// its ref come back with the layout instead of from a read. Bounded so a call of fifty laid-out pages still answers
// well inside the 150,000-character tool result.
import {
  partPath,
  partsOf,
  splitPartId,
  tableInWords,
  type LayoutTextSlot,
  type SlotElement,
} from './layout-slots';

// The most characters of a text the answer repeats: enough to tell a sample from the words written over it.
export const PAGE_TEXT_SAMPLE_MAX = 80;
// The characters the answer's texts may take in all; the pages past it list none, and a line says which.
export const PAGE_TEXTS_BUDGET = 60_000;

/** One text of a laid-out page: its ref, its slot, its words cut short, and `sample` while they are the layout's. A
 *  compound element's part names where in the element it is kept (`stats[0].value`), for an edit by ref. */
export type PageText = {
  ref: string;
  part?: string;
  slot: string | null;
  text: string;
  sample?: true;
};

const sample = (label: string) =>
  label.length > PAGE_TEXT_SAMPLE_MAX ? `${label.slice(0, PAGE_TEXT_SAMPLE_MAX - 1)}…` : label;

/**
 * The pages, each one `laid` names given its `texts` while they fit the budget, in row order. A slot whose element is
 * no longer on the tab is skipped. `refOf` is the ref the views print for an element id.
 */
export function withLaidOutTexts<P extends { id: string }>(
  pages: readonly P[],
  laid: ReadonlyMap<string, readonly LayoutTextSlot[]> | undefined,
  elements: readonly { id: string; type?: string; label?: unknown }[],
  refOf: (id: string) => string,
): (P & { texts?: PageText[] })[] {
  if (!laid || laid.size === 0) return [...pages];
  const byId = new Map(elements.map((el) => [el.id, el as SlotElement]));
  let spent = 0;
  let full = false;
  return pages.map((page) => {
    const slots = laid.get(page.id);
    if (!slots || full) return page;
    const texts = slots.flatMap((s): PageText[] => {
      const { id, part } = splitPartId(s.id);
      const el = byId.get(id) ?? byId.get(s.id);
      if (!el) return [];
      const piece = part === null || byId.has(s.id) ? null : partsOf(el)[part];
      const label = piece ? piece.text : s.slot === 'table' ? tableInWords(el) : el.label;
      if (typeof label !== 'string') return [];
      return [
        {
          ref: refOf(el.id),
          ...(piece ? { part: partPath(piece.at) } : {}),
          slot: s.slot,
          text: sample(label),
          ...(s.sample ? { sample: true as const } : {}),
        },
      ];
    });
    spent += JSON.stringify(texts).length;
    if (spent > PAGE_TEXTS_BUDGET) {
      full = true;
      return page;
    }
    return { ...page, texts };
  });
}

/** The line saying which laid-out pages list no texts, the budget spent, or null when every one does. */
export function textsLeftOutLine(
  pages: readonly { id: string; place: number; texts?: unknown }[],
  laid: ReadonlyMap<string, unknown> | undefined,
  view: string,
): string | null {
  const left = pages.filter((p) => laid?.has(p.id) && p.texts === undefined).map((p) => p.place);
  if (left.length === 0) return null;
  const places =
    left.length === 1 ? `page ${left[0]}` : `pages ${left[0]}-${left[left.length - 1]}`;
  return `Texts of ${places} are left out to keep this answer short: ${view} lists them.`;
}
