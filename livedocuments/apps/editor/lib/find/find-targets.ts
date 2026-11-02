// What Find searches on a tab (docs/specs/007-editor/find-and-replace.md "What is searched"; blueprint "Gathering"):
// every searched text in the order Find steps through them, each with where it lives (so Replace can write it back)
// and whether this person may replace in it. Pure: one walk over the pages, their articles' blocks and their elements.
import {
  articlesOf,
  elementAnchorPoint,
  buildElementIndex,
  isLayerLocked,
  participantTextFields,
  resolveLayerId,
  tabLayers,
  type ArticleBlock,
  type Element,
  type LaidOutPage,
  type Tab,
} from '@livedocuments/document';
import { elementsByPage } from '@/lib/elements-by-page';
import type { ReplaceScope } from '@/lib/editor-capabilities';

// An element's own text fields, searched in this order.
export const FIND_ELEMENT_FIELDS = ['label', 'pageTitle', 'pageSubtitle', 'code'] as const;
export type FindElementField = (typeof FIND_ELEMENT_FIELDS)[number];

export type FindRef =
  | { kind: 'block'; flow: string; blockId: string }
  | { kind: 'field'; id: string; field: FindElementField }
  | { kind: 'cell'; id: string; r: number; c: number }
  | { kind: 'item'; id: string; index: number };

// Why a match may not be replaced: its text is not one the role writes, or a lock holds it.
export type FindHeld = 'role' | 'locked' | null;

export type FindTarget = {
  // Stable across edits: the match in hand is found again by it.
  key: string;
  pageId: string;
  text: string;
  held: FindHeld;
  ref: FindRef;
};

export type FindTargetOptions = {
  scope: ReplaceScope;
  // The page a block of an article starts on, as its editor lays it out; absent, its article's first page.
  blockPage?: (flow: string, blockId: string) => string | undefined;
};

/** A block's searched text: a paragraph's or a list item's runs joined, a code block's text; none for the rest. */
export function blockSearchText(block: ArticleBlock): string | null {
  if (block.type === 'paragraph' || block.type === 'list') {
    let text = '';
    for (const run of block.runs) text += run.text;
    return text;
  }
  return block.type === 'code' ? block.text : null;
}

function elementLocked(tab: Tab, el: Element): boolean {
  if ((el as { locked?: boolean }).locked === true) return true;
  if (!tab.layers) return false;
  const layers = tabLayers(tab.layers);
  const layer = layers.find((l) => l.id === resolveLayerId(el.layerId, layers));
  return layer !== undefined && isLayerLocked(layer);
}

const keyOf = (ref: FindRef): string => {
  switch (ref.kind) {
    case 'block':
      return `b:${ref.flow}:${ref.blockId}`;
    case 'field':
      return `f:${ref.id}:${ref.field}`;
    case 'cell':
      return `c:${ref.id}:${ref.r}:${ref.c}`;
    case 'item':
      return `i:${ref.id}:${ref.index}`;
  }
};

/** Every searched text of the tab, in Find's order: page by page in the row, on each the writing that starts there,
 *  then its elements top to bottom, left to right. */
export function findTargets(
  tab: Tab,
  pages: readonly LaidOutPage[],
  options: FindTargetOptions,
): FindTarget[] {
  const { scope } = options;
  const out: FindTarget[] = [];
  const articles = articlesOf(tab);
  const tabLocked = tab.locked === true;
  // The articles holding a locked page: their writing is held for everyone.
  const lockedFlows = new Set(pages.filter((p) => p.flow && p.locked === true).map((p) => p.flow!));
  const firstPageOf = new Map<string, string>();
  for (const p of pages) if (p.flow && !firstPageOf.has(p.flow)) firstPageOf.set(p.flow, p.id);
  // Each page's blocks, in block order.
  const pageIds = new Set(pages.map((p) => p.id));
  const blocksOn = new Map<string, { flow: string; block: ArticleBlock }[]>();
  for (const [flow, doc] of Object.entries(articles)) {
    const first = firstPageOf.get(flow);
    // An article with no page in the row has nowhere to be found.
    if (!first) continue;
    for (const block of doc.blocks) {
      const laidOut = options.blockPage?.(flow, block.id);
      const at = laidOut !== undefined && pageIds.has(laidOut) ? laidOut : first;
      let list = blocksOn.get(at);
      if (!list) blocksOn.set(at, (list = []));
      list.push({ flow, block });
    }
  }
  const onPage = elementsByPage(pages, tab.elements);
  const index = buildElementIndex(tab.elements);
  const push = (pageId: string, ref: FindRef, text: string, held: FindHeld) => {
    if (text !== '') out.push({ key: keyOf(ref), pageId, text, held, ref });
  };
  for (const page of pages) {
    for (const { flow, block } of blocksOn.get(page.id) ?? []) {
      const text = blockSearchText(block);
      if (text === null) continue;
      const held: FindHeld =
        tabLocked || lockedFlows.has(flow) ? 'locked' : scope === false ? 'role' : null;
      push(page.id, { kind: 'block', flow, blockId: block.id }, text, held);
    }
    const placed = onPage
      .get(page.id)!
      .map((el) => ({ el, at: elementAnchorPoint(el, index) }))
      .sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x);
    for (const { el } of placed) {
      const locked = tabLocked || page.locked === true || elementLocked(tab, el);
      const writable = scope === 'text' ? participantTextFields(el.type) : null;
      const heldFor = (field: string): FindHeld =>
        locked
          ? 'locked'
          : scope === false || (writable !== null && !writable.includes(field))
            ? 'role'
            : null;
      const bag = el as unknown as Record<string, unknown>;
      for (const field of FIND_ELEMENT_FIELDS) {
        const v = bag[field];
        if (typeof v === 'string')
          push(page.id, { kind: 'field', id: el.id, field }, v, heldFor(field));
      }
      if (Array.isArray(bag.cells)) {
        const held = heldFor('cells');
        (bag.cells as unknown[]).forEach((row, r) => {
          if (!Array.isArray(row)) return;
          row.forEach((cell, c) => {
            if (typeof cell === 'string')
              push(page.id, { kind: 'cell', id: el.id, r, c }, cell, held);
          });
        });
      }
      if (Array.isArray(bag.checklistItems)) {
        const held = heldFor('checklistItems');
        (bag.checklistItems as unknown[]).forEach((item, i) => {
          const text = (item as { text?: unknown } | null)?.text;
          if (typeof text === 'string')
            push(page.id, { kind: 'item', id: el.id, index: i }, text, held);
        });
      }
    }
  }
  return out;
}
