'use client';

// Ask AI for the open canvas, in the footer's Tools (liveworkspace/docs/specs/019-ask/ask.md "In each app"): the tool
// is the platform's (@liveworkspace/ask); this says what the canvas's words are (every tab's elements, the ones Search
// reads) and how to go to a source (its tab, the element selected).
import { useAskTool } from '@liveworkspace/ask/use-ask-tool';
import { useEditorContext } from '@/app/document/[id]/EditorContext';

const SUGGESTIONS = [
  'Summarise this canvas',
  'What are the main steps here?',
  'What looks missing or unclear?',
] as const;

export function useAskAi(itemId: string | null | undefined, accountId: string | null): void {
  const { tabs, loadAllTabs, setActiveId, setSelectedId } = useEditorContext();
  useAskTool({
    app: 'livediagram',
    itemId: itemId ?? null,
    accountId,
    tabs,
    loadAllTabs,
    suggestions: SUGGESTIONS,
    open: (source) => {
      setActiveId(source.tabId);
      setSelectedId(source.elementId);
    },
  });
}
