'use client';

// The canvas's side of proximity audio (docs/specs/012-collaboration/proximity-audio.md): where everyone stands, as
// the call needs it, and the equaliser's placement and walk-over. The bubbles (docs/specs/012-collaboration/
// video-and-screen-bubbles.md) sit above the same characters, and the visible area decides which are received.
// Raised hands sit beside them, each a Let Speak button for whoever may press it, and Do Not Disturb hides others'
// bars (meeting-rooms-and-stage.md "Raise hand", "Do Not Disturb").
import { useMemo } from 'react';
import { computeViewportCanvasRect } from '@liveworkspace/workbench/lib/viewport';
import { avatarScale, peerAvatarConfig } from '@liveworkspace/avatar/config';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import type { RemoteAvatarRow } from '@/lib/presence-rows';
import type { CanvasTool } from '@/components/palette/palette.types';
import type { ViewRect } from '@/lib/calls/bubbles';
import { walkTowards, type Point } from '@/lib/calls/hearing';
import { useProximityCall } from '@/lib/calls/useProximityCall';
import { mayLetSpeakSelf } from '@/lib/calls/stage';
import { callPlacesOf } from '@/lib/calls/call-places';
import {
  callMaximised,
  noteLetSpeak,
  setCallMaximised,
  shareStoppedNotice,
} from '@/lib/calls/calls-store';
import { useToast } from '@/hooks/ui/useToast';
import { track } from '@/lib/telemetry';
import { useTimerEarshot } from '@/lib/office/timer-earshot';
import { useMeetingPieces } from '@/lib/office/useMeetingPieces';
import { useReceptionBell } from '@/lib/office/reception-bell';
import type { TalkingBarsPeer } from './TalkingBars';
import type { AccessLevel } from '@livehuddle/api-schema';

type WalkingSelf = {
  pos: Point | null;
  walkTo: (point: Point, onArrive?: () => void) => void;
  // The seat you sit on, and standing up from it (the meeting pieces and Knock, useMeetingPieces).
  seatedOn?: string | null;
  standUp?: () => void;
};

