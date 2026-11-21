'use client';

// Whether the active tab shows the knowledgebase's start screen (docs/specs/030-knowledgebase/describe-to-set-up.md
// "The start screen"), read from the editor in render. The canvas reads it too, so the new knowledgebase's page is
// never drawn under the start while the panel's own code is still loading.
import { pagesOf } from '@liveknowledge/document';
import { useEditorContext, type EditorContextValue } from '@/app/document/[id]/EditorContext';
import { pageIsUntouched } from '@/lib/knowledge-setup/setup-empty';
import { showsTemplateStart } from '@/components/start/template-start-mode';
import { useKnowledgebaseStartOffered } from '@/components/start/knowledgebase-start';

export function useTemplateStartShown(): boolean {
  return templateStartShownOf(useEditorContext());
}

// One article page with nothing written beyond its Title: the page /new makes. Read only for a tab with no elements.
const isUntouchedPage = (tab: EditorContextValue['activeTab']): boolean => {
  const pages = pagesOf(tab);
  return pages.length === 1 && pages[0]!.kind === 'article' && pageIsUntouched(tab);
};

/** The same answer off any copy of the editor's view-model (the chrome store's, read as a slice): whether the tab may
 *  show the start, before whether it is offered. */
export function templateStartShownOf(
  editor: Pick<
    EditorContextValue,
    | 'hydrated'
    | 'zenMode'
    | 'embedMode'
    | 'pendingDraw'
    | 'activeTab'
    | 'isReadOnly'
    | 'activeTabConnected'
  >,
): boolean {
  const { hydrated, zenMode, embedMode, pendingDraw, activeTab, isReadOnly, activeTabConnected } =
    editor;
  return showsTemplateStart({
    // A connected tab is empty but shows its own page, never a start (connected-tabs.md "How it looks").
    hydrated: hydrated && !activeTabConnected,
    zen: zenMode,
    embed: embedMode,
    readOnly: isReadOnly,
    drawToolArmed: !!pendingDraw,
    elementCount: activeTab.elements.length,
    untouchedPage: activeTab.elements.length === 0 && isUntouchedPage(activeTab),
  });
}

// Whether the start is up over the tab: it may show, and it is offered here (the knowledgebase /new just made, until a
// choice closes it). The canvas holds the page back only while this is true.
export function useTemplateStartOpen(): boolean {
  const shown = useTemplateStartShown();
  const { activeTab } = useEditorContext();
  const offered = useKnowledgebaseStartOffered(activeTab.id);
  return shown && offered;
}
