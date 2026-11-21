'use client';

// What the knowledgebase's menu holds for this session (docs/specs/030-knowledgebase/knowledgebases-and-pages.md
// "The knowledgebase's menu"): Rename, Knowledgebase Style, Knowledgebase Settings, Describe to Add Pages, Import,
// Export, AI Settings, then Delete. Every row but Export is an Editor's, on the whole knowledgebase: a Participant
// or a Viewer has Export alone, an embed has no menu. Each row is one a hook elsewhere already decides (the style's
// offer, the settings' offer, the setup's offer, the Ask rights), so the menu never disagrees with the feature.
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { useAskSession } from '@/components/ask/useAskSession';
import { useKnowledgebaseSettings } from '@/components/knowledge-settings/KnowledgeSettingsHost';
import { useStyleOffered } from '@/components/knowledge-style/useStyleOffered';
import { STYLE_TITLE } from '@/lib/knowledge-style/knowledge-style-words';
import { useDescribeToAddPages } from '@/components/setup/SetupHost';
import { openAiSettings } from '@/lib/knowledge-ask/ai-settings-open';
import { track } from '@/lib/telemetry';

export type KnowledgeMenuVerb =
  'rename' | 'style' | 'settings' | 'describe' | 'import' | 'export' | 'ai' | 'delete';

export type KnowledgeMenuRow = { verb: KnowledgeMenuVerb; label: string; run: () => void };

/** The rows, in order; Delete, when offered, is the last and stands under a separator. */
export function useKnowledgebaseMenu(onRename: (() => void) | undefined): KnowledgeMenuRow[] {
  const store = useEditorChromeStore();
  // An Editor of the whole knowledgebase, outside an embed, a workbench pane and a Community visit.
  const editor = useStyleOffered();
  const settings = useKnowledgebaseSettings();
  const describe = useDescribeToAddPages();
  const manageAi = useAskSession()?.rights.manageAi === true;
  const plain = useEditorChrome((s) => !s.embedMode);
  const rows: KnowledgeMenuRow[] = [];
  if (editor && onRename) rows.push({ verb: 'rename', label: 'Rename', run: onRename });
  if (editor)
    rows.push({
      verb: 'style',
      label: STYLE_TITLE,
      run: () => {
        track('UI', 'Opened', 'ThemePicker');
        store.get().setCanvasThemeTab('looks');
      },
    });
  if (settings) rows.push({ verb: 'settings', label: settings.label, run: settings.onSelect });
  if (describe) rows.push({ verb: 'describe', label: describe.label, run: describe.onSelect });
  if (editor)
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
