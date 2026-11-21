'use client';

// What the knowledgebase's menu holds for this session (docs/specs/030-knowledgebase/knowledgebases-and-pages.md
// "The knowledgebase's menu"): Rename, Knowledgebase Settings, Describe to Add Pages, Import,
// Export, AI Settings, then Delete. Describe to Add Pages and Import are a writer's (an Editor or a Participant of the
// whole knowledgebase); Rename, the Style, the Settings, AI Settings and Delete are an Editor's (a Participant is an
// Editor minus the settings, the style and automations, knowledgebases-and-pages.md "Share roles"); a Viewer has
// Export alone, an embed has no menu. Each row is one a hook elsewhere already decides (the style's offer, the
// settings' offer, the setup's offer, the Ask rights), so the menu never disagrees with the feature.
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { useAskSession } from '@/components/ask/useAskSession';
import { useKnowledgebaseSettings } from '@/components/knowledge-settings/KnowledgeSettingsHost';
import { useStyleOffered } from '@/components/knowledge-style/useStyleOffered';
import { useDescribeToAddPages } from '@/components/setup/SetupHost';
import { openAiSettings } from '@/lib/knowledge-ask/ai-settings-open';

export type KnowledgeMenuVerb =
  'rename' | 'settings' | 'describe' | 'import' | 'export' | 'ai' | 'delete';

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
  const settings = useKnowledgebaseSettings();
  const describe = useDescribeToAddPages();
  const manageAi = useAskSession()?.rights.manageAi === true;
  const plain = useEditorChrome((s) => !s.embedMode);
  const rows: KnowledgeMenuRow[] = [];
  if (editor && onRename) rows.push({ verb: 'rename', label: 'Rename', run: onRename });
  if (settings) rows.push({ verb: 'settings', label: settings.label, run: settings.onSelect });
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
