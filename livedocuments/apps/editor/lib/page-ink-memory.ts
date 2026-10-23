// The editor's session memory of what re-inking replaced, per tab (docs/specs/007-editor/
// pages-mode.md "Re-inking", "Going back"): so a page taken to Midnight and back to the
// paper gets every colour back as the author chose it. Never stored in the document; gone on a
// reload. Bounded: a tab's memory holds at most one entry per element on it (pageInkFor drops the
// ids no longer on the tab), and at most MAX_TABS tabs are remembered.
import { EMPTY_INK_MEMORY, type InkMemory } from '@livedocuments/document';

// Tabs remembered at once; the least recently re-inked goes first.
const MAX_TABS = 20;

const byTab = new Map<string, InkMemory>();

/** What re-inking has replaced on a tab this session. */
export function pageInkMemory(tabId: string): InkMemory {
  return byTab.get(tabId) ?? EMPTY_INK_MEMORY;
}

/** The tab's memory after a re-ink. */
export function rememberPageInk(tabId: string, memory: InkMemory): void {
  byTab.delete(tabId);
  if (memory.size === 0) return;
  byTab.set(tabId, memory);
  if (byTab.size > MAX_TABS) byTab.delete(byTab.keys().next().value!);
}
