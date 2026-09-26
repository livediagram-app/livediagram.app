import type { EmbedProvider, EventStormingNoteKind } from '@livediagram/diagram';
import type { ShapeKind } from '@livediagram/diagram';
import type { PendingDraw } from '@/lib/draw-mode';
import type { UserPreferences } from '@/lib/user-preferences';
import type { PaletteTint } from '@/components/palette/palette-controls';
import type { EsBoardControls } from '@/components/palette/EventStormingBoardRows';
import type { MovablePanelDockProps } from '@/components/primitives/MovablePanel';
import type { DockAnchor } from '@/lib/canvas-chrome';

export type CanvasTool =
  | 'pan'
  | 'select'
  | 'laser'
  | 'spotlight'
  // Avatar mode (docs/specs/008-canvas/avatar-mode.md): a walking pixel character, read-only canvas.
  | 'avatar'
  | 'eraser'
  | 'format'
  | 'isometric'
  // The marker (docs/specs/008-canvas/highlighter.md): a persistent drawing mode, not a one-shot arm.
  | 'highlighter'
  // Slide Deck (docs/specs/012-collaboration/presentation-mode.md): opens the panel where a deck is built and started.
  // Picking the tool does NOT start presenting; Start is a deliberate second
  // act. Deliberately absent from SELECTION_MODES: there is no Mode Button
  // for it, because handing somebody else's screen into a full-screen deck is
  // not something one person should do to another.
  | 'slide-deck';

