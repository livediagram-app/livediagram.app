import type { EmbedProvider } from '@liveplanner/project';
import type { ShapeKind } from '@liveplanner/project';
import type { PendingDraw } from '@/lib/draw-mode';
import type { PaletteTint } from '@/components/palette/palette-controls';

export type CanvasTool = 'pan' | 'select' | 'format' | 'isometric';

// The palette strip's inputs (docs/specs/007-editor/toolbar-layout.md): the canvas tool, the add
// handlers every tile calls, and the tab's state the tiles read.
export type PaletteProps = {
  canvasTool: CanvasTool;
  onSetCanvasTool: (tool: CanvasTool) => void;
  // Enter zen mode (docs/specs/007-editor/zen-mode.md), offered as a Zen entry in the canvas-tool
  // dropdown under Isometric. An action, not a tool: firing it leaves the
  // current tool selected. Omit to hide the entry; exit stays on the zoom
  // dock (the only chrome left in zen).
  onToggleZen?: () => void;
  // True when the active tab has no elements. Disables the canvas tools that
  // need existing content (Format / Isometric).
  canvasEmpty?: boolean;
  // `opts` carries the creation-time choice for the kinds that have one
  // (docs/specs/012-collaboration/session-button.md session tools), so a tile per choice places
  // that choice rather than the factory default.
  onAddShape: (
    kind: ShapeKind,
    opts?: {
      session?: import('@liveplanner/project').SessionTool;
      plan?: string;
      variant?: string;
    },
  ) => void;
  // Drops a curated icon glyph (shape kind 'icon') carrying the chosen
  // catalogue id at the viewport centre. Picked from the Icons
  // accordion's searchable grid.
  onAddIcon: (iconId: string) => void;
  // Sticker (docs/specs/010-palette/stickers.md) — its own element kind, so its own handler: unlike an
  // icon it never folds into the selected shape.
  onAddSticker: (stickerId: string) => void;
  // Drops a Technology (brand) icon (docs/specs/010-palette/technology-icons.md) as a STANDALONE 'icon'
  // element carrying the chosen tech-catalogue id. Picked from the
  // Technology tab's searchable grid; never dropped inside a shape.
  onAddTechIcon: (iconId: string) => void;
  onAddText: () => void;
  onAddSticky: () => void;
  // Drop a 3x3 editable table at the viewport centre.
  onAddTable: () => void;
  // Drop a note marker (annotation) at the viewport centre. See docs/specs/009-elements/annotations.md.
  onAddAnnotation: () => void;
  // Drop a link-card / bookmark at the viewport centre. See docs/specs/009-elements/link-cards.md.
  onAddLinkCard: () => void;
  onAddVideo: (provider?: EmbedProvider) => void;
  // Composite "Components" (docs/specs/008-canvas/canvas-and-palette.md): each arms the tap-or-drag draw gesture.
  onAddBanner: () => void;
  onAddHero: () => void;
  onAddHeader: () => void;
  onAddCallout: () => void;
  onAddStatRow: () => void;
  onAddProcess: () => void;
  onAddFlowchart: () => void;
  onAddAvatar: () => void;
  // Drops a horizontal arrow at the viewport centre with no pointers
  // on either end by default (i.e. a plain line). Users can flip the
  // arrowEnds afterwards via the Pointer accordion.
  // `ends`: the Arrow tool's pointer at its end by default, `'none'` for the Line tool.
  onAddArrow: (ends?: import('@liveplanner/project').ArrowEnds) => void;
  // Disarm the armed tool: its tile pressed again (docs/specs/008-canvas/canvas-and-palette.md "Placement on add").
  onCancelDraw?: () => void;
  // Polygon tool (docs/specs/008-canvas/polygon-tool.md): arms the click-to-place-vertices mode.
  onBeginPolygon: () => void;
  // Currently-queued draw-to-size intent, or null. When set, the
  // matching palette button (shape, text, sticky, image, arrow)
  // renders pressed so the user can see what's queued for the next
  // canvas drag. Only populated when user-preferences.drawToAdd is
  // on; otherwise null and no button shows the pressed treatment.
  pendingDraw?: PendingDraw | null;
  // Fired after a tile is used, so a surface that hangs the palette in a
  // popover (the Toolbar strip's More) can put it away.
  onTileUsed?: () => void;
  // Active tab theme's element colours, so the palette tiles preview the
  // theme: shape / device / annotation tiles render filled in the theme's
  // fill + stroke, line-art tools + icons tint to the stroke. Undefined (the
  // Default theme) leaves the palette in its default slate look. See docs/specs/008-canvas/canvas-and-palette.md.
  themeTint?: PaletteTint;
};
