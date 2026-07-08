import type { PointerEvent as ReactPointerEvent } from 'react';
import type { BoxedElement, IconPosition, TextRun, TextSize } from '@livediagram/diagram';
import type { DragMode } from '@/lib/canvas';

export type BoxedElementViewProps = {
  element: BoxedElement;
  isSelected: boolean;
  // True when this element is part of an active marquee multi-selection.
  // Drives a louder selection ring (brand-500 instead of brand-200) so
  // it's obvious which elements are bundled into a multi-action like
  // Delete or Duplicate.
  isMultiSelected?: boolean;
  // True when *any* marquee multi-selection is currently active (size > 0).
  // While active, plain clicks on a non-member promote it into the
  // multi-set instead of replacing the selection — that's the "drag a
  // box, then click a few more" flow users expect.
  multiSelectActive?: boolean;
  isEditing: boolean;
  // When the current edit session began via type-to-edit (spec/09), the
  // label was seeded with the first typed char and the editor should
  // place the caret at the end instead of selecting all.
  editCursorAtEnd?: boolean;
  isPaintMode: boolean;
  showHandles: boolean;
  showAnchors: boolean;
  zoom: number;
  onBeginDrag: (id: string, mode: DragMode, e: ReactPointerEvent) => void;
  // Shift-click on an element fires this with the element id so the
  // page can toggle membership in the marquee multi-selection.
  onShiftSelect?: (id: string) => void;
  // Whole-layer opacity (spec/74), multiplied over the element's own
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
  // edit toolbar (spec/09). They operate on the current selection (= the
  // editing element). Optional so read-only paths can omit them.
  onSetTextAlign?: (
    x: import('@livediagram/diagram').TextAlignX,
    y: import('@livediagram/diagram').TextAlignY,
  ) => void;
  onSetPadding?: (padding: import('@livediagram/diagram').Padding) => void;
  onSetFont?: (font: string | null) => void;
  onSetTextSize?: (size: TextSize) => void;
  onCommitTable: (
    id: string,
    patch: Partial<
      Pick<
        import('@livediagram/diagram').TableElement,
        'cells' | 'colWidths' | 'rowHeights' | 'cellStyles'
      >
    >,
  ) => void;
  // Edit a timeline-rail point's label (spec/51). Omitted in read-only mode.
  onSetRailLabel?: (elementId: string, index: number, text: string) => void;
  // Theme-derived default slice colours for pie charts (spec/53).
  chartPalette?: readonly string[];
  onCancelEdit: () => void;
  onFollowLink: (link: import('@livediagram/diagram').ElementLink) => void;
  onOpenComments: (id: string) => void;
  // Open the element's assigned-action popover (spec/68). The badge only
  // renders while the element carries an OPEN action; everyone (including
  // view-role visitors) may open the popover, so this is not optional the
  // way onOpenNote is — mutations are gated inside the popover instead.
  onOpenAction: (id: string) => void;
  // Image element context: the editor passes these so the inner
  // ImageElementView can fetch the bitmap with the right
  // owner / share / diagram identity (the bytes are auth-gated by
  // the API, see spec/19). View-role visitors are still allowed to
  // see images; they just can't upload new ones via the picker.
  imageContext?: {
    ownerId: string;
    diagramId: string;
    shareCode: string | null;
    onOpenPicker?: (elementId: string) => void;
  };
  // Open the per-element note popover. Optional so read-only viewers
  // (who shouldn't see a clickable badge) can omit it. When omitted
  // the note badge does not render.
  onOpenNote?: (id: string) => void;
  // Open the link picker for a link-card element (spec/40), on double-click.
  // Omitted for read-only viewers.
  onEditLink?: (id: string) => void;
  // Live dot-vote (spec/39). `vote` is the active tab's vote session
  // (undefined when none). `selfId` is the local participant (for "my
  // dots"); `voteMax` is the highest dot count on the tab (for the
  // winner highlight once revealed). cast/retract are omitted for
  // read-only viewers, who watch but can't vote.
  vote?: import('@livediagram/diagram').TabVote;
  selfId?: string;
  voteMax?: number;
  onCastVote?: (id: string) => void;
  onRetractVote?: (id: string) => void;
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
  // The colour for the link/comment badges. Comes from the active
  // tab's theme so the icons read as part of the diagram rather than
  // floating brand-blue dots on a coloured palette.
  badgeColor: string;
  // True when the tab as a whole is locked. Shows the LockBadge on
  // every element regardless of its own per-element lock state.
  tabLocked: boolean;
  // This diagram's tabs (id + name), so a link badge's tooltip can
  // name the tab/element it points at (spec/09). Stable reference.
  tabSummaries: { id: string; name: string }[];
  // True for view-role share visitors (session read-only). Shape / text
  // editing is blocked upstream in the editing handlers, but the table
  // edits in-component (TableView's own cell double-click + menus), so it
  // needs the flag passed through to stay read-only for viewers.
  readOnly: boolean;
  // Other participants whose realtime selection is currently on this
  // element. Rendered as a small initial-badge stack at the top-left
  // (opposite the link / comment badges).
  remoteSelectors: { id: string; name: string; color: string }[];
  // Resolved CSS font-family stack for this element's text (spec/28):
  // its own font, else the tab's, else undefined (inherit the editor
  // default). Applied to the label / cell text + their live editors.
  fontFamily?: string;
};
