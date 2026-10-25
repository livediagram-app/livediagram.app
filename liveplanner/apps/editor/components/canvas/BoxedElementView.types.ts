import type { RemoteSelector } from '@/lib/presence-rows';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { BoxedElement, TextRun } from '@liveplanner/project';
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
  showHandles: boolean;
  showAnchors: boolean;
  onBeginDrag: (id: string, mode: DragMode, e: ReactPointerEvent) => void;
  // The armed action a tap takes instead of selecting (Canvas.types.ts): true when it took it.
  onPressArmedAction?: (id: string) => boolean;
  // Shift-click on an element fires this with the element id so the
  // page can toggle membership in the marquee multi-selection.
  onShiftSelect?: (id: string) => void;
  // Whole-layer opacity (docs/specs/006-project/layers.md), multiplied over the element's own
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
    x: import('@liveplanner/project').TextAlignX,
    y: import('@liveplanner/project').TextAlignY,
  ) => void;
  // Theme-derived default slice colours for pie charts (docs/specs/009-elements/pie-chart.md).
  chartPalette?: readonly string[];
  onCancelEdit: () => void;
  onFollowLink: (link: import('@liveplanner/project').ElementLink) => void;
  // Session button (docs/specs/012-collaboration/session-button.md): press it to start the tool it carries. Absent
  // on a surface with no session to run; `sessionStartBlocked` is the softer
  // case — there IS a session, but this viewer may not start things (view
  // role), so the face renders inert and explains rather than lying.
  onPressSessionButton?: (element: import('@liveplanner/project').ShapeElement) => void;
  sessionStartBlocked?: boolean;
  // What the tab's timer is doing, so a timer button can say "Pause" /
  // "Continue" instead of always promising a fresh countdown.
  timerState?: import('@/components/canvas/SessionButtonFace').TimerState;
  // The tab's live timer, so a Timer session element can BE the timer rather
  // than a button that starts one elsewhere (docs/specs/012-collaboration/session-button.md). Null when none is
  // running; absent on a surface with no session behind it.
  tabTimer?: import('@liveplanner/project').TabTimer | null;
  // Comment panel (docs/specs/012-collaboration/comment-pin.md): who I am, and the thread mutators for THIS
  // element. All keyed by element id already, so the panel drives the same
  // comment machinery the anchored popover does.
  commentSelfId?: string;
  commentActions?: {
    add?: (text: string, mentions: import('@liveplanner/project').CommentMention[]) => void;
    remove?: (commentId: string) => void;
    resolve?: () => void;
    unresolve?: () => void;
  };
  // Action panel (docs/specs/012-collaboration/action-panel.md): who I am, and the action mutators for THIS
  // element, bound by id the way commentActions are.
  actionSelfId?: string | null;
  // An Action panel holds a list (docs/specs/012-collaboration/action-panel.md): add one, or edit / complete /
  // reopen the named one.
  actionActions?: {
    add: () => void;
    edit: (actionId: string) => void;
    complete: (actionId: string) => void;
    reopen: (actionId: string) => void;
    // Opens the Actions board (docs/specs/026-plan/linked-boards.md "On the canvas").
    openBoard?: () => void;
  };
  // Per-element session settings from the element's own `…` menu (docs/specs/012-collaboration/session-button.md).
  onSetSessionConfig?: (
    element: import('@liveplanner/project').ShapeElement,
    config: import('@liveplanner/project').SessionButtonConfig,
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
  // Picker (docs/specs/012-collaboration/picker.md): resolves what a roll can land on right now and performs
  // one, returning the result to animate towards. `shared` says whether this
  // viewer's roll is written back, so the face can tell its own landing apart
  // from one that arrived from a peer.
  onRollPicker?: (element: import('@liveplanner/project').ShapeElement) => {
    candidates: import('@/lib/picker').PickerCandidate[];
    shared: boolean;
    roll: () => import('@/lib/picker').PickerCandidate | null;
  };
  // The collaboration elements (docs/specs/012-collaboration/temperature-check.md, decision-record.md): who the
  // viewer is and the writes they may make. One prop for the faces — see CollabFaceRouter. Absent on a surface
  // with no session behind it, which renders them readable but inert.
  collab?: import('@/components/canvas/collab/CollabFaceRouter').CollabApi;
  onOpenComments: (id: string) => void;
  // Open the element's assigned-action popover (docs/specs/012-collaboration/assigned-actions.md). The badge only
  // renders while the element carries an OPEN action; everyone (including
  // view-role visitors) may open the popover, so this is not optional the
  // way onOpenNote is — mutations are gated inside the popover instead.
  onOpenAction: (id: string) => void;
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
  // The Page masthead (docs/specs/009-elements/page-element.md), and the banner / callout lines (docs/specs/009-elements/web-components-and-no-groups.md).
  onSetPageHeading: (elementId: string, field: 'pageTitle' | 'pageSubtitle', value: string) => void;
  // Live dot-vote (docs/specs/012-collaboration/session-tools.md). `vote` is the active tab's vote session
  // (undefined when none). `selfId` is the local participant (for "my
  // dots"); `voteMax` is the highest dot count on the tab (for the
  // winner highlight once revealed). cast/retract are omitted for
  // read-only viewers, who watch but can't vote.
  vote?: import('@liveplanner/project').TabVote;
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
  // Right-click on the element. Receives the element id + the
  // cursor's screen-space coords so the caller can anchor a context
  // menu under it. The caller is also responsible for selecting the
  // element (the menu's actions assume it is the current selection).
  onContextSelect: (id: string, screenX: number, screenY: number) => void;
  // True when the tab as a whole is locked. Shows the LockBadge on
  // every element regardless of its own per-element lock state.
  tabLocked: boolean;
  // This project's tabs (id + name), so a link badge's hover card can
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
