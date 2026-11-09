// useAvatarWalk's shapes and constants (useAvatarWalk.ts): what the hook takes, what a peer is sent, and the tuning the
// walk and its pieces share.

import type { DrinkKind } from '../office-geometry';
import type { AvatarSceneElement, SceneShapeOf } from '../scene';
import type { FenceSegment } from '../collision';
import type { AvatarConfig } from '../config';
import type { AvatarStatus } from '../status';
import type { AvatarReactionKind } from '../reactions';
import type { SeatClaim } from '../seat-claims';
import type { AvatarFacing, AvatarPoint } from '../walk';

// Canvas px of travel per leg swing. Tuned against AVATAR_SPEED so the
// cadence reads as a walk rather than a shuffle (~6 steps/second at speed).
export const STEP_LENGTH = 22;
// How far, in canvas px, a seat may sit from our feet before we are moved onto it (a turned or moved piece).
export const SEAT_FOLLOW_EPSILON = 0.5;

// What a peer needs to draw someone else's character (docs/specs/008-canvas/avatar-mode.md). Deliberately
// tiny: it rides the presence channel at cursor rates.
export type AvatarSnapshot = {
  x: number;
  y: number;
  facing: AvatarFacing;
  // A reaction in progress (docs/specs/008-canvas/avatar-mode.md), as the kind plus how far into it the
  // sender is: `reactionPose` is pure, so a peer replays the same performance
  // from this rather than us shipping every pose field over the wire.
  reaction?: { kind: AvatarReactionKind; elapsedMs: number };
  // The whole costume (docs/specs/008-canvas/avatar-mode.md), so a peer draws the character you built.
  config: AvatarConfig;
  walking: boolean;
  stepFrame: number;
  // Height above the ground mid-jump, canvas px (0 = standing).
  lift: number;
  // Chair (docs/specs/009-elements/chair.md): the chair this character is sitting on, or undefined
  // when standing. Occupancy is presence, never document state, so a chair is
  // vacated for free when its sitter disconnects.
  seatedOn?: string | null;
  // Which seat, when and the tiebreak (docs/specs/009-elements/chair.md "Occupancy is presence"), while seated.
  seat?: SeatClaim | null;
  // A drink in the hand (docs/specs/009-elements/office.md "Using it"), or none.
  holding?: DrinkKind | null;
  // How the person is (docs/specs/008-canvas/avatar-mode.md "Status"), or none.
  status?: AvatarStatus | null;
  // Flag-wave frame, or null when the flag is down.
  wave: number | null;
};

export const NO_FENCES: FenceSegment[] = [];

// How long the tab's walls must hold still before a standing character is nudged clear of one moved onto it
// (docs/specs/009-elements/fence.md "What does not walk"): a drag changes them every frame, and the nudge waits for
// the drop.
export const FENCE_SETTLE_MS = 150;

// The screen-space rects the loop reads each frame (useAvatarWalk's `rects`).
export type WalkRects = { main: DOMRect; wrapper: DOMRect };
// A drink in the hand, and which taking of it (useAvatarWalk's `drink`).
export type HeldDrink = { kind: DrinkKind; seq: number };
// The reaction playing and when it started (useAvatarWalk's `reactionRef`).
export type PlayingReaction = { kind: AvatarReactionKind; startedAt: number };

/** What useAvatarWalk takes. */
export type UseAvatarWalkOptions<E extends AvatarSceneElement> = {
  // True while the Avatar canvas tool is the active tool.
  active: boolean;
  // The character's costume (useAvatarConfig): published to peers, and its
  // size scales the right-click hit box.
  config: AvatarConfig;
  // How the person is (docs/specs/008-canvas/avatar-mode.md "Status"): rides every snapshot.
  status?: AvatarStatus | null;
  // Right-clicking the character flips male / female: the costume state lives
  // in useAvatarConfig (it persists), so the flip is delegated to it.
  onToggleGender: () => void;
  elements: readonly E[];
  mainRef: React.RefObject<HTMLElement | null> | React.ForwardedRef<HTMLElement>;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  // The view's offset: a value from a render, or, where a pan renders nothing (livehuddle's canvas writes it outside
  // React, docs/specs/008-canvas/canvas-performance.md), a reader of the store the loop asks each frame.
  viewportOffset?: AvatarPoint;
  readViewportOffset?: () => AvatarPoint;
  viewportZoom: number;
  setViewportOffset: (offset: AvatarPoint) => void;
  // A one-shot spawn point for the NEXT entry into the mode, in canvas px:
  // pressing a Selection Mode button (docs/specs/009-elements/mode-button.md) puts the character at that
  // button rather than the viewport centre. A ref, not a value, because it is
  // written during the same interaction that flips `active` and is consumed by
  // the entry effect below, which then clears it, so the palette's own way in
  // still spawns centre-screen.
  spawnAtRef?: React.MutableRefObject<AvatarPoint | null>;
  // A one-shot pad for the NEXT entry: pressing an Avatar Pad (docs/specs/009-elements/avatar-pad.md "Pressing it")
  // starts the walk on that pad rather than the one nearest the view's centre. Cleared once used, like spawnAtRef.
  spawnPadRef?: React.MutableRefObject<string | null>;
  // Publishes the local character to the room so peers can see it, and
  // `null` on exit so they drop it. Throttling lives in the broadcaster.
  onPresence?: (snapshot: AvatarSnapshot | null) => void;
  // How many other people are in the room (the roster's size, yourself not counted), for the standing heartbeat:
  // none means nobody to tell, so it rests (docs/specs/008-canvas/avatar-mode.md "Realtime"). Unset where the
  // editor does not know, which keeps the plain heartbeat.
  peers?: number;
  // Portal (docs/specs/009-elements/portal-element.md): the character walked onto a portal element. Fired once on
  // ARRIVAL, not every frame it stands there, and never for the portal it just
  // came out of.
  onWalkIntoPortal?: (element: SceneShapeOf<E>) => void;
  // Chair (docs/specs/009-elements/chair.md): the character walked onto a chair, a desk or a sofa.
  // Fired once on ARRIVAL, like the portal above, with where the feet were when they got there (a
  // sofa seats you on the cushion nearest that point).
  onWalkIntoChair?: (element: SceneShapeOf<E>, feet: AvatarPoint) => void;
  // Reaction pad (livediagram/docs/specs/009-elements/reaction-pad.md): the character walked onto a pad. Same arrival
  // hook as the portal and the chair, so a pad costs no third mechanism.
  onWalkIntoReactionPad?: (element: SceneShapeOf<E>) => void;
  // The office's machines (docs/specs/009-elements/office.md "Using it"): the character walked onto a water
  // cooler or a coffee machine. Fired once on ARRIVAL, like the portal and the chair.
  onWalkIntoDrink?: (element: SceneShapeOf<E>) => void;
  // How the view follows a walk (docs/specs/008-canvas/avatar-mode.md "The camera"): 'edge' pans only when the
  // character nears an edge; 'centred' keeps it in the middle and gravitates back after a hand pan.
  camera?: 'edge' | 'centred';
};
