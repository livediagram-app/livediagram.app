'use client';

// The canvas's side of proximity audio (docs/specs/012-collaboration/proximity-audio.md): where everyone stands, as
// the call needs it, and the equaliser's placement and walk-over. The bubbles (docs/specs/012-collaboration/
// video-and-screen-bubbles.md) sit above the same characters, and the visible area decides which are received.
// Raised hands sit beside them, each a Let Speak button for whoever may press it, and Do Not Disturb hides others'
// bars (meeting-rooms-and-stage.md "Raise hand", "Do Not Disturb").
import { useMemo } from 'react';
import { avatarScale, parseAvatarConfig } from '@liveworkspace/avatar/config';
import { visibleLayerElements } from '@livehuddle/document';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import type { CanvasTool } from '@/components/palette/palette.types';
import type { ViewRect } from '@/lib/calls/bubbles';
import { walkTowards, type Point } from '@/lib/calls/hearing';
import { useProximityCall } from '@/lib/calls/useProximityCall';
import { callStages, mayLetSpeakSelf } from '@/lib/calls/stage';
import { noteLetSpeak } from '@/lib/calls/calls-store';
import { roomZones } from '@/lib/calls/zones';
import { track } from '@/lib/telemetry';
import type { TalkingBarsPeer } from './TalkingBars';

type WalkingSelf = {
  pos: Point | null;
  walkTo: (point: Point, onArrive?: () => void) => void;
};

export function useCanvasCall(deps: {
  props: CanvasProps;
  canvasTool: CanvasTool;
  avatar: WalkingSelf;
  avatarScale: number;
  // The canvas transform (`scale(zoom) translate(offset)`) and the canvas's size on screen.
  viewport?: { offset: Point; zoom: number; width: number; height: number };
  // Your status is Do Not Disturb (meeting-rooms-and-stage.md "Do Not Disturb").
  doNotDisturb?: boolean;
}) {
  const { props, canvasTool, avatar } = deps;
  const inMode = canvasTool === 'avatar';
  const ownerId = props.imageContext?.ownerId;
  const documentId = props.imageContext?.documentId;
  const shareCode = props.imageContext?.shareCode ?? null;

  const peers: TalkingBarsPeer[] = useMemo(
    () =>
      props.remoteAvatars.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        at: { x: p.avatar.x, y: p.avatar.y },
        scale: avatarScale(parseAvatarConfig(p.avatar.config).size),
        glideMs: p.glideMs,
        walking: p.avatar.walking,
      })),
    [props.remoteAvatars],
  );
  const caller = useMemo(
    () => (ownerId && documentId ? { ownerId, documentId, shareCode } : null),
    [ownerId, documentId, shareCode],
  );

  // Each visible Office room is a call of its own (meeting-rooms-and-stage.md "Rooms are calls"): the rooms the walk
  // collides with, worked out only when the board or its layers change, never on a step.
  // And each visible stage, with the room it stands in (the same spec's "The stage").
  const { zones, stages } = useMemo(() => {
    const visible = visibleLayerElements(props.elements, props.tabLayers);
    const rooms = roomZones(visible);
    return { zones: rooms, stages: callStages(visible, rooms) };
  }, [props.elements, props.tabLayers]);

  const self = inMode ? avatar.pos : null;
  const view = useViewRect(deps.viewport);
  useProximityCall({
    inMode,
    caller,
    // `can.takePart`, never read-only (Avatar mode makes the canvas read-only for everyone): a Viewer only listens.
    canSpeak: !!props.takePart,
    // Sharing a screen is an Editor's (video-and-screen-bubbles.md "Share roles").
    canShare: !!props.canShareScreen,
    view,
    send: props.onCallSignal,
    tabId: props.activeTabId ?? '',
    self,
    walkers: peers,
    zones,
    stages,
    doNotDisturb: deps.doNotDisturb,
  });

  // Let Speak (meeting-rooms-and-stage.md "Raise hand"): an Editor anywhere, or whoever speaks from a stage.
  const level = props.canShareScreen ? 'edit' : props.takePart ? 'participate' : 'view';
  const send = props.onCallSignal;
  const mayLetSpeak = inMode && !!send && mayLetSpeakSelf(self, level, stages);
  const selfBadge = self ? { at: self, scale: deps.avatarScale } : null;

  return {
    bubbles: {
      peers,
      self: self ? { at: self, scale: deps.avatarScale, color: props.selfParticipant.color } : null,
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

// Bubbles are received only while their character is on screen; the area is snapped to a coarse grid so a pan or a
// zoom re-decides at most once per step of it, never every frame.
const VIEW_SNAP_PX = 64;
// `|| 0`: never -0, so an unchanged area compares equal.
const snap = (v: number) => Math.round(v / VIEW_SNAP_PX) * VIEW_SNAP_PX || 0;

function useViewRect(
  viewport: { offset: Point; zoom: number; width: number; height: number } | undefined,
): ViewRect | null {
  const measured = !!viewport && viewport.width > 0 && viewport.height > 0 && viewport.zoom > 0;
  const x = measured ? snap(-viewport.offset.x) : 0;
  const y = measured ? snap(-viewport.offset.y) : 0;
  const width = measured ? snap(viewport.width / viewport.zoom) : 0;
  const height = measured ? snap(viewport.height / viewport.zoom) : 0;
  return useMemo(
    () => (measured ? { x, y, width, height } : null),
    [measured, x, y, width, height],
  );
}
