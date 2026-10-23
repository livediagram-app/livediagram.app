import type { RemoteSelector } from '@/lib/presence-rows';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type {
  BoxedElement,
  HeroCaption,
  IconPosition,
  TextRun,
  WebRows,
} from '@livedesign/design';
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
  // Whole-layer opacity (docs/specs/006-design/layers.md), multiplied over the element's own
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
    x: import('@livedesign/design').TextAlignX,
    y: import('@livedesign/design').TextAlignY,
  ) => void;
  onCommitTable: (
    id: string,
    patch: Partial<
      Pick<
        import('@livedesign/design').TableElement,
        'cells' | 'colWidths' | 'rowHeights' | 'cellStyles'
      >
    >,
  ) => void;
  // Theme-derived default slice colours for pie charts (docs/specs/009-elements/pie-chart.md).
  chartPalette?: readonly string[];
  onCancelEdit: () => void;
  onFollowLink: (link: import('@livedesign/design').ElementLink) => void;
  onOpenComments: (id: string) => void;
  // Open the element's assigned-action popover (docs/specs/012-collaboration/assigned-actions.md). The badge only
  // renders while the element carries an OPEN action; everyone (including
  // view-role visitors) may open the popover, so this is not optional the
  // way onOpenNote is — mutations are gated inside the popover instead.
  onOpenAction: (id: string) => void;
  // Image element context: the editor passes these so the inner
  // ImageElementView can fetch the bitmap with the right
  // owner / share / design identity (the bytes are auth-gated by
  // the API, see docs/specs/009-elements/images.md). View-role visitors are still allowed to
  // see images; they just can't upload new ones via the picker.
  imageContext?: {
    ownerId: string;
    designId: string;
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
  // a Sankey's flows (docs/specs/009-elements/sankey.md). Omitted for read-only viewers.
  onOpenEditDialog?: (id: string) => void;
  // Toggle one checklist row's done state (docs/specs/009-elements/checklist.md), from the on-canvas
  // checkbox. Omitted for read-only viewers.
  onToggleChecklistItem?: (elementId: string, index: number) => void;
  // Paint index within the elements layer. Isometric mode only: it stops
  // overlapping elements sharing a z-plane (docs/specs/008-canvas/isometric-view.md).
  isoDepth: number;
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
  // Drop a dragged palette icon onto this shape. The view computes which
  // side of the text the icon landed on and reports it. Omitted in
  // read-only mode so visitors can't drop icons.
  onDropIcon?: (id: string, iconId: string, position: IconPosition) => void;
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
  // This design's tabs (id + name), so a link badge's hover card can
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
