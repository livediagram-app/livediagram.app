import type { LaneGutterEdge, LaneLike } from '@/components/canvas/LaneGutter';
import type { RemoteSelector } from '@/lib/presence-rows';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { BoxedElement, HeroCaption, TextRun, WebRows } from '@livehuddle/document';
import type { DragMode } from '@/lib/canvas';

export type BoxedElementViewProps = {
  element: BoxedElement;
  isSelected: boolean;
  // True when this element is part of an active marquee multi-selection.
  // Drives a louder selection ring (brand-500 instead of brand-200) so
  // it's obvious which elements are bundled into a multi-action like
  // Delete or Duplicate.
  isMultiSelected?: boolean;
  // A plain click (press and release, no drag) on this element while it is
  // selected, and the second press of a double-click that first deselected it:
  // the host applies the click rules (docs/specs/008-canvas/canvas-and-palette.md
  // "Selection", "Marquee box-select") against the whole selection.
  onPlainClick?: (id: string) => void;
  isEditing: boolean;
  // When the current edit session began via type-to-edit (docs/specs/008-canvas/canvas-and-palette.md), the
  // label was seeded with the first typed char and the editor should
  // place the caret at the end instead of selecting all.
  editCursorAtEnd?: boolean;
  isPaintMode: boolean;
  showHandles: boolean;
  showAnchors: boolean;
  onBeginDrag: (id: string, mode: DragMode, e: ReactPointerEvent) => void;
  // The armed action a tap takes instead of selecting (Canvas.types.ts): true when it took it.
  onPressArmedAction?: (id: string) => boolean;
  // Shift-click on an element fires this with the element id so the
  // page can toggle membership in the marquee multi-selection.
  onShiftSelect?: (id: string) => void;
  // Whole-layer opacity (docs/specs/006-document/layers.md), multiplied over the element's own
  // `opacity`. Undefined = 1 (kept undefined at full opacity so the
  // memoised view's props stay stable).
  layerOpacity?: number;
  // Element-id-bearing signatures so the parent can pass a single
  // stable callback per kind (rather than recreating a closure per
  // element on every render). The child has `element.id` in scope
  // and forwards it where needed. This is what makes the React.memo
  // wrapper around the export viable: with pre-bound callbacks,
  // every parent render would invalidate the memo via fresh function
  // identities.
  onBeginEdit: (id: string) => void;
  onCommitLabel: (id: string, label: string, runs?: TextRun[]) => void;
  // Whole-element alignment + padding setters, surfaced in the rich-text
  // edit toolbar (docs/specs/008-canvas/canvas-and-palette.md). They operate on the current selection (= the
  // editing element). Optional so read-only paths can omit them.
  onSetTextAlign?: (
    x: import('@livehuddle/document').TextAlignX,
    y: import('@livehuddle/document').TextAlignY,
  ) => void;
  // A lane's title gutter, resized by dragging its seam (docs/specs/009-elements/lane.md). One
  // commit per gesture, so a drag is one undo step.
  onCommitHeaderSize?: (elementId: string, px: number) => void;
  // Resolve a dragged lane seam against its snap targets (docs/specs/009-elements/lane.md): the
  // alignment grid, and the seams of other lanes so a stack of swimlanes can
  // be lined up exactly. Supplied by the elements layer, which is where the
  // sibling elements live.
  onSnapSeam?: (
    candidate: number,
    axis: 'x' | 'y',
    excludeId: string,
    edgeOf: (el: LaneLike) => LaneGutterEdge,
    sizeOf: (el: LaneLike) => number,
  ) => number;
  onCommitTable: (
    id: string,
    patch: Partial<
      Pick<
        import('@livehuddle/document').TableElement,
        'cells' | 'colWidths' | 'rowHeights' | 'cellStyles'
      >
    >,
  ) => void;
  // Theme-derived default slice colours for pie charts (docs/specs/009-elements/pie-chart.md).
  chartPalette?: readonly string[];
  onCancelEdit: () => void;
  onFollowLink: (link: import('@livehuddle/document').ElementLink) => void;
  // Press a Mode Button element (docs/specs/009-elements/mode-button.md): switches the LOCAL participant into
  // the mode the element carries. Optional — a surface that can't change tools
  // (the read-only embed) leaves the face inert.
  onPressModeButton?: (element: import('@livehuddle/document').ShapeElement) => void;
  // Bring Focus (docs/specs/012-collaboration/bring-focus.md): ask everyone else in the room to come and look at
  // this element. Absent on a surface with nobody to ask (an export, a solo
  // canvas), which renders the face inert.
  onPressFocusButton?: (element: import('@livehuddle/document').ShapeElement) => void;
  // The `…` on a Behaviours element's face opens that element's own context
  // menu beside it (docs/specs/008-canvas/canvas-and-palette.md), rather than a second copy of its settings form.
  onOpenElementSettings?: (elementId: string) => void;
  // Chair (docs/specs/009-elements/chair.md): who peer presence says is seated on this chair right
  // now. A function of the element id rather than a map prop so the common
  // case (no chairs on the tab) costs nothing. Occupancy is never in the
  // document, so a disconnected sitter vacates for free.
  chairSitters?: (
    elementId: string,
  ) => import('@/components/canvas/collab/FurnitureView').ChairSitter[];
  // The viewer's current mode, so a Selection Mode button offering it renders
  // disabled (docs/specs/009-elements/mode-button.md).
  activeMode?: import('@livehuddle/document').SelectionMode;
  // Portal (docs/specs/009-elements/portal-element.md): resolves a portal's pairing for the face — the paired portal's
  // name for the hover card, and the travel action (undefined when unpaired, so the
  // face renders inert and says why).
  onEnterPortal?: (element: import('@livehuddle/document').ShapeElement) => {
    targetName: string | null;
    travel?: () => void;
    // The Directory and the Elevator (docs/specs/009-elements/directory.md, elevator.md) read the canvas's
    // wayfinding through the same resolver: set for those two kinds, the same object every call.
    wayfinding?: import('@/components/canvas/wayfinding/wayfinding-store').Wayfinding;
  };
  // Avatar Pad (docs/specs/009-elements/avatar-pad.md "Pressing it"): starts the walk on the pressed pad.
  onPressAvatarPad?: (element: import('@livehuddle/document').ShapeElement) => void;
  onOpenComments: (id: string) => void;
  // Open the element's assigned-action popover (docs/specs/012-collaboration/assigned-actions.md). The badge only
  // renders while the element carries an OPEN action; everyone (including
  // view-role visitors) may open the popover, so this is not optional the
  // way onOpenNote is — mutations are gated inside the popover instead.
  onOpenAction: (id: string) => void;
  // Image element context: the editor passes these so the inner
  // ImageElementView can fetch the bitmap with the right
  // owner / share / document identity (the bytes are auth-gated by
  // the API, see docs/specs/009-elements/images.md). View-role visitors are still allowed to
  // see images; they just can't upload new ones via the picker.
  imageContext?: {
    ownerId: string;
    documentId: string;
    shareCode: string | null;
    onOpenPicker?: (elementId: string) => void;
  };
  // Open the per-element note popover. Optional so read-only viewers
  // (who shouldn't see a clickable badge) can omit it. When omitted
  // the note badge does not render.
  onOpenNote?: (id: string) => void;
  // Open the link picker for a link-card element (docs/specs/009-elements/link-cards.md), on double-click.
  // Omitted for read-only viewers.
  onEditLink?: (id: string) => void;
  // Open an element's own edit dialog on double-click: a code block's code (docs/specs/009-elements/code-block.md),
  // Omitted for read-only viewers.
  onOpenEditDialog?: (id: string) => void;
  // Toggle one checklist row's done state (docs/specs/009-elements/checklist.md), from the on-canvas
  // checkbox. Omitted for read-only viewers.
  onToggleChecklistItem?: (elementId: string, index: number) => void;
  // Held by a stack and not being dragged: glides to its slot when the stack reflows (docs/specs/009-elements/stack.md).
  stackGlide?: boolean;
  // The Page masthead (docs/specs/009-elements/page-element.md), and the banner / callout lines (docs/specs/009-elements/web-components-and-no-groups.md).
  onSetPageHeading: (elementId: string, field: 'pageTitle' | 'pageSubtitle', value: string) => void;
  // The web components' rows and a hero's caption lines, edited in place
  // (docs/specs/009-elements/web-components-and-no-groups.md). Omitted in read-only.
  onSetWebRows?: (elementId: string, rows: WebRows) => void;
  // A pointer note's tip let go at a canvas point (docs/specs/009-elements/pointer-note.md).
  onSetPointerTip?: (elementId: string, tipAbs: { x: number; y: number }) => void;
  onSetHeroCaptionLine?: (elementId: string, field: keyof HeroCaption, value: string) => void;
  // Open the link picker for one of this table's cells. Only used by
  // table elements; omitted for read-only viewers.
  onLinkCell?: (tableId: string, r: number, c: number) => void;
  // Right-click on the element. Receives the element id + the
  // cursor's screen-space coords so the caller can anchor a context
  // menu under it. The caller is also responsible for selecting the
  // element (the menu's actions assume it is the current selection).
  onContextSelect: (id: string, screenX: number, screenY: number) => void;
  // True when the tab as a whole is locked. Shows the LockBadge on
  // every element regardless of its own per-element lock state.
  tabLocked: boolean;
  // This document's tabs (id + name), so a link badge's hover card can
  // name the tab/element it points at (docs/specs/008-canvas/canvas-and-palette.md). Stable reference.
  tabSummaries: { id: string; name: string }[];
  // True for view-role share visitors (session read-only). Shape / text
  // editing is blocked upstream in the editing handlers, but the table
  // edits in-component (TableView's own cell double-click + menus), so it
  // needs the flag passed through to stay read-only for viewers.
  readOnly: boolean;
  // Whether a drag would move it: false in a read-only session unless this element is one a Participant may move
  // (docs/specs/013-workspace/share-roles.md), so the move cursor never promises a drag that will not start.
  movable?: boolean;
  // Whether its words may be written: false in a read-only session unless a Participant may write on it. Opens a
  // table's cell text, never its rows, columns or styles.
  writable?: boolean;
  // Whether its resize handles show: false in a read-only session unless a Participant may resize it.
  resizable?: boolean;
  // Other participants whose realtime selection is currently on this
  // element. Rendered as a small initial-badge stack at the top-left
  // (opposite the link / comment badges). Only a selector who `holds` (not a Viewer) locks it.
  remoteSelectors: RemoteSelector[];
  // Resolved CSS font-family stack for this element's text (docs/specs/004-interface-design/fonts.md):
  // its own font, else the tab's, else undefined (inherit the editor
  // default). Applied to the label / cell text + their live editors.
  fontFamily?: string;
};
