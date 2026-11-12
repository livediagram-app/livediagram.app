import type { ReadableStore } from '@liveworkspace/workbench/lib/state-store';
import type { RemoteSelector } from '@/lib/presence-rows';
import type { CommentMention } from '@livediagram/document';
import type { UserPreferences } from '@/lib/user-preferences';

// The Canvas's collaboration props (CanvasProps in Canvas.types.ts is the whole contract): the session
// elements and tools, the vote, poll and timer, presence, and the Comments and Actions panels.
export type CanvasSessionProps = {
  // Press a Mode Button element (docs/specs/009-elements/mode-button.md): hands the LOCAL participant the
  // mode the element carries. Optional, the read-only embed has no tool picker
  // to drive, so its buttons render inert.
  onPressModeButton?: (element: import('@livediagram/document').ShapeElement) => void;
  // Bring Focus (docs/specs/012-collaboration/bring-focus.md): ask everyone else in the room to come and look at
  // this element. Absent on a surface with nobody to ask (an export, a solo
  // canvas), which renders the face inert.
  onPressFocusButton?: (element: import('@livediagram/document').ShapeElement) => void;
  // Session button (docs/specs/012-collaboration/session-button.md): starts the tool the pressed element carries.
  onPressSessionButton?: (element: import('@livediagram/document').ShapeElement) => void;
  // True when this viewer can't start session tools (view role): the button
  // renders inert and says why instead of failing silently on press.
  sessionStartBlocked?: boolean;
  // Who is running the session when it is somebody else (docs/specs/012-collaboration/facilitator.md), so a blocked
  // face names the person to ask; null when nobody else holds the baton.
  sessionRunBy?: string | null;
  // The tab timer's state for the session button's face (docs/specs/012-collaboration/session-button.md).
  timerState?: import('@/components/canvas/SessionButtonFace').TimerState;
  // Reveal zones (docs/specs/009-elements/reveal-zone.md) this viewer has lifted for themselves. Ephemeral
  // and local, the shared state is `revealed` on the element.
  revealedIds?: ReadonlySet<string>;
  onToggleReveal?: (elementId: string) => void;
  // Per-element session settings from the element's own `…` menu (docs/specs/012-collaboration/session-button.md):
  // the timer's length, the vote's dots, the poll's question and answers.
  // Absent on a read-only surface, which renders the menu's trigger not at all.
  // Comment panel (docs/specs/012-collaboration/comment-pin.md): who I am, plus the thread mutators, so a panel
  // shows and edits its thread in place. All keyed by element id, which is how
  // the anchored popover already drives them.
  commentSelfId?: string;
  commentPanelActions?: {
    add: (elementId: string, text: string, mentions?: CommentMention[]) => void;
    remove: (elementId: string, commentId: string) => void;
    resolve: (elementId: string) => void;
    unresolve: (elementId: string) => void;
  };
  // Action panel (docs/specs/012-collaboration/action-panel.md): who I am (for "Assigned to you"), plus the
  // docs/specs/012-collaboration/assigned-actions.md action mutators, keyed by element id like everything else that
  // drives an action. Absent on a read-only surface: the card renders inert.
  actionSelfId?: string | null;
  actionPanelActions?: {
    // Opens the Assign Action dialog: to add (no action id) or edit one.
    configure: (elementId: string, actionId?: string | null) => void;
    complete: (elementId: string, actionId?: string | null) => void;
    reopen: (elementId: string, actionId?: string | null) => void;
  };
  onSetSessionConfig?: (
    element: import('@livediagram/document').ShapeElement,
    config: import('@livediagram/document').SessionButtonConfig,
  ) => void;
  // Open an element's own context menu from the `…` on its face, anchored at
  // the trigger's screen position (docs/specs/008-canvas/canvas-and-palette.md). Absent on a read-only surface,
  // where there is nothing to configure.
  onOpenElementSettings?: (elementId: string) => void;
  // Picker (docs/specs/012-collaboration/picker.md): the candidates a roll can land on, and the roll itself.
  // `shared` says whether this viewer's roll is written back (and so reaches
  // the room), which is how the face tells its own landing apart from a peer's.
  onRollPicker?: (element: import('@livediagram/document').ShapeElement) => {
    candidates: import('@/lib/picker').PickerCandidate[];
    shared: boolean;
    roll: () => import('@/lib/picker').PickerCandidate | null;
  };
  // The collaboration elements (docs/specs/012-collaboration/estimate-card.md to docs/specs/012-collaboration/roll-call.md): the viewer's identity,
  // the room, and the writes they may make, one prop for all five faces.
  collab?: import('@/components/canvas/collab/CollabFaceRouter').CollabApi;
  // Follow-me (docs/specs/012-collaboration/follow-me-viewport.md): the name of whoever we are following, for the pill,
  // and the way out of it. Null / absent = not following anybody.
  followingName?: string | null;
  onStopFollowing?: () => void;
  // Portal (docs/specs/009-elements/portal-element.md): resolve a portal's pairing, the paired portal's name and, when
  // it has one, the action that travels there.
  onEnterPortal?: (element: import('@livediagram/document').ShapeElement) => {
    targetName: string | null;
    travel?: () => void;
  };
  // Reaction pad (docs/specs/009-elements/reaction-pad.md): set one off. Absent on a read-only surface, which
  // renders the pad inert rather than hiding it.
  onFireReaction?: (element: import('@livediagram/document').ShapeElement) => void;
  // The bursts currently playing, keyed by the pad's element id, plus the way
  // to retire one when its animation ends. Ephemeral: never document state.
  reactionBursts?: Map<
    string,
    { reaction: import('@livediagram/document').Reaction; seed: number }
  >;
  onReactionBurstDone?: (elementId: string) => void;
  // Map of elementId -> remote participants currently focused on that
  // element. Drives a small badge ring on each element so participants
  // can see in real time what others are working on.
  remoteSelectionsByElement: Map<string, RemoteSelector[]>;
  // Live cursor positions for remote participants, canvas-coords +
  // participant identity. Rendered inside the transformed wrapper so
  // they pan and zoom with the canvas.
  remoteCursors: { id: string; name: string; color: string; x: number; y: number }[];
  // Laser-pointer trails for the LaserOverlay, local user first
  // followed by any peers laser-pointing on the active tab. The
  // overlay handles fading and cleanup; Canvas just renders.
  // A store, read by the laser overlay alone (docs/specs/008-canvas/canvas-performance.md).
  laserTrails: ReadableStore<
    {
      participantId: string;
      color: string;
      points: { x: number; y: number; t: number }[];
    }[]
  >;
  // The session tools for the Session strip (docs/specs/012-collaboration/session-tools.md "The Session
  // strip"): the same bundle the tab menu's Session Studio drives. Absent on a surface without one.
  sessionTools?: import('@/components/chrome/session-tools-props').SessionToolsProps;
  // Live poll (docs/specs/012-collaboration/live-poll.md). The panel exists only while a poll is running
  // and its results are yours to see, so null means the Poll button opens the composer instead.
  pollPanel: {
    poll: import('@livediagram/api-schema').LivePoll;
    answers: Map<string, string | null>;
    isHost: boolean;
    onEnd: () => void;
    // Keep the tallies so far on the canvas as a chart, without ending the
    // poll (docs/specs/012-collaboration/poll-result-capture.md). Absent for a viewer who can't add elements.
    onKeepResults?: () => void;
    onDismiss: () => void;
  } | null;
  // Per-user preferences (docs/specs/007-editor/user-preferences.md): where Contents sits, among others.
  userPreferences: UserPreferences;
  // Live vote panel (docs/specs/012-collaboration/session-tools.md): turnout while casting is open, then the
  // clickable ranked results. Null when no vote is running on this tab.
  voteResults: { id: string; votes: number }[];
  onJumpToVoteResult: (index: number) => void;
  // Whether the local participant started the running vote, the only
  // one who may end / reveal / clear it or move the results focus.
  isVoteHost: boolean;
  // Everyone in the room right now who can cast (remote presence + you, one per person, no Viewers or agents),
  // the turnout denominator.
  participantCount: number;
  // Floating Comments panel. Only mounted when commentRows is
  // non-empty: the panel exists to list discussion that already
  // exists, so on documents without it the panel stays out of the
  // chrome entirely.
  commentRows: import('@/components/panels/CollaboratePanel').CommentRow[];
  commentsPanelPosition: { x: number; y: number } | null;
  onMoveCommentsPanel: (x: number, y: number) => void;
  onResetCommentsPanel: () => void;
  // Row click: editor selects the element + opens its thread popover.
  onOpenCommentsForElement: (elementId: string) => void;
  // Floating Actions panel (docs/specs/012-collaboration/assigned-actions.md). Mirrors the Comments panel: only
  // mounted when actionRows is non-empty (at least one OPEN action on
  // the active tab).
  actionRows: import('@/components/panels/CollaboratePanel').ActionRow[];
  // Row click: editor selects the element + opens its action popover.
  onOpenActionForElement: (elementId: string) => void;
  // The Collaborate panel row's round check (docs/specs/012-collaboration/assigned-actions.md §5): complete
  // (done) or reopen the action in place. Absent for a read-only visitor.
  onToggleActionDone?: (elementId: string, done: boolean, actionId: string) => void;
  // Live session tools (docs/specs/012-collaboration/session-tools.md): the active tab's timer / vote state +
  // the facilitator controls (Tab Settings) and the per-element dot
  // cast/retract used by the canvas vote interaction. State is read off
  // the tab; handlers no-op when edits are blocked.
  tabTimer?: import('@livediagram/document').TabTimer;
  tabVote?: import('@livediagram/document').TabVote;
  onStartTimer: (mode: import('@livediagram/document').TimerMode, durationMs?: number) => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onResetTimer: () => void;
  onClearTimer: () => void;
  // Change a running / paused countdown's length, restarting it at the new
  // one (docs/specs/012-collaboration/session-button.md). Driven by the Timer element's own `…` menu.
  onSetTimerDuration?: (durationMs: number) => void;
  onStartVote: (
    votesPerPerson: number,
    privacy?: import('@livediagram/document').VoteSetup,
  ) => void;
  onEndVote: () => void;
  onRevealVote: () => void;
  onClearVote: () => void;
  onCastVote: (elementId: string) => void;
  onRetractVote: (elementId: string) => void;
  // Vote-results walkthrough (docs/specs/012-collaboration/session-tools.md): the currently-reviewed top pick
  // (pulsed on the canvas, described in the vote banner) and the banner's
  // Previous / Next / Done controls. Null when not reviewing.
  voteReview: import('@/hooks/canvas/useVoteReview').VoteReview | null;
  onNextVoteResult: () => void;
  onPrevVoteResult: () => void;
  onDoneVoteReview: () => void;
};
