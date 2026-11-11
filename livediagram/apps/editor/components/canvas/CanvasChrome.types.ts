import type { MarqueeState } from '@liveworkspace/workbench/components/canvas/MarqueeRect';
import type { ReadableStore } from '@liveworkspace/workbench/lib/state-store';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { DockAnchor, DockPanel } from '@/hooks/canvas/useDockPopovers';
import type { StampGhost } from '@/components/canvas/useStampGhost';

// CanvasChrome's prop contract, split out of CanvasChrome.tsx (which re-exports it).
// Values the Canvas computes (selection projection + layout/dock/zoom
// state) and threads into the chrome alongside its own props.
type ChromeExtras = {
  // The canvas <main>'s measured size (the Map's current-view window reads it; see Minimap.tsx).
  mainSize: { width: number; height: number };
  // True when every element has scrolled out of view: show the nudge above
  // the Fit button (useOffscreenContent in Canvas).
  offscreenContent: boolean;
  // The sweep's rect, read only by the marquee rectangle (docs/specs/008-canvas/canvas-performance.md).
  marquee: ReadableStore<MarqueeState | null>;
  drawDrag: { startX: number; startY: number; currentX: number; currentY: number } | null;
  // Snapped pointer position while a draw is armed but not yet started
  // (pre-press start-snap preview); null when not armed / not snapped.
  drawHover: { x: number; y: number } | null;
  // The armed fixed-size note's ghost (docs/specs/021-event-storming/event-storming.md Phase 4).
  stamp: StampGhost | null;
  penPoints: { x: number; y: number }[] | null;
  // Polygon tool in-flight state (docs/specs/008-canvas/polygon-tool.md): the placed vertices and
  // the live rubber-band cursor position, both canvas coords.
  polygonVertices: { x: number; y: number }[];
  polygonCursor: { x: number; y: number } | null;
  wrapperRef: RefObject<HTMLDivElement | null>;
  activeDockPanel: DockPanel | null;
  setActiveDockPanel: Dispatch<SetStateAction<DockPanel | null>>;
  activeDockAnchor: DockAnchor | null;
  setActiveDockAnchor: Dispatch<SetStateAction<DockAnchor | null>>;
  handleDockButtonClick: (id: DockPanel, button: HTMLElement, above?: boolean) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleSetZoom: (zoom: number) => void;
  // Begin an isometric orbit drag from the given screen coordinates
  // (wired to `isoCamera.startOrbit`). Drives the dock orbit button,
  // which only renders while the isometric tool is active.
  onIsoOrbit: (clientX: number, clientY: number) => void;
  // Reset the isometric camera to its default angle (wired to
  // `isoCamera.reset`), fired when the dock orbit button is clicked.
  onIsoReset: () => void;
  // Laser Panel (docs/specs/008-canvas/laser-panel.md): the pen, owned by useLaserConfig in Canvas (it
  // persists per browser) and edited down here.
  laserConfig?: import('@/lib/laser-config').LaserConfig;
  onChangeLaserField?: <K extends keyof import('@/lib/laser-config').LaserConfig>(
    field: K,
    value: import('@/lib/laser-config').LaserConfig[K],
  ) => void;
  laserPanelPosition?: { x: number; y: number } | null;
  onMoveLaserPanel?: (x: number, y: number) => void;
  onResetLaserPanel?: () => void;
  // Spotlight Panel (docs/specs/008-canvas/spotlight-panel.md): the light's look, owned by useSpotlightConfig
  // in Canvas, plus the live radius the canvas clicks also change.
  spotlightConfig?: import('@liveworkspace/workbench/lib/spotlight-config').SpotlightConfig;
  onChangeSpotlightField?: <
    K extends keyof import('@liveworkspace/workbench/lib/spotlight-config').SpotlightConfig,
  >(
    field: K,
    value: import('@liveworkspace/workbench/lib/spotlight-config').SpotlightConfig[K],
  ) => void;
  spotlightRadius?: number;
  onSetSpotlightRadius?: (radius: number) => void;
  spotlightPanelPosition?: { x: number; y: number } | null;
  onMoveSpotlightPanel?: (x: number, y: number) => void;
  onResetSpotlightPanel?: () => void;
  // Eraser Panel (docs/specs/008-canvas/eraser-panel.md): the brush's settings, owned by useEraserConfig in
  // Canvas (the erase gesture reads it too).
  eraserConfig?: import('@/lib/eraser-config').EraserConfig;
  onChangeEraserField?: <K extends keyof import('@/lib/eraser-config').EraserConfig>(
    field: K,
    value: import('@/lib/eraser-config').EraserConfig[K],
  ) => void;
  eraserPanelPosition?: { x: number; y: number } | null;
  onMoveEraserPanel?: (x: number, y: number) => void;
  onResetEraserPanel?: () => void;
  // Slide Deck panel (docs/specs/012-collaboration/presentation-mode.md): the sixth tool panel.
  slideDeckPanelPosition?: { x: number; y: number } | null;
  onMoveSlideDeckPanel?: (x: number, y: number) => void;
  onResetSlideDeckPanel?: () => void;
  slideDeck?: import('@/app/document/[id]/useSlideDeck').SlideDeckState;
  // Format Panel (docs/specs/008-canvas/format-panel.md): what the painter copies, owned in editor state
  // (the paint lives there), plus a description of the loaded element.
  formatConfig?: import('@liveworkspace/workbench/lib/format-config').FormatConfig;
  onToggleFormatGroup?: (
    group: import('@liveworkspace/workbench/lib/format-config').FormatGroup,
  ) => void;
  onSetFormatMode?: (mode: import('@liveworkspace/workbench/lib/format-config').FormatMode) => void;
  formatBrushSource?: import('@/components/panels/FormatPanel').FormatBrushSource | null;
  formatPanelPosition?: { x: number; y: number } | null;
  onMoveFormatPanel?: (x: number, y: number) => void;
  onResetFormatPanel?: () => void;
};

export type CanvasChromeProps = CanvasProps & ChromeExtras;
