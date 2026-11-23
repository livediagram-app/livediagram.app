'use client';

// Ask AI for the open design, in the footer's Tools (liveworkspace/docs/specs/019-ask/ask.md "In each app"): the tool
// is the platform's (@liveworkspace/ask); this says what the design's words are (every tab's elements, the ones Search
// reads) and how to go to a source (its tab, the element selected).
import { useAskTool } from '@liveworkspace/ask/use-ask-tool';
import { useEditorContext } from '@/app/design/[id]/EditorContext';

const SUGGESTIONS = [
  'Summarise this design',
  'What does the copy say?',
  'Which pages mention a price or a date?',
] as const;

export function useAskAi(itemId: string | null | undefined, accountId: string | null): void {
  const { tabs, loadAllTabs, setActiveId, setSelectedId } = useEditorContext();
  useAskTool({
    app: 'livedesign',
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
