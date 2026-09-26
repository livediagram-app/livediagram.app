import type { LaneGutterEdge, LaneLike } from '@/components/canvas/LaneGutter';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type {
  BoxedElement,
  HeroCaption,
  IconPosition,
  TextRun,
  WebRows,
} from '@livediagram/diagram';
import type { DragMode } from '@/lib/canvas';

export type BoxedElementViewProps = {
  // Reaction pad (docs/specs/009-elements/reaction-pad.md): set it off, plus the burst it is currently
  // playing and the way to retire that burst when its animation ends.
  onFireReaction?: (element: import('@livediagram/diagram').ShapeElement) => void;
  reactionBurst?: { reaction: import('@livediagram/diagram').Reaction; seed: number };
  onReactionBurstDone?: (elementId: string) => void;
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
  // When the current edit session began via type-to-edit (docs/specs/008-canvas/canvas-and-palette.md), the
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
  // Whole-layer opacity (docs/specs/006-diagram/layers.md), multiplied over the element's own
  // `opacity`. Undefined = 1 (kept undefined at full opacity so the
  // memoised view's props stay stable).
  layerOpacity?: number;
  // Photo draft (docs/specs/021-event-storming/event-storming.md Phase 8): this note arrived from a photograph and
  // has not been accepted yet, so it wears a dashed accent outline.
  photoDraft?: boolean;
  // …and this one is a note the photo MATCHED: it gets a small "already here"
  // badge, with what the photo read when that differed from the board.
  photoMatched?: boolean;
  photoReadAs?: string;
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
    x: import('@livediagram/diagram').TextAlignX,
    y: import('@livediagram/diagram').TextAlignY,
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
        import('@livediagram/diagram').TableElement,
        'cells' | 'colWidths' | 'rowHeights' | 'cellStyles'
      >
    >,
  ) => void;
  // Edit a timeline-rail point's label (docs/specs/009-elements/timeline-rail.md). Omitted in read-only mode.
  onSetRailLabel?: (elementId: string, index: number, text: string) => void;
  // Theme-derived default slice colours for pie charts (docs/specs/009-elements/pie-chart.md).
  chartPalette?: readonly string[];
  onCancelEdit: () => void;
  onFollowLink: (link: import('@livediagram/diagram').ElementLink) => void;
  // Press a Mode Button element (docs/specs/009-elements/mode-button.md): switches the LOCAL participant into
  // the mode the element carries. Optional — a surface that can't change tools
  // (the read-only embed) leaves the face inert.
  onPressModeButton?: (element: import('@livediagram/diagram').ShapeElement) => void;
  // Bring Focus (docs/specs/012-collaboration/bring-focus.md): ask everyone else in the room to come and look at
  // this element. Absent on a surface with nobody to ask (an export, a solo
  // board), which renders the face inert.
  onPressFocusButton?: (element: import('@livediagram/diagram').ShapeElement) => void;
  // Session button (docs/specs/012-collaboration/session-button.md): press it to start the tool it carries. Absent
  // on a surface with no session to run; `sessionStartBlocked` is the softer
  // case — there IS a session, but this viewer may not start things (view
  // role), so the face renders inert and explains rather than lying.
  onPressSessionButton?: (element: import('@livediagram/diagram').ShapeElement) => void;
  sessionStartBlocked?: boolean;
  // What the tab's timer is doing, so a timer button can say "Pause" /
  // "Continue" instead of always promising a fresh countdown.
  timerState?: import('@/components/canvas/SessionButtonFace').TimerState;
  // The tab's live timer, so a Timer session element can BE the timer rather
  // than a button that starts one elsewhere (docs/specs/012-collaboration/session-button.md). Null when none is
  // running; absent on a surface with no session behind it.
  tabTimer?: import('@livediagram/diagram').TabTimer | null;
  // Comment panel (docs/specs/012-collaboration/comment-pin.md): who I am, and the thread mutators for THIS
  // element. All keyed by element id already, so the panel drives the same
  // comment machinery the anchored popover does.
  commentSelfId?: string;
  commentActions?: {
    add?: (text: string) => void;
    remove?: (commentId: string) => void;
    resolve?: () => void;
    unresolve?: () => void;
  };
  // Action panel (docs/specs/012-collaboration/action-panel.md): who I am, and the action mutators for THIS
  // element, bound by id the way commentActions are.
  actionSelfId?: string | null;
  actionActions?: {
    configure: () => void;
    complete: () => void;
    reopen: () => void;
  };
  // Per-element session settings from the element's own `…` menu (docs/specs/012-collaboration/session-button.md).
  onSetSessionConfig?: (
    element: import('@livediagram/diagram').ShapeElement,
    config: import('@livediagram/diagram').SessionButtonConfig,
  ) => void;
  // The `…` on a Behaviours element's face opens that element's own context
  // menu beside it (docs/specs/008-canvas/canvas-and-palette.md), rather than a second copy of its settings form.
  onOpenElementSettings?: (elementId: string) => void;
  // Pause / resume / restart / cancel for that timer. Absent on a read-only
  // surface, which renders the timer readable but inert.
  timerControls?: {
    pause?: () => void;
    resume?: () => void;
    reset?: () => void;
    clear?: () => void;
    // Change a running or paused countdown's length, restarting it there.
    setDuration?: (ms: number) => void;
  };
  // Reveal zone (docs/specs/009-elements/reveal-zone.md): whether THIS viewer has lifted the cover (local,
  // ephemeral — the shared state lives on the element), and the toggle.
  revealedForMe?: boolean;
  onToggleReveal?: (elementId: string) => void;
  // Picker (docs/specs/012-collaboration/picker.md): resolves what a roll can land on right now and performs
  // one, returning the result to animate towards. `shared` says whether this
  // viewer's roll is written back, so the face can tell its own landing apart
  // from one that arrived from a peer.
  onRollPicker?: (element: import('@livediagram/diagram').ShapeElement) => {
    candidates: import('@/lib/picker').PickerCandidate[];
    shared: boolean;
    roll: () => import('@/lib/picker').PickerCandidate | null;
  };
  // The collaboration elements (docs/specs/012-collaboration/estimate-card.md to docs/specs/012-collaboration/roll-call.md): who the viewer is, who
  // else is in the room, and the writes they may make. One prop for all five
  // faces — see CollabFaceRouter. Absent on a surface with no session behind
  // it, which renders them readable but inert.
  collab?: import('@/components/canvas/collab/CollabFaceRouter').CollabApi;
  // Chair (docs/specs/009-elements/chair.md): who peer presence says is seated on this chair right
  // now. A function of the element id rather than a map prop so the common
  // case (no chairs on the tab) costs nothing. Occupancy is never in the
  // document, so a disconnected sitter vacates for free.
  chairSitters?: (
    elementId: string,
  ) => import('@/components/canvas/collab/ChairView').ChairSitter[];
  // The viewer's current mode, so a Selection Mode button offering it renders
  // disabled (docs/specs/009-elements/mode-button.md).
  activeMode?: import('@livediagram/diagram').SelectionMode;
  // Portal (docs/specs/009-elements/portal-element.md): resolves a portal's pairing for the face — the paired portal's
  // name for the tooltip, and the travel action (undefined when unpaired, so the
  // face renders inert and says why).
  onEnterPortal?: (element: import('@livediagram/diagram').ShapeElement) => {
    targetName: string | null;
    travel?: () => void;
  };
  onOpenComments: (id: string) => void;
  // Open the element's assigned-action popover (docs/specs/012-collaboration/assigned-actions.md). The badge only
  // renders while the element carries an OPEN action; everyone (including
  // view-role visitors) may open the popover, so this is not optional the
  // way onOpenNote is — mutations are gated inside the popover instead.
  onOpenAction: (id: string) => void;
  // Image element context: the editor passes these so the inner
  // ImageElementView can fetch the bitmap with the right
  // owner / share / diagram identity (the bytes are auth-gated by
  // the API, see docs/specs/009-elements/images.md). View-role visitors are still allowed to
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
  // Open the link picker for a link-card element (docs/specs/009-elements/link-cards.md), on double-click.
  // Omitted for read-only viewers.
  onEditLink?: (id: string) => void;
  // Open the code edit dialog for a code-block shape (docs/specs/009-elements/code-block.md), on
  // double-click. Omitted for read-only viewers.
  onEditCode?: (id: string) => void;
  // Toggle one checklist row's done state (docs/specs/009-elements/checklist.md), from the on-canvas
  // checkbox. Omitted for read-only viewers.
  onToggleChecklistItem?: (elementId: string, index: number) => void;
  // Paint index within the elements layer. Isometric mode only: it stops
  // overlapping elements sharing a z-plane (docs/specs/008-canvas/isometric-view.md).
  isoDepth: number;
  // Insert-between preview (docs/specs/021-event-storming/event-storming.md): canvas-unit offset this element is
  // sliding by while a palette drag hovers a gap on an event-storming board.
  // A RENDER-TIME transform, never a change to `element.x` — the preview must
  // not reach the document, the undo stack, or a peer. Undefined when no slot
  // is open (kept undefined rather than 0 so the memo's props stay stable).
  insertShiftX?: number;
  // True while a palette drag could open a slot on this board, so the wrapper
  // carries the transition that animates the slot BOTH ways. It has to
  // outlive the offset itself: were the transition removed in the same commit
  // as the transform, the board would snap shut instead of easing.
  insertShiftAnimates?: boolean;
  // The Page masthead (docs/specs/009-elements/page-element.md), and the banner / callout lines (docs/specs/009-elements/web-components-and-no-groups.md).
  onSetPageHeading: (elementId: string, field: 'pageTitle' | 'pageSubtitle', value: string) => void;
  // The web components' rows and a hero's caption lines, edited in place
  // (docs/specs/009-elements/web-components-and-no-groups.md). Omitted in read-only.
  onSetWebRows?: (elementId: string, rows: WebRows) => void;
  onSetHeroCaptionLine?: (elementId: string, field: keyof HeroCaption, value: string) => void;
  // Live dot-vote (docs/specs/012-collaboration/session-tools.md). `vote` is the active tab's vote session
  // (undefined when none). `selfId` is the local participant (for "my
  // dots"); `voteMax` is the highest dot count on the tab (for the
  // winner highlight once revealed). cast/retract are omitted for
  // read-only viewers, who watch but can't vote.
  vote?: import('@livediagram/diagram').TabVote;
  // Whether THIS element can take a dot in the running vote: the kind
  // rule AND the vote's layer scope (docs/specs/012-collaboration/vote-layer-scope.md). Resolved by the caller,
  // which has the tab's layers; false also drives the dimming.
  votableInVote?: boolean;
  selfId?: string;
  voteMax?: number;
  // Vote-results walkthrough (docs/specs/012-collaboration/session-tools.md): while active, the plain winner
  // rings yield to a single pulsing focus on the reviewed element.
  voteReviewActive?: boolean;
  isVoteFocus?: boolean;
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
  // name the tab/element it points at (docs/specs/008-canvas/canvas-and-palette.md). Stable reference.
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
  // Resolved CSS font-family stack for this element's text (docs/specs/004-interface-design/fonts.md):
  // its own font, else the tab's, else undefined (inherit the editor
  // default). Applied to the label / cell text + their live editors.
  fontFamily?: string;
};