export type CommandPaletteProps = {
  position: { x: number; y: number } | null;
  canvasTool: CanvasTool;
  onSetCanvasTool: (tool: CanvasTool) => void;
  // Leaves Avatar mode (docs/specs/008-canvas/avatar-mode.md) for whichever tool preceded it. Fired when
  // the user picks any palette tile while walking, so the add lands instead of
  // being swallowed by the read-only canvas. Omit outside the editor.
  onExitAvatarMode?: () => void;
  // Enter zen mode (docs/specs/007-editor/zen-mode.md), offered as a Zen entry in the canvas-tool
  // dropdown under Isometric. An action, not a tool: firing it leaves the
  // current tool selected. Omit to hide the entry; exit stays on the zoom
  // dock (the only chrome left in zen).
  onToggleZen?: () => void;
  onMoveTo: (x: number, y: number) => void;
  onReset: () => void;
  // Desktop panel-layout toggle (normal floating panels <-> minimal compact
  // dock), rendered in the palette header left of the reset button. Omit to
  // hide it (e.g. view-role). The Settings dialog carries the same switch as
  // the always-available way back out of minimal mode.
  minimalPanels?: boolean;
  onToggleMinimalPanels?: () => void;
  // User preferences + a write-through setter, for the Palette settings
  // popover (gear in the header, left of reset). Holds the canvas-behaviour
  // toggles (auto-attach arrows, alignment guides) that used to live in the
  // Settings dialog. See docs/specs/007-editor/user-preferences.md.
  settings: UserPreferences;
  onChangeSettings: (next: UserPreferences) => void;
  // True when the active tab has no elements. Disables the canvas tools that
  // need existing content (Eraser / Format / Laser / Spotlight / Isometric).
  canvasEmpty?: boolean;
  // `opts` carries the creation-time choice for the kinds that have one
  // (docs/specs/012-collaboration/session-button.md session tools, docs/specs/009-elements/reaction-pad.md reactions), so a tile per choice places
  // that choice rather than the factory default.
  onAddShape: (
    kind: ShapeKind,
    opts?: {
      session?: import('@livediagram/diagram').SessionTool;
      reaction?: import('@livediagram/diagram').Reaction;
      mode?: import('@livediagram/diagram').SelectionMode;
      estimateScale?: import('@livediagram/diagram').EstimateScale;
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
  // Optional fill + kind: an Event Storming note (docs/specs/021-event-storming/event-storming.md).
  onAddSticky: (fill?: string, esKind?: EventStormingNoteKind) => void;
  // True when the active tab is an event-storming board (docs/specs/021-event-storming/event-storming.md): the
  // palette then opens on the Event Storming category instead of
  // Favourites — the notation is what the board is for.
  esBoard?: boolean;
  // Board-level switches shown above the notation on one of those boards
  // (docs/specs/021-event-storming/event-storming.md Phase 6: timeline lanes). Omitted everywhere else.
  esBoardControls?: EsBoardControls;
  // Drop a 3x3 editable table at the viewport centre.
  onAddTable: () => void;
  // Drop a note marker (annotation) at the viewport centre. See docs/specs/009-elements/annotations.md.
  onAddAnnotation: () => void;
  // Drop a link-card / bookmark at the viewport centre. See docs/specs/009-elements/link-cards.md.
  onAddLinkCard: () => void;
  onAddVideo: (provider?: EmbedProvider) => void;
  // Composite "Components" (docs/specs/008-canvas/canvas-and-palette.md): each arms the tap-or-drag draw gesture.
  // Banner / Callout / Stat row / Process need no image and always show; Hero
  // / Header (and the Tools-tab Avatar) carry an image, so they're gated on
  // image upload being available (onAddImage present).
  onAddBanner: () => void;
  onAddHero: () => void;
  onAddHeader: () => void;
  onAddCallout: () => void;
  onAddStatRow: () => void;
  onAddProcess: () => void;
  onAddAvatar: () => void;
  // Spawn an image placeholder + open the picker. Optional so
  // deployments without R2 (or view-role visitors) can omit it; the
  // Image palette entry hides when the handler is missing. See
  // docs/specs/009-elements/images.md.
  onAddImage?: () => void;
  // Drops a horizontal arrow at the viewport centre with no pointers
  // on either end by default (i.e. a plain line). Users can flip the
  // arrowEnds afterwards via the Pointer accordion.
  onAddArrow: () => void;
  // Pencil tool: enters one-shot freehand draw mode. Unlike the
  // other add-element callbacks, this never drops at the viewport
  // centre, the pencil is gestural by design. See docs/specs/008-canvas/canvas-and-palette.md Pencil
  // (freehand) subsection.
  onBeginFreehand: () => void;
  // Highlighter (docs/specs/008-canvas/highlighter.md): the pencil gesture with the marker
  // variant. Same one-shot arm semantics as onBeginFreehand.
  onBeginShapePen: () => void;
  // Polygon tool (docs/specs/008-canvas/polygon-tool.md): arms the click-to-place-vertices mode.
  onBeginPolygon: () => void;
  // Currently-queued draw-to-size intent, or null. When set, the
  // matching palette button (shape, text, sticky, image, arrow)
  // renders pressed so the user can see what's queued for the next
  // canvas drag. Only populated when user-preferences.drawToAdd is
  // on; otherwise null and no button shows the pressed treatment.
  pendingDraw?: PendingDraw | null;
  // Optional callback fired with the palette's current bounding box
  // whenever it changes (via MovablePanel's ResizeObserver). Canvas
  // wires this up so the Comments + AI panels can stack below the
  // palette as it changes height.
  onSize?: (size: { width: number; height: number; bottomY: number }) => void;
  // Mobile-only top override (the palette banner sits below the
  // Explorer banner so signed-out users can switch diagrams without
  // leaving the canvas). See MovablePanel for semantics.
  mobileTopOverridePx?: number;
  // Mobile dock control — forwarded to the inner MovablePanel.
  mobileOpenOverride?: boolean;
  onMobileClose?: () => void;
  // Fired when a draw-to-place tool (shape / text / sticky / arrow /
  // freehand) is armed FROM the palette in dock mode, so the parent can
  // reopen the palette once the draw finishes.
  onDrawArmed?: () => void;
  mobileDockAnchor?: DockAnchor;
  forceDockMode?: boolean;
  // Active tab theme's element colours, so the palette tiles preview the
  // theme: shape / device / annotation tiles render filled in the theme's
  // fill + stroke, line-art tools + icons tint to the stroke. Undefined (the
  // Default theme) leaves the palette in its default slate look. See docs/specs/008-canvas/canvas-and-palette.md.
  themeTint?: PaletteTint;
  // Corner-docking bundle (docs/specs/007-editor/panel-docking.md), forwarded to the inner MovablePanel.
  dock?: MovablePanelDockProps;
};
