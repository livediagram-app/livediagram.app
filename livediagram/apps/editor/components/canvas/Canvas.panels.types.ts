import type { TidyUpActions } from './tidy-up-actions';
import type { Layer } from '@livediagram/document';

// The Canvas's floating panel props (CanvasProps in Canvas.types.ts is the whole contract): the laser,
// spotlight, eraser, format and slide deck panels, the Map, the Layers popover and the theme button.
export type CanvasPanelProps = {
  // The laser pen (docs/specs/008-canvas/spotlight-panel.md). Owned in editor state, not here: the broadcaster
  // stamps it onto every sample and the trail rows carry it, both of which sit
  // above Canvas, so Canvas forwards it to the panel rather than owning it.
  laserConfig?: import('@/lib/laser-config').LaserConfig;
  onChangeLaserField?: <K extends keyof import('@/lib/laser-config').LaserConfig>(
    field: K,
    value: import('@/lib/laser-config').LaserConfig[K],
  ) => void;
  // Laser Panel (docs/specs/008-canvas/spotlight-panel.md): where it sits.
  laserPanelPosition?: { x: number; y: number } | null;
  onMoveLaserPanel?: (x: number, y: number) => void;
  onResetLaserPanel?: () => void;
  // Spotlight Panel (docs/specs/008-canvas/spotlight-panel.md): where it sits.
  spotlightPanelPosition?: { x: number; y: number } | null;
  onMoveSpotlightPanel?: (x: number, y: number) => void;
  onResetSpotlightPanel?: () => void;
  // The eraser's settings (docs/specs/008-canvas/eraser-panel.md). Owned in editor state, where the erase
  // gesture lives; Canvas forwards them to the panel.
  eraserConfig?: import('@/lib/eraser-config').EraserConfig;
  onChangeEraserField?: <K extends keyof import('@/lib/eraser-config').EraserConfig>(
    field: K,
    value: import('@/lib/eraser-config').EraserConfig[K],
  ) => void;
  // The format painter's settings (docs/specs/008-canvas/format-panel.md) and what its brush holds. Owned
  // in editor state, where the paint happens; Canvas forwards them.
  formatConfig?: import('@liveworkspace/workbench/lib/format-config').FormatConfig;
  onToggleFormatGroup?: (
    group: import('@liveworkspace/workbench/lib/format-config').FormatGroup,
  ) => void;
  onSetFormatMode?: (mode: import('@liveworkspace/workbench/lib/format-config').FormatMode) => void;
  formatBrushSource?: import('@/components/panels/FormatPanel').FormatBrushSource | null;
  formatPanelPosition?: { x: number; y: number } | null;
  onMoveFormatPanel?: (x: number, y: number) => void;
  onResetFormatPanel?: () => void;
  // Eraser Panel (docs/specs/008-canvas/eraser-panel.md): where it sits.
  eraserPanelPosition?: { x: number; y: number } | null;
  onMoveEraserPanel?: (x: number, y: number) => void;
  onResetEraserPanel?: () => void;
  // Slide Deck panel (docs/specs/012-collaboration/presentation-mode.md): the deck builder, present only while its tool
  // is picked. The deck itself rides `slideDeck`.
  slideDeckPanelPosition?: { x: number; y: number } | null;
  onMoveSlideDeckPanel?: (x: number, y: number) => void;
  onResetSlideDeckPanel?: () => void;
  slideDeck?: import('@/app/document/[id]/useSlideDeck').SlideDeckState;
  // Map panel (docs/specs/008-canvas/minimap.md) position + move/reset, shared with the other panels.
  mapPosition: { x: number; y: number } | null;
  onMoveMap: (x: number, y: number) => void;
  onResetMap: () => void;
  // Layers panel (docs/specs/006-document/layers.md). `layers` is the NORMALISED stack (bottom ->
  // top, never empty) the panel renders; `tabLayers` above stays the raw
  // field for the render-order helpers. A popover over its bottom-right
  // cluster button.
  layers: Layer[];
  activeLayerId: string;
  layerCounts: Map<string, number>;
  // Bottom-dock "Theme & canvas" button (docs/specs/011-theme/canvas-and-theme-dialog.md): opens the
  // CanvasThemeDialog. Omitted in read-only / embed sessions (no button).
  onOpenCanvasTheme?: () => void;
  // The CanvasThemeDialog is open: the button reads as expanded, so the guest sign-in banner steps aside for it.
  canvasThemeOpen?: boolean;
  // Diagram mode's Tidy Up button and popover (docs/specs/008-canvas/layout-cleanup.md "The Tidy Up
  // button"). Absent in a session that may not tidy (a Participant, a Viewer, an embed): no button.
  tidyUp?: TidyUpActions;
  onSelectLayer: (layerId: string) => void;
  onAddLayer: () => void;
  onRemoveLayer: (layerId: string) => void;
  onRenameLayer: (layerId: string, name: string) => void;
  onToggleLayerVisibility: (layerId: string) => void;
  onToggleLayerLock: (layerId: string) => void;
  onReorderLayer: (layerId: string, toIndex: number) => void;
  onMergeLayer: (direction: 'above' | 'below') => void;
  onSetLayerOpacity: (layerId: string, opacity: number) => void;
  onClearLayer: (layerId: string) => void;
  onHideOtherLayers: (layerId: string) => void;
  // Hover-to-solo (docs/specs/006-document/layers.md): while set, the canvas renders ONLY this
  // layer. Driven by hovering a Layers-panel row; pure view state.
  layerPreviewId: string | null;
  onPreviewLayer: (layerId: string | null) => void;
};
