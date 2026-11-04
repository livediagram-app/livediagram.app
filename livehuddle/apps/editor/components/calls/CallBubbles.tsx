'use client';

// The bubble layer (docs/specs/012-collaboration/video-and-screen-bubbles.md "The bubble"): each received camera and
// screen above its character's head, and your own above yours, inside the canvas's transformed layer so they pan,
// zoom and slide with the characters. A press maximises one into the panel, drawn outside the canvas.
import { useLayoutEffect, useRef } from 'react';
import { avatarGlides } from '@liveworkspace/avatar/relay';
import { AVATAR_HEIGHT } from '@liveworkspace/avatar/walk';
import {
  SELF_MEDIA_ID,
  setCallMaximised,
  useCallMedia,
  type CallMedia,
  type CallMediaStreams,
} from '@/lib/calls/calls-store';
import type { Point } from '@/lib/calls/hearing';
import { track } from '@/lib/telemetry';
import { MaximisedBubble } from './MaximisedBubble';
import { MediaBubble } from './MediaBubble';
import type { TalkingBarsPeer } from './TalkingBars';

/**
 * Above the head, clear of the name chip and the talking equaliser above it (they top out about 44 canvas px over
 * the head), with a small gap.
 */
export const BUBBLE_LIFT_PX = 50;

const MEDIA_ORDER: readonly CallMedia[] = ['video', 'screen'];

function Group({
  id,
  at,
  scale,
  glideMs,
  walking,
  streams,
  name,
  color,
}: {
  id: string;
  at: Point;
  scale: number;
  glideMs: number;
  walking: boolean;
  streams: CallMediaStreams;
  // Null for your own.
  name: string | null;
  color: string;
}) {
  const placed = useRef<HTMLDivElement>(null);
  const from = useRef(at);
  // Slide with the character's glide, as its bars do; a jump lands at once.
  useLayoutEffect(() => {
    const glides = avatarGlides(from.current, at, glideMs, walking);
    from.current = at;
    if (placed.current) {
      placed.current.style.transition = glides
        ? `left ${glideMs}ms linear, top ${glideMs}ms linear`
        : '';
    }
  }, [at, glideMs, walking]);
  return (
    <div
      ref={placed}
      data-call-bubbles={id}
      className="absolute z-10 flex -translate-x-1/2 -translate-y-full items-end gap-2 motion-reduce:transition-none"
      style={{ left: at.x, top: at.y - AVATAR_HEIGHT * scale - BUBBLE_LIFT_PX }}
    >
      {MEDIA_ORDER.map((media) => {
        const stream = streams[media];
        if (!stream) return null;
        return (
          <MediaBubble
            key={media}
            stream={stream}
            media={media}
            name={name}
            color={color}
            // Your own camera is a mirror, as every video call shows it; others see it the right way round.
            mirrored={name === null && media === 'video'}
            onMaximise={() => {
              track('Canvas', 'Used', 'BubbleMaximise');
              setCallMaximised({ id, media });
            }}
          />
        );
      })}
    </div>
  );
}

export function CallBubbles(props: {
  peers: readonly TalkingBarsPeer[];
  self: { at: Point; scale: number; color: string } | null;
}) {
  const media = useCallMedia();
  if (media.size === 0) return null;
  const own = media.get(SELF_MEDIA_ID);
  const names = new Map(props.peers.map((p) => [p.id, p]));
  return (
    <>
      {props.peers.map((p) => {
        const streams = media.get(p.id);
        if (!streams) return null;
        return (
          <Group
            key={p.id}
            id={p.id}
            at={p.at}
            scale={p.scale}
            glideMs={p.glideMs}
            walking={p.walking}
            streams={streams}
            name={p.name}
            color={p.color}
          />
        );
      })}
      {props.self && own ? (
        <Group
          id={SELF_MEDIA_ID}
          at={props.self.at}
          scale={props.self.scale}
          glideMs={0}
          walking={false}
          streams={own}
          name={null}
          color={props.self.color}
        />
      ) : null}
      <MaximisedBubble
        media={media}
        nameOf={(id) => {
          if (id === SELF_MEDIA_ID) return { name: null, color: props.self?.color ?? '#64748b' };
          const peer = names.get(id);
          return peer ? { name: peer.name, color: peer.color } : null;
        }}
      />
    </>
  );
}
