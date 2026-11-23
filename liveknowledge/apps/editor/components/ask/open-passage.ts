// Opening a page from Ask or Insights (docs/specs/030-knowledgebase/search-and-ask.md "What an answer shows"):
// Pages shows again, as a history entry (so Back returns to the answer), and the page opens at the passage's first
// block, lit for a moment (lib/knowledge/go-to-block.ts, the search result's own way in).
import type { EditorChromeStore } from '@/app/document/[id]/EditorContext';
import { goToBlock } from '@/lib/knowledge/go-to-block';
import { showKnowledgeView } from '@/lib/knowledge-ask/knowledge-view';

/** False when the page is no longer in the knowledgebase (or out of this session's reach). */
export function openPassage(chrome: EditorChromeStore, tab: string, block = ''): boolean {
  if (!chrome.get().tabs.some((t) => t.id === tab)) return false;
  showKnowledgeView('pages');
  goToBlock(() => chrome.get(), tab, block);
  return true;
}
