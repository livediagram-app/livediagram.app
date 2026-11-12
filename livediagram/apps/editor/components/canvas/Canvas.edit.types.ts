import type { PointerEvent as ReactPointerEvent } from 'react';
import type { FrameHandle } from '@livediagram/document';
import type { IconPosition, TextAlignX, TextAlignY, TextRun } from '@livediagram/document';
import type { ArrowEnd, DragMode } from '@/lib/canvas';

// The Canvas's element editing props (CanvasProps in Canvas.types.ts is the whole contract): drags, label
// and table commits, the arrow handles, and the per-kind setters an element's face calls.
export type CanvasEditProps = {
  onBeginDrag: (id: string, mode: DragMode, e: ReactPointerEvent) => void;
  // The armed action a press on an element takes instead of selecting it (an arrow armed to connect, the
  // format painter): true when it took it. For a touch press that panned instead of dragging, whose tap
  // must still connect or paint (docs/specs/008-canvas/canvas-and-palette.md "Touch (iOS / iPad)").
  onPressArmedAction?: (id: string) => boolean;
  onBeginEdit: (id: string) => void;
  onCommitLabel: (id: string, label: string, runs?: TextRun[]) => void;
  // Inline label-editor (rich-text) alignment control, threaded through
  // CanvasElementsLayer to the in-place editor on the selected element.
  onSetTextAlign: (x: TextAlignX, y: TextAlignY) => void;
  // Single combined table commit (cells + the parallel colWidths /
  // rowHeights / cellStyles arrays) applied in ONE commit, so structural
  // ops can't drop a side array or clobber each other off a stale base.
  // A lane's title gutter, resized by dragging its seam (docs/specs/009-elements/lane.md). One
  // commit per gesture, so a drag is one undo step.
  onCommitHeaderSize?: (elementId: string, px: number) => void;
  onCommitTable: (
    id: string,
    patch: Partial<
      Pick<
        import('@livediagram/document').TableElement,
        'cells' | 'colWidths' | 'rowHeights' | 'cellStyles'
      >
    >,
  ) => void;
  onCancelEdit: () => void;
  // Table quick-connect ring (docs/specs/008-canvas/canvas-and-palette.md): append a row / column to the
  // selected table from the bottom / right plus.
  onAddTableRow: () => void;
  onAddTableColumn: () => void;
  // Toggle one checklist row's done state (docs/specs/009-elements/checklist.md). Omitted in read-only.
  onToggleChecklistItem?: (elementId: string, index: number) => void;
  // Entities (docs/specs/009-elements/entity.md): fields saved in place, relationships drawn from a field,
  // the ring's Add Field / Add Related Entity and the arrow toolbar's Cardinality. Omitted in read-only.
  entityActions?: import('@/hooks/canvas/useEntityActions').EntityActions;
  // The Page masthead (docs/specs/009-elements/page-element.md): its heading and subtitle are their own
  // fields, so they commit through here rather than the label editor.
  // Mind map (docs/specs/009-elements/mind-node.md): grows the next node from the label editor.
  onGrowMindNode: (id: string, kind: 'child' | 'sibling') => void;
  // Flowchart (docs/specs/009-elements/flowchart.md): a step's type and lane from its toolbar. An
  // Editor's only, so absent for anyone else (who still grows a chart through onGrowMindNode).
  flowchartActions?: import('@/hooks/canvas/useFlowchartSetters').FlowchartActions;
  // Edit Outline (docs/specs/009-elements/mind-node.md): whether `id` is a root whose outline may be
  // edited, and opening it.
  canEditMindOutline?: (id: string) => boolean;
  onEditMindOutline?: (id: string) => void;
  // Tidy Map on the map `id` belongs to (the badge on a map's root).
  onTidyMindMap?: (id: string) => void;
  // Escape on the empty node a Tab made one time too many removes it.
  onAbandonMindNode: (id: string) => boolean;
  onSetPageHeading: (elementId: string, field: 'pageTitle' | 'pageSubtitle', value: string) => void;
  // The web components (docs/specs/009-elements/web-components-and-no-groups.md): a row edited in place, one more row from
  // the quick-connect ring, and a hero's caption line. Omitted in read-only.
  onSetWebRows?: (elementId: string, rows: import('@livediagram/document').WebRows) => void;
  // A pointer note's tip let go at a canvas point (docs/specs/009-elements/pointer-note.md). Omitted in read-only.
  onSetPointerTip?: (elementId: string, tipAbs: { x: number; y: number }) => void;
  onAppendWebRow?: (elementId: string) => void;
  onSetHeroCaptionLine?: (
    elementId: string,
    field: keyof import('@livediagram/document').HeroCaption,
    value: string,
  ) => void;
  // Default chart slice colours derived from the active theme (docs/specs/009-elements/pie-chart.md), used
  // by pie charts for slices without an explicit colour.
  chartPalette: readonly string[];
  onBeginEndpointDrag: (arrowId: string, end: ArrowEnd, e: ReactPointerEvent) => void;
  onBeginArrowCurveDrag: (arrowId: string, e: ReactPointerEvent) => void;
  onBeginArrowCurvePointDrag: (arrowId: string, index: number, e: ReactPointerEvent) => void;
  onBeginArrowBend: (arrowId: string, e: ReactPointerEvent<SVGElement>) => void;
  // Scale a selected free arrow from its frame handles (docs/specs/008-canvas/arrow-bending.md).
  onBeginArrowScale: (arrowId: string, handle: FrameHandle, e: ReactPointerEvent) => void;
  onDeleteCurvePoint: (arrowId: string, index: number) => void;
  onBeginArrowElbowDrag: (arrowId: string, e: ReactPointerEvent) => void;
  onBeginArrowLabelDrag: (arrowId: string, e: ReactPointerEvent) => void;
  onBeginArrowTranslate: (arrowId: string, e: ReactPointerEvent) => void;
  onShiftSelect: (id: string) => void;
  // Wrap up the Format canvas tool (the palette tool): drops back to the
  // tool active before it. Drives the format-tool mode banner's "Done" button.
  onExitFormatTool: () => void;
  onFollowLink: (link: import('@livediagram/document').ElementLink) => void;
  onOpenComments: (elementId: string) => void;
  // Open the element's assigned-action popover (docs/specs/012-collaboration/assigned-actions.md). Available in
  // read-only sessions too, visitors may read an action; the popover
  // gates its mutations itself.
  onOpenAction: (elementId: string) => void;
  onOpenNote?: (elementId: string) => void;
  // Drop a palette icon onto a shape: set its inline iconId and the
  // position (which side of the text) derived from where it was dropped.
  // Optional so read-only / pre-identity Canvas mounts can omit it.
  onDropIcon?: (elementId: string, iconId: string, position: IconPosition) => void;
  // Open the link picker for a specific table cell. Optional so read-
  // only / pre-identity Canvas mounts can omit it.
  onLinkCell?: (tableId: string, r: number, c: number) => void;
  // Open the link picker for a link-card element (docs/specs/009-elements/link-cards.md), on double-click.
  // Omitted for read-only viewers.
  onEditLink?: (id: string) => void;
  // Open an element's own edit dialog on double-click: a code block's code (docs/specs/009-elements/code-block.md),
  // a Sankey's flows (docs/specs/009-elements/sankey.md). Omitted for read-only viewers.
  onOpenEditDialog?: (id: string) => void;
  // Per-render context for image elements: identity + auth bits the
  // ImageElementView needs to fetch bitmap bytes. Optional so the
  // welcome / new-document surface (where Canvas mounts before
  // identity / share-code are settled) can omit it.
  imageContext?: {
    ownerId: string;
    documentId: string;
    shareCode: string | null;
    onOpenPicker?: (elementId: string) => void;
  };
  // Touch-friendly fallback for right-click: a SelectionPopover
  // ellipsis button opens the same context menu under the cursor.
  onOpenElementContextMenu?: (elementId: string, screenX: number, screenY: number) => void;
};
