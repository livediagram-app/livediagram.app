'use client';

// The start screen's Import (docs/specs/007-editor/start-diagramming.md "Import"): the chooser (StartImportDialog),
// then the picked tool's import INTO THE TAB the start screen is on, never a new canvas. Excalidraw, draw.io and Visio open the
// tab's own Import dialog at that format (ImportTabDialog, `formats`); Microsoft Whiteboard opens its board picker and
// lands the first chosen board on the tab (importSceneIntoActiveTab). Everything loads on first open.
import dynamic from 'next/dynamic';
import { useCallback, useState, type ReactNode } from 'react';
import { useOptionalEditorContext } from '@/app/document/[id]/EditorContext';
import type { ImportScenes } from '@/hooks/persistence/useMsWhiteboardImport';
import { track } from '@/lib/telemetry';
import type { StartImportSourceId } from './StartImportDialog';

const StartImportDialog = dynamic(
  () => import('./StartImportDialog').then((m) => m.StartImportDialog),
  { ssr: false },
);
const ImportTabDialog = dynamic(
  () => import('@/components/dialogs/ImportTabDialog').then((m) => m.ImportTabDialog),
  { ssr: false },
);
const MsWhiteboardImportDialog = dynamic(
  () =>
    import('@/components/dialogs/MsWhiteboardImportDialog').then((m) => m.MsWhiteboardImportDialog),
  { ssr: false },
);

export const ONE_BOARD_PER_TAB =
  'Only one board goes into a tab. Import the others into tabs of their own.';

type Open = 'choose' | StartImportSourceId | null;

export function useStartImport(): { openImport: (() => void) | undefined; dialogs: ReactNode } {
  const ctx = useOptionalEditorContext();
  const [open, setOpen] = useState<Open>(null);
  const openImport = useCallback(() => {
    track('UI', 'Used', 'StartImport');
    setOpen('choose');
  }, []);
  const close = () => setOpen(null);
  const importScenes: ImportScenes | undefined = ctx
    ? async (scenes, onProgress) => {
        const [first, ...rest] = scenes;
        if (!first) return { status: 'error', error: 'There was no board to import.' };
        const outcome = await ctx.importSceneIntoActiveTab(first, onProgress);
        if (outcome.status !== 'done' || rest.length === 0) return outcome;
        return {
          ...outcome,
          failures: [
            ...(outcome.failures ?? []),
            ...rest.map((s) => ({ title: s.title ?? 'Board', message: ONE_BOARD_PER_TAB })),
          ],
        };
      }
    : undefined;
  return {
    // Only in an editor that may change the tab.
    openImport: ctx && !ctx.isReadOnly ? openImport : undefined,
    dialogs: !ctx ? null : open === 'choose' ? (
      <StartImportDialog onPick={setOpen} onClose={close} />
    ) : open === 'microsoft-whiteboard' && importScenes ? (
      <MsWhiteboardImportDialog
        importScenes={importScenes}
        onClose={close}
        subtitle="The first board you choose goes into this tab."
      />
    ) : open === 'excalidraw' || open === 'drawio' || open === 'visio' ? (
      <ImportTabDialog
        tabName={ctx.activeTab.name}
        formats={[open]}
        onImportFile={ctx.importIntoActiveTab}
        onImportText={ctx.importTextIntoActiveTab}
        onClose={close}
      />
    ) : null,
  };
}
