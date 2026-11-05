'use client';

// The bubble layer (docs/specs/012-collaboration/video-and-screen-bubbles.md "The bubble"): each received camera and
// screen above its character's head, and your own above yours, inside the canvas's transformed layer so they pan,
// zoom and slide with the characters. A press maximises one into the panel, drawn outside the canvas. People standing
// close have their bubbles nudged apart ("Close together", lib/calls/bubble-layout.ts), and the rects they end up
// in are handed on so speech bubbles keep clear of them.
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
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
import {
  BUBBLE_GAP_PX,
  BUBBLE_NUDGE_MS,
  groupWidth,
  layoutBubbles,
  tailShift,
  type BubbleBox,
  type BubbleRect,
  type BubbleView,
} from '@/lib/calls/bubble-layout';
import { useLocalOnly } from '@/lib/calls/local-preview';
import { track } from '@/lib/telemetry';
import { MaximisedBubble } from './MaximisedBubble';
import { BUBBLE_WIDTH_PX, MediaBubble } from './MediaBubble';
import type { TalkingBarsPeer } from './TalkingBars';

/**
 * Above the head, clear of the name chip and the talking equaliser above it (they top out about 44 canvas px over
 * the head), with a small gap.
 */
export const BUBBLE_LIFT_PX = 50;

const MEDIA_ORDER: readonly CallMedia[] = ['video', 'screen'];
const BUBBLE_HEIGHT_PX = (BUBBLE_WIDTH_PX * 9) / 16;
// The nudge and the swap: a short ease-out slide, apart from the walk's linear glide.
const NUDGE_TRANSITION = `transform ${BUBBLE_NUDGE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;

/** The rects the bubbles were last laid out in, for the speech layer: made once per canvas. */
export function useCallBubbleRects(): RefObject<readonly BubbleRect[]> {
  return useRef<readonly BubbleRect[]>([]);
}

const countOf = (streams: CallMediaStreams) => MEDIA_ORDER.filter((m) => streams[m]).length;
const bottomOf = (at: Point, scale: number) => at.y - AVATAR_HEIGHT * scale - BUBBLE_LIFT_PX;

function Group({
  id,
  at,
  scale,
  dx,
  dy,
  glideMs,
  walking,
  streams,
  name,
  color,
  onStopShare,
  localOnly,
}: {
  id: string;
  at: Point;
  scale: number;
  // Canvas px nudged sideways, clear of the bubbles beside it.
  dx: number;
  // Canvas px lifted onto a wrapped row (negative), or 0.
  dy: number;
  glideMs: number;
  walking: boolean;
  streams: CallMediaStreams;
  // Null for your own.
  name: string | null;
  color: string;
  onStopShare?: () => void;
  // Your own bubbles that are local previews, nobody else's (video-and-screen-bubbles.md "Local preview").
  localOnly?: { video: boolean; screen: boolean };
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
      className="absolute z-10 -translate-x-1/2 -translate-y-full motion-reduce:transition-none"
      style={{ left: at.x, top: bottomOf(at, scale) }}
    >
      <div
        data-call-bubbles-row
        className="relative flex items-end motion-reduce:transition-none"
        style={{
          gap: BUBBLE_GAP_PX,
          transform: `translate(${dx}px, ${dy}px)`,
          transition: NUDGE_TRANSITION,
        }}
      >
        {/* The tail: points down at the head, so a bubble nudged aside still says whose it is. Under the bubbles.
            Hidden on a wrapped row, whose head is under another row. */}
        <span
          hidden={dy !== 0}
          aria-hidden
          data-call-bubble-tail
          className="absolute -bottom-[5px] left-1/2 size-[10px] rounded-[2px] motion-reduce:transition-none"
          style={{
            background: color,
            transform: `translateX(calc(-50% + ${tailShift(dx, groupWidth(countOf(streams), BUBBLE_WIDTH_PX))}px)) rotate(45deg)`,
            transition: NUDGE_TRANSITION,
          }}
        />
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
              localOnly={localOnly?.[media] === true}
              onStopShare={onStopShare}
              onMaximise={() => {
                track('Canvas', 'Used', 'BubbleMaximise');
                setCallMaximised({ id, media });
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function CallBubbles(props: {
  peers: readonly TalkingBarsPeer[];
  self: { at: Point; scale: number; color: string } | null;
  // Filled with where the bubbles were laid out, for the speech bubbles (useCallBubbleRects).
  rectsRef?: RefObject<readonly BubbleRect[]>;
  // The visible canvas across, in canvas px: a row of bubbles wider than it wraps.
  view?: BubbleView | null;
  // An Editor's Stop Sharing on someone else's screen (video-and-screen-bubbles.md "Share roles").
  onStopShare?: (id: string) => void;
}) {
  const { onStopShare } = props;
  const media = useCallMedia();
  const own = media.get(SELF_MEDIA_ID);
  const previews = useLocalOnly();
  const boxes: BubbleBox[] = [];
  const box = (id: string, at: Point, scale: number, streams: CallMediaStreams | undefined) => {
    const count = streams ? countOf(streams) : 0;
    if (count === 0) return;
    const width = groupWidth(count, BUBBLE_WIDTH_PX);
    boxes.push({ id, x: at.x, bottom: bottomOf(at, scale), width, height: BUBBLE_HEIGHT_PX });
  };
  for (const p of props.peers) box(p.id, p.at, p.scale, media.get(p.id));
  if (props.self) box(SELF_MEDIA_ID, props.self.at, props.self.scale, own);
  // The left-to-right order sticks between layouts, so passing people swap sides once, not back and forth. Adjusted
  // during render: the order a layout hands back is already stable, so this settles in one extra render.
  const [order, setOrder] = useState<readonly string[]>([]);
  const layout = layoutBubbles(boxes, order, props.view);
  if (layout.order.length !== order.length || layout.order.some((id, i) => id !== order[i])) {
    setOrder(layout.order);
  }
  const { rectsRef } = props;
  useLayoutEffect(() => {
    if (rectsRef) rectsRef.current = media.size === 0 ? [] : layout.rects;
  });
  useLayoutEffect(() => {
    if (!rectsRef) return;
    return () => {
      rectsRef.current = [];
    };
  }, [rectsRef]);
  if (media.size === 0) return null;
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
            dx={layout.dx.get(p.id) ?? 0}
            dy={layout.dy.get(p.id) ?? 0}
            glideMs={p.glideMs}
            walking={p.walking}
            streams={streams}
            name={p.name}
            color={p.color}
            onStopShare={onStopShare ? () => onStopShare(p.id) : undefined}
          />
        );
      })}
      {props.self && own ? (
        <Group
          id={SELF_MEDIA_ID}
          at={props.self.at}
          scale={props.self.scale}
          dx={layout.dx.get(SELF_MEDIA_ID) ?? 0}
          dy={layout.dy.get(SELF_MEDIA_ID) ?? 0}
          glideMs={0}
          walking={false}
          streams={own}
          name={null}
          color={props.self.color}
          localOnly={previews}
        />
      ) : null}
      <MaximisedBubble
        media={media}
        onStopShare={onStopShare}
        nameOf={(id) => {
          if (id === SELF_MEDIA_ID) return { name: null, color: props.self?.color ?? '#64748b' };
          const peer = names.get(id);
          return peer ? { name: peer.name, color: peer.color } : null;
        }}
      />
    </>
  );
}
