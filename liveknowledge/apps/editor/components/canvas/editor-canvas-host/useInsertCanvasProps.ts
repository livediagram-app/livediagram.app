import { useEditorContext } from '@/app/document/[id]/EditorContext';
import type { Element } from '@liveknowledge/document';
import type { LibraryInsertItem } from '@liveworkspace/workbench/hooks/canvas/useLibraryItemInsert';
import type { useQuickConnectStart } from '@/hooks/canvas/useQuickConnectStart';
import { dropThenDisarm } from '@liveworkspace/workbench/lib/palette-drop';
import { useLibraryDrop } from '@liveworkspace/workbench/components/library/useLibraryDrop';

// The Canvas props for putting things on the canvas (EditorCanvasHost): the palette's adds and drops,
// the draw tools and their commits, and quick connect.
export function useInsertCanvasProps({
  handleStartArrow,
}: {
  handleStartArrow: ReturnType<typeof useQuickConnectStart>['handleStartArrow'];
}) {
  const {
    addArrow,
    addAvatar,
    addLogoStrip,
    addBanner,
    addCallout,
    addHeader,
    addHero,
    addIcon,
    addSticker,
    addImage,
    addLinkCard,
    addVideo,
    addProcess,
    addShape,
    addStatRow,
    addSticky,
    dropBoardFile,
    addTable,
    addTechIcon,
    addText,
    beginPolygon,
    cancelDrawShape,
    commitDraw,
    commitPolygon,
    dropIconOnElement,
    dropPaletteItem,
    insertLibraryItem,
    isReadOnly,
    openCellLinkPicker,
    pendingDraw,
    spawnConnectSelected,
  } = useEditorContext();
  // A Library tile dropped on the canvas lands where it was dropped, once the door answers (libraries.md).
  const dropLibraryItem = useLibraryDrop((item, at) =>
    insertLibraryItem(item as LibraryInsertItem<Element>, at),
  );
  return {
    onAddShape: addShape,
    onAddIcon: addIcon,
    onAddSticker: addSticker,
    onAddTechIcon: addTechIcon,
    onInsertLibraryItem: (item: LibraryInsertItem<unknown>) =>
      void insertLibraryItem(item as LibraryInsertItem<Element>),
    onDropIcon: isReadOnly ? undefined : dropIconOnElement,
    onLinkCell: isReadOnly ? undefined : openCellLinkPicker,
    onAddTable: addTable,
    onAddLinkCard: addLinkCard,
    onAddVideo: addVideo,
    onAddBanner: addBanner,
    onAddHero: addHero,
    onAddHeader: addHeader,
    onAddCallout: addCallout,
    onAddStatRow: addStatRow,
    onAddProcess: addProcess,
    onAddAvatar: addAvatar,
    onAddLogoStrip: addLogoStrip,
    onAddText: addText,
    onAddSticky: addSticky,
    onDropFile: isReadOnly ? undefined : dropBoardFile,
    onDropLibraryItem:
      isReadOnly || !dropLibraryItem
        ? undefined
        : (id: string, at: { x: number; y: number }) => void dropLibraryItem(id, at),
    onAddImage: addImage,
    onAddArrow: addArrow,
    onBeginPolygon: beginPolygon,
    pendingDraw,
    onCommitDraw: commitDraw,
    onCommitPolygon: commitPolygon,
    onCancelDraw: cancelDrawShape,
    onDropPalette: dropThenDisarm(dropPaletteItem, cancelDrawShape),
    onSpawnConnect: spawnConnectSelected,
    onStartArrow: handleStartArrow,
  };
}
