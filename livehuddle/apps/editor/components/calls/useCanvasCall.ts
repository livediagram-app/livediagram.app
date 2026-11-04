'use client';

// The canvas's side of proximity audio (docs/specs/012-collaboration/proximity-audio.md): where everyone stands, as
// the call needs it, and the equaliser's placement and walk-over.
import { useMemo } from 'react';
import { avatarScale, parseAvatarConfig } from '@liveworkspace/avatar/config';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import type { CanvasTool } from '@/components/palette/palette.types';
import { walkTowards, type Point } from '@/lib/calls/hearing';
import { DO_NOT_DISTURB, useProximityCall } from '@/lib/calls/useProximityCall';
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

  const self = inMode ? avatar.pos : null;
  useProximityCall({
    inMode,
    caller,
    // `can.takePart`, never read-only (Avatar mode makes the canvas read-only for everyone): a Viewer only listens.
    canSpeak: !!props.takePart,
    send: props.onCallSignal,
    tabId: props.activeTabId ?? '',
    self,
    walkers: peers,
  });

  return {
    bars: {
      peers,
      self: self ? { at: self, scale: deps.avatarScale, color: props.selfParticipant.color } : null,
      hidePeers: DO_NOT_DISTURB,
      onWalkTo: self
        ? (_id: string, at: Point) => {
            track('Canvas', 'Used', 'WalkToTalker');
            avatar.walkTo(walkTowards(self, at));
          }
        : undefined,
    },
  };
}
