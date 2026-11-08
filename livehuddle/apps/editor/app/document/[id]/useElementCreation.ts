import { type Dispatch, type SetStateAction } from 'react';
import {
  applyShapeVariant,
  createShape,
  createText,
  type BoxedElement,
  type Element,
  type SelectionMode,
  type ShapeKind,
  type Tab,
  isWallPiece,
  snapDoorToWall,
} from '@livehuddle/document';
import { withPlacingFacing } from '@/lib/placing-facing';
import { buildDrawnBoxed } from '@/lib/draw-commit';
import { getSticker, stickerDropSize } from '@liveworkspace/workbench/lib/stickers';
import { track, titleCaseType } from '@/lib/telemetry';
import type { AddShapeOptions, PendingDraw } from '@/lib/draw-mode';

type SetState<T> = Dispatch<SetStateAction<T>>;

// Palette element-creation handlers, lifted out of editor-page.tsx. Nearly
// every element arms the combined add gesture (beginDraw, from
// useShapeDrawing) — the canvas then drops it at default size on a tap or
// sizes it on a drag (docs/specs/008-canvas/canvas-and-palette.md "Placement on add").

export function useElementCreation(opts: {
  editsBlocked: boolean;
  // Whether image placement is unavailable (embed chrome — see
  // useEditorImages for why uploads stay off there). Gates addImage only.
  imagesBlocked: boolean;
  activeId: string;
  activeTab: Tab;
  commitTabs: (updater: (tabs: Tab[]) => Tab[]) => void;
  setSelectedId: SetState<string | null>;
  setEditingId: SetState<string | null>;
  addBoxedAt: <T extends BoxedElement>(
    canvasX: number,
    canvasY: number,
    make: (x: number, y: number) => T,
    opts?: {
      edit?: boolean;
      style?: <E extends BoxedElement>(el: E) => E;
      variant?: string;
    },
  ) => void;
  beginDraw: (intent: PendingDraw) => void;
  // Style memory (docs/specs/008-canvas/quick-style-panel.md) for the user-drawn adds made here: a palette
  // drop.
  styleNewElement: <T extends Element>(el: T) => T;
}) {
  const {
    editsBlocked,
    imagesBlocked,
    activeId,
    activeTab,
    commitTabs,
    setSelectedId,
    setEditingId,
    addBoxedAt,
    beginDraw,
    styleNewElement,
  } = opts;

  // Telemetry for these arming handlers fires on commit (see
  // useShapeDrawing.commitDraw), once the tap / drag actually lands the
  // element — not here, where the gesture is only queued.
  // `opts` carries a creation-time choice for the kinds that have one: which
  // mode (docs/specs/009-elements/mode-button.md). The palette offers a
  // tile per choice, so it has to survive the draw gesture and land on the
  // element rather than leaving the factory default in place.
  const addShape = (kind: ShapeKind, opts?: AddShapeOptions) => {
    if (editsBlocked) return;
    beginDraw({
      type: 'shape',
      kind,
      ...(opts?.mode ? { mode: opts.mode } : {}),
      ...(opts?.variant ? { variant: opts.variant } : {}),
      ...(opts?.name ? { name: opts.name } : {}),
    });
  };

  // Sticker (docs/specs/010-palette/stickers.md). Its own shape kind: a sticker never becomes another
  // element's inline glyph, it lands as a sticker wherever it is dropped.
  // Telemetry fires on commit (see useShapeDrawing.commitDraw).
  const addSticker = (stickerId: string) => {
    if (editsBlocked) return;
    beginDraw({ type: 'shape', kind: 'sticker', stickerId });
  };

  // A link-card / bookmark (docs/specs/009-elements/link-cards.md), drawn to size. The card starts empty
  // ("double-click to add a link"); double-clicking opens the link picker,
  // and setting a URL unfurls a preview.
  const addLinkCard = () => {
    if (editsBlocked) return;
    beginDraw({ type: 'link-card' });
  };

  // An empty image placeholder (docs/specs/009-elements/images.md), drawn to size. Lives here rather
  // than in useEditorImages (which owns the picker, the gallery, and the
  // fill/clear mutators) because arming a draw needs `beginDraw`, and that
  // hook runs before useShapeDrawing. The picker opens on commit, once the
  // user has already said where the image goes and how big it is.
  // `imagesBlocked` covers the embed case: uploads authorise by owner, and a
  // partitioned third-party iframe is a throwaway guest (see useEditorImages).
  const addImage = () => {
    if (editsBlocked || imagesBlocked) return;
    beginDraw({ type: 'image' });
  };

  // Components (docs/specs/008-canvas/canvas-and-palette.md) arm the combined tap-or-drag draw gesture, exactly
  // like shapes: a tap drops the composite at its natural size on the tap
  // point, a drag scales the whole group to the dragged box. The build (theme
  // colours, group assembly, scaling) + telemetry happen on commit in
  // useShapeDrawing.commitDraw, so these are thin "arm the intent" wrappers.
  // Avatar rides the same gesture though it lives in the Tools tab (it's a
  // single circular image, not a composite — see addAvatar / the palette).
  const addAvatar = () => {
    if (editsBlocked) return;
    beginDraw({ type: 'component', kind: 'avatar' });
  };

  const addText = () => {
    if (editsBlocked) return;
    beginDraw({ type: 'text' });
  };
  const addSticky = () => {
    if (editsBlocked) return;
    beginDraw({ type: 'sticky' });
  };

  // Drag-from-palette drop (docs/specs/008-canvas/canvas-and-palette.md): place the dragged kind centred on the
  // drop point. Shapes / devices use createShape; a sticker carries `stickerId`
  // (docs/specs/010-palette/stickers.md). No icon arrives: livehuddle offers none to drag.
  const dropPaletteItem = (
    kind: ShapeKind | 'sticky',
    canvasX: number,
    canvasY: number,
    art?: { iconId?: string; stickerId?: string; choice?: string },
  ) => {
    if (editsBlocked) return;
    const stickerId = art?.stickerId;
    if (kind === 'sticky') {
      // A dragged sticky lands exactly like a tapped one (the drop point is
      // the only difference), so it goes through the same builder. placeBoxed re-centres and leaves sticky
      // colours alone.
      addBoxedAt(
        canvasX,
        canvasY,
        (x, y) => buildDrawnBoxed({ type: 'sticky' }, x, y, x, y, null, activeTab),
        { edit: true },
      );
      track('Element', 'Added', 'Sticky');
      return;
    }
    if (stickerId) {
      // A dragged sticker lands at its flavour's natural size, square to the
      // canvas, exactly like a tapped one — the drop point is the only
      // difference.
      addBoxedAt(
        canvasX,
        canvasY,
        (x, y) => {
          const el = createShape('sticker', x, y);
          const size = stickerDropSize(getSticker(stickerId), el);
          return { ...el, ...size, stickerId };
        },
        { style: styleNewElement },
      );
      track('Element', 'Added', 'Sticker');
      return;
    }
    addBoxedAt(
      canvasX,
      canvasY,
      (x, y) =>
        // A piece that turns lands the way Space turned it while it was dragged
        // (docs/specs/009-elements/furniture-facing.md "Turning while placing").
        withPlacingFacing({
          // A creation-time variant (the Callout card, a Funnel) applies to its own kind only.
          ...applyShapeVariant(createShape(kind, x, y), art?.choice),
          // The dragged tile's creation-time choice (docs/specs/009-elements/mode-button.md, /105, /123,
          // /135). Applied by the kind that owns the field, so one payload
          // serves all four without the drop path knowing which is which.
          ...(art?.choice && kind === 'mode-button' ? { mode: art.choice as SelectionMode } : {}),
        }),
      // Shapes and icons open for typing too; takesTypedLabel filters out the
      // kinds whose face isn't text (stickers, reaction pads, ...). A preset's own colour (the Warning badge's
      // rose) is put back after the theme and the remembered style.
      {
        edit: true,
        // A room preset's tile (the Restroom) brings its pieces with the Room.
        variant: art?.choice,
        style: (el) => {
          const styled = styleNewElement(el);
          // A dropped door or window lands on the nearest wall (docs/specs/009-elements/room-builder.md "Door",
          // "Window").
          const placed = isWallPiece(styled) ? snapDoorToWall(styled, activeTab.elements) : styled;
          return placed as typeof el;
        },
      },
    );
    track('Element', 'Added', titleCaseType(kind));
  };

  const handleCanvasDoubleClick = (x: number, y: number) => {
    // Same creation gate as every other add path (addShape, addSticker, ...):
    // a loading tab or a view-only session silently no-ops.
    if (editsBlocked) return;
    const TEXT_W = 160;
    const TEXT_H = 48;
    const el = createText(x - TEXT_W / 2, y - TEXT_H / 2);
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId ? { ...t, elements: [...t.elements, el], templateChosen: true } : t,
      ),
    );
    setSelectedId(el.id);
    setEditingId(el.id);
    // Double-clicking empty canvas is a first-class "make a Text element"
    // path, same as the quick-connect "add text" action — count it so it
    // isn't invisible to the Element/Added dashboard (docs/specs/017-telemetry/telemetry.md).
    track('Element', 'Added', 'Text');
  };

  return {
    addShape,
    addSticker,
    addLinkCard,
    addImage,
    addAvatar,
    dropPaletteItem,
    addText,
    addSticky,
    handleCanvasDoubleClick,
  };
}
