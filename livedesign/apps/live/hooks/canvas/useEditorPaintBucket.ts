'use client';

// The Fill tool's press for the canvas (docs/specs/023-draw-mode/drawing-tools.md "The Fill tool"):
// usePaintBucket bound to the editor around the canvas, so the canvas fills without another prop
// threaded through its host. Outside an editor (a canvas mounted on its own) a press does nothing.
import type { Element } from '@livedesign/design';
import { useOptionalEditorContext } from '@/app/design/[id]/EditorContext';
import { useToast } from '@/hooks/ui/useToast';
import type { PendingDraw } from '@/lib/draw-mode';
import { usePaintBucket } from './usePaintBucket';

const NO_ELEMENTS: Element[] = [];

export function useEditorPaintBucket(pendingDraw: PendingDraw | null | undefined) {
  const editor = useOptionalEditorContext();
  const toast = useToast();
  return usePaintBucket({
    pendingDraw: pendingDraw ?? null,
    elements: () => editor?.activeTab.elements ?? NO_ELEMENTS,
    layers: editor?.layers,
    inertIds: editor?.layerInertIds ?? new Set(),
    // What blocks a structure edit (useEditorState's structureBlocked): a locked or unloaded tab, or
    // a read-only session, a Participant's among them (docs/specs/013-workspace/share-roles.md).
    editsBlocked:
      !editor ||
      editor.activeTabLocked ||
      editor.isReadOnly ||
      editor.activeTabLoadState !== 'ready',
    // Read only past editsBlocked, so an editor is there.
    canRecolour: (el) => editor!.can.recolour(el),
    commit: (map) => editor!.commitElements(map),
    hint: (message) => toast.info(message),
  }).paintBucket;
}
