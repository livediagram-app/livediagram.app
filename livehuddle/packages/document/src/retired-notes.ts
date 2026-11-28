// Text and sticky notes are gone from livehuddle (docs/specs/002-project-scope/not-in-livehuddle.md "The Write
// category"): a Space is built from its pieces, and its words live on its Notice Boards, Room Signs and room names. A
// tab saved while they existed may hold `text` and `sticky` elements: they are dropped. Run on every stored or incoming
// tab by the stored-tab migration (./stored-tab), and on incoming elements (a paste, a file, a shape library) by
// migrateIncomingElements, so no data migration is needed: the notes simply stop showing, and the tab is saved without
// them the next time it is saved.
//
// Nothing else is rewritten. No element holds another's id except a stored arrow's pinned end, which is kept exactly as
// stored (./retired-arrow) and draws from its other end, and an element link, which leads nowhere, as one to any
// deleted element does. Pure; the same object back when there is nothing to drop, so the common read allocates
// nothing.
import { isRecord } from '@liveworkspace/model-core/is-record';

// The element types livehuddle no longer has.
const RETIRED_NOTE_TYPES: ReadonlySet<unknown> = new Set(['text', 'sticky']);

/** Whether an element is a retired text or sticky note. */
export function isRetiredNote(el: unknown): boolean {
  return isRecord(el) && RETIRED_NOTE_TYPES.has(el.type);
}

/** The elements without their texts and sticky notes; the same array back when there are none. */
export function dropRetiredNoteElements<T>(elements: readonly T[]): T[] {
  if (!elements.some(isRetiredNote)) return elements as T[];
  return elements.filter((el) => !isRetiredNote(el));
}

/** The tab without its texts and sticky notes. */
export function dropRetiredNotes<T extends object>(tab: T): T {
  const elements = (tab as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) return tab;
  const kept = dropRetiredNoteElements(elements);
  return kept === elements ? tab : { ...tab, elements: kept };
}
