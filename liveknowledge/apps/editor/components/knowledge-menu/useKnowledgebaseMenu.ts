'use client';

// What the knowledgebase's menu holds for this session (docs/specs/030-knowledgebase/knowledgebases-and-pages.md
// "The knowledgebase's menu"): Rename, Describe to Add Pages, Import, Export, Publish to the Web, AI Settings, then
// Delete. Publish to the Web is an Editor's in person, signed in, for a knowledgebase not kept Offline
// (publishing.md "Who"). Describe to Add
// Pages and Import are a writer's (an Editor or a Participant of the whole knowledgebase); Rename, AI Settings and
// Delete are an Editor's (a Participant is an Editor minus the Review Period, the style and automations,
// knowledgebases-and-pages.md "Share roles"); a Viewer has Export alone, an embed has no menu. Each row is one a hook
// elsewhere already decides (the style's offer, the setup's offer, the Ask rights), so the menu never disagrees with
// the feature.
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { useAskSession } from '@/components/ask/useAskSession';
import { useStyleOffered } from '@/components/knowledge-style/useStyleOffered';
import { useDescribeToAddPages } from '@/components/setup/SetupHost';
import { openAiSettings } from '@/lib/knowledge-ask/ai-settings-open';
import { openPublishing } from '@/lib/publishing/publish-open';

export type KnowledgeMenuVerb =
  'rename' | 'describe' | 'import' | 'export' | 'publish' | 'ai' | 'delete';

export type KnowledgeMenuRow = { verb: KnowledgeMenuVerb; label: string; run: () => void };

/** The rows, in order; Delete, when offered, is the last and stands under a separator. */
export function useKnowledgebaseMenu(onRename: (() => void) | undefined): KnowledgeMenuRow[] {
  const store = useEditorChromeStore();
  // An Editor of the whole knowledgebase, outside an embed, a workbench pane and a Community visit.
  const editor = useStyleOffered();
  // A writer of the whole knowledgebase, in the same places: an Editor or a Participant.
  const writer = useEditorChrome(
    (s) =>
      s.can.editPages &&
      !s.isStructureReadOnly &&
      s.hydrated &&
      !s.embedMode &&
      !s.workbench &&
      !s.sessionCommunity &&
      !!s.documentId,
  );
  const describe = useDescribeToAddPages();
  const ask = useAskSession();
  const manageAi = ask?.rights.manageAi === true;
  // Publishing needs the server and an account: signed in, not kept Offline (ask-rights.ts askOff).
  const publishes = ask?.rights.askOff === null;
  const plain = useEditorChrome((s) => !s.embedMode);
  const rows: KnowledgeMenuRow[] = [];
  if (editor && onRename) rows.push({ verb: 'rename', label: 'Rename', run: onRename });
  if (describe) rows.push({ verb: 'describe', label: describe.label, run: describe.onSelect });
  if (writer)
    rows.push({ verb: 'import', label: 'Import', run: () => store.get().setImportOpen(true) });
  if (plain)
    rows.push({
      verb: 'export',
      label: 'Export',
      run: () => {
        const s = store.get();
        s.setExportScope('tab');
        s.setExportOpen(true);
      },
    });
  if (editor && publishes)
    rows.push({ verb: 'publish', label: 'Publish to the Web', run: openPublishing });
  if (editor && manageAi) rows.push({ verb: 'ai', label: 'AI Settings', run: openAiSettings });
  if (editor)
    rows.push({
      verb: 'delete',
      label: 'Delete',
      run: () => {
        const { documentId, deleteDocument } = store.get();
        // It asks first, and takes the person back to their work when it is done.
        if (documentId) void deleteDocument(documentId);
      },
    });
  return rows;
}
