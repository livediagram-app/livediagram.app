'use client';

// Ask AI for the open plan, in the footer's Tools (docs/specs/026-plan/ask-ai.md; liveworkspace/docs/specs/019-ask/
// ask.md "In each app"): the tool is the platform's (@liveworkspace/ask); this says what the plan's words are (every
// tab's elements, the ones Search reads, and every card) and how to go to a source: a card opens, on the tab whose
// board shows it; anything else is its tab with the element selected.
import { useAskTool } from '@liveworkspace/ask/use-ask-tool';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { cardPassages, isCardSource } from '@/lib/ask-cards';
import { cardTabResolver } from '@/lib/search-plan';

const SUGGESTIONS = [
  'Summarise this plan',
  'What is in progress right now?',
  'Which cards have no description?',
] as const;

export function useAskAi(itemId: string | null | undefined, accountId: string | null): void {
  const { tabs, loadAllTabs, activeId, setActiveId, setSelectedId, plan } = useEditorContext();
  useAskTool({
    app: 'liveplanner',
    itemId: itemId ?? null,
    accountId,
    tabs,
    loadAllTabs,
    suggestions: SUGGESTIONS,
    more: () => {
      const types = plan?.context.types;
      return cardPassages({
        items: plan?.context.items,
        types,
        tabOf: cardTabResolver(tabs, types),
        fallback: tabs[0],
      });
    },
    open: (source) => {
      if (source.tabId !== activeId) {
        setActiveId(source.tabId);
        setSelectedId(null);
      }
      if (isCardSource(source) && source.elementId) plan?.context.openItem(source.elementId);
      else setSelectedId(source.elementId);
    },
  });
}