export function useCanvasCall(deps: {
  props: CanvasProps;
  // Peers' characters on this tab, read from the peer-motion store by the canvas (hooks/collab/usePeerRows).
  remoteAvatars: RemoteAvatarRow[];
  canvasTool: CanvasTool;
  avatar: WalkingSelf;
  avatarScale: number;
  // The canvas transform (`scale(zoom) translate(offset)`) and the canvas's size on screen.
  viewport?: { offset: Point; zoom: number; width: number; height: number };
  // Your status is Do Not Disturb (meeting-rooms-and-stage.md "Do Not Disturb").
  doNotDisturb?: boolean;
  // The coarse copy of the peers and your feet (hooks/collab/useCoarseMotion.ts), for what follows positions as a
  // fact: the call's scene and the meeting pieces. Without it, the frame-rate ones.
  coarse?: { remoteAvatars: RemoteAvatarRow[]; pos: Point | null };
}) {
  const { props, remoteAvatars, canvasTool, avatar } = deps;
  const inMode = canvasTool === 'avatar';
  const ownerId = props.imageContext?.ownerId;
  const documentId = props.imageContext?.documentId;
  const shareCode = props.imageContext?.shareCode ?? null;

  const peers: TalkingBarsPeer[] = useMemo(
    () =>
      remoteAvatars.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        // The seat too: only a seated character is in a Phone Booth's call (workday-pieces.md "Phone Booth").
        at: { x: p.avatar.x, y: p.avatar.y, seatedOn: p.avatar.seatedOn ?? null },
        scale: avatarScale(peerAvatarConfig(p.avatar.config).size),
        glideMs: p.glideMs,
        walking: p.avatar.walking,
      })),
    [remoteAvatars],
  );
  const caller = useMemo(
    () => (ownerId && documentId ? { ownerId, documentId, shareCode } : null),
    [ownerId, documentId, shareCode],
  );

  // Each Office room is a call of its own (meeting-rooms-and-stage.md "Rooms are calls"): the rooms the walk
  // collides with, worked out only when the board changes, never on a step.
  // And each stage, with the room it stands in (the same spec's "The stage").
  const { zones, stages } = callPlacesOf(props.elements);

  const self = inMode ? avatar.pos : null;
  const selfSeat = avatar.seatedOn ?? null;
  const seatedSelf = useMemo(
    () => (self ? { ...self, seatedOn: selfSeat } : null),
    [self, selfSeat],
  );
  // What follows positions as a fact reads the coarse copy (canvas-performance.md "Walking renders the characters").
  const coarseRows = deps.coarse?.remoteAvatars;
  const factWalkers = coarseRows ?? remoteAvatars;
  const factSelf = inMode ? (deps.coarse ? deps.coarse.pos : avatar.pos) : null;
  const callSelfAt = useMemo(
    () => (factSelf ? { ...factSelf, seatedOn: selfSeat } : null),
    [factSelf, selfSeat],
  );
  const coarseWalkers = useMemo(() => (coarseRows ? walkersOf(coarseRows) : null), [coarseRows]);
  const callWalkers = coarseWalkers ?? peers;
  // The Screens' and Room Signs' rooms, Knock (docs/specs/009-elements/screen-and-room-sign.md,
  // docs/specs/012-collaboration/knock.md).
  useMeetingPieces({
    elements: props.elements,
    zones,
    walkers: factWalkers,
    inMode,
    self: factSelf,
    selfSeatedOn: avatar.seatedOn ?? null,
    doNotDisturb: deps.doNotDisturb === true,
    send: props.onCallSignal,
    standUp: avatar.standUp,
    selfPerson: props.selfParticipant,
    walkTo: avatar.walkTo,
  });
  // Who hears each Timer's chime: the people in its room (docs/specs/009-elements/timer-and-stopwatch.md "The chime").
  useTimerEarshot({ elements: props.elements, zones, inMode, self });
  // Who hears a Reception Desk's bell, and ringing it (docs/specs/009-elements/workday-pieces.md "Reception Desk").
  useReceptionBell({
    elements: props.elements,
    zones,
    inMode,
    self,
    walkers: remoteAvatars,
    doNotDisturb: deps.doNotDisturb === true,
    send: props.onCallSignal,
  });
  const view = useViewRect(deps.viewport);
  const toast = useToast();
  useProximityCall({
    inMode,
    // Your feet with your seat, so sitting in a Phone Booth takes you into its call and walking across it does not.
    caller,
    // `can.takePart`, never read-only (Avatar mode makes the canvas read-only for everyone): a Viewer only listens.
    canSpeak: !!props.takePart,
    // Sharing a screen is an Editor's (video-and-screen-bubbles.md "Share roles").
    canShare: !!props.canShareScreen,
    view,
    send: props.onCallSignal,
    tabId: props.activeTabId ?? '',
    self: callSelfAt,
    walkers: callWalkers,
    zones,
    stages,
    doNotDisturb: deps.doNotDisturb,
    // An Editor stopped your share (video-and-screen-bubbles.md "Share roles", #504): say who, by their presence name.
    onShareStopped: (by) =>
      toast.info(shareStoppedNotice(remoteAvatars.find((p) => p.id === by)?.name)),
  });

  // Let Speak (meeting-rooms-and-stage.md "Raise hand"): an Editor anywhere, or whoever speaks from a stage.
  const level: AccessLevel = props.canShareScreen
    ? 'edit'
    : props.takePart
      ? 'participate'
      : 'view';
  const send = props.onCallSignal;
  const mayLetSpeak = inMode && !!send && mayLetSpeakSelf(self, level, stages);
  const selfBadge = self ? { at: self, scale: deps.avatarScale } : null;

  return {
    bubbles: {
      peers,
      self: self ? { at: self, scale: deps.avatarScale, color: props.selfParticipant.color } : null,
      // The snapped area can reach half a step past each edge: the bubbles wrap inside what is surely on screen.
      view: view ? { left: view.x + VIEW_SNAP_PX / 2, width: view.width - VIEW_SNAP_PX } : null,
      // An Editor stops someone else's share (video-and-screen-bubbles.md "Share roles"); the room checks it too.
      onStopShare:
        inMode && props.canShareScreen && send
          ? (peerId: string) => {
              track('Canvas', 'Used', 'StopOthersShare');
              if (callMaximised()?.id === peerId) setCallMaximised(null);
              send({ kind: 'call-stop-share', targetId: peerId });
            }
          : undefined,
    },
    bars: {
      peers,
      self: self ? { at: self, scale: deps.avatarScale, color: props.selfParticipant.color } : null,
      hidePeers: deps.doNotDisturb === true,
      onWalkTo: self
        ? (_id: string, at: Point) => {
            track('Canvas', 'Used', 'WalkToTalker');
            avatar.walkTo(walkTowards(self, at));
          }
        : undefined,
    },
    // Your hearing ring (proximity-audio.md "Your hearing ring"): your feet with your seat, cut to your room.
    ring: {
      self: seatedSelf ? { at: seatedSelf, color: props.selfParticipant.color } : null,
      zones,
      stages,
      level,
    },
    hands: {
      peers,
      self: selfBadge,
      onLetSpeak:
        mayLetSpeak && send
          ? (peerId: string, on: boolean) => {
              if (on) track('Canvas', 'Used', 'LetSpeak');
              noteLetSpeak(peerId, on);
              send({ kind: 'avatar-let-speak', targetId: peerId, on });
            }
          : undefined,
    },
  };
}

// Where each peer stands, as the call's scene reads it (the seat too: a Phone Booth's call is the seated).
function walkersOf(rows: readonly RemoteAvatarRow[]): { id: string; at: Point }[] {
  return rows.map((p) => ({
    id: p.id,
    at: { x: p.avatar.x, y: p.avatar.y, seatedOn: p.avatar.seatedOn ?? null },
  }));
}

// Bubbles are received only while their character is on screen; the area is snapped to a coarse grid so a pan or a
// zoom re-decides at most once per step of it, never every frame.
const VIEW_SNAP_PX = 64;
// `|| 0`: never -0, so an unchanged area compares equal.
const snap = (v: number) => Math.round(v / VIEW_SNAP_PX) * VIEW_SNAP_PX || 0;

function useViewRect(
  viewport: { offset: Point; zoom: number; width: number; height: number } | undefined,
): ViewRect | null {
  const measured = !!viewport && viewport.width > 0 && viewport.height > 0 && viewport.zoom > 0;
  // The canvas zooms about the screen's middle (Canvas.tsx's `origin-center`), so the area on screen is centred on it
  // at any zoom: the same rect Fit and paste use. Anchored at `-offset` it was right only at 100%, and zoomed in it
  // left everyone right of and below the middle unreceived (video-and-screen-bubbles.md "Who sees what").
  const area = measured
    ? computeViewportCanvasRect(viewport, viewport.offset, viewport.zoom)
    : { x: 0, y: 0, width: 0, height: 0 };
  // Each edge is snapped on its own (#503), not the size: a snapped size could put the right or bottom edge up to half a
  // step past the screen's, and the bubbles kept inside it would run off by that much.
  const x = snap(area.x);
  const y = snap(area.y);
  const width = snap(area.x + area.width) - x;
  const height = snap(area.y + area.height) - y;
  return useMemo(
    () => (measured ? { x, y, width, height } : null),
    [measured, x, y, width, height],
  );
}
