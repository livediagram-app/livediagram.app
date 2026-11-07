'use client';

// The talking equaliser (docs/specs/012-collaboration/proximity-audio.md "The talking equaliser"): three small bars
// in the speaker's colour above every talking character, near or far, so you can see where the conversations are
// and walk over. Drawn inside the canvas's transformed layer, so they pan and zoom with the characters.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HoverCard } from '@livehuddle/ui';
import { avatarGlides } from '@liveworkspace/avatar/relay';
import { AVATAR_HEIGHT } from '@liveworkspace/avatar/walk';
import type { VoiceLevel } from '@livehuddle/api-schema';
import {
  levelNow,
  useCallPeers,
  useCallSelf,
  VOICE_STALE_MS,
  type CallPeer,
} from '@/lib/calls/calls-store';
import { SELF_MEDIA_ID, useCallMedia } from '@/lib/calls/calls-media-store';
import { barsOpacity, distance, type Point } from '@/lib/calls/hearing';

/** Above a peer's name chip (its top sits 16 px over the head), with a 6 px gap. */
const PEER_BARS_LIFT = 22;
/** Above your own head, where your status dot sits: you have no name chip. */
const SELF_BARS_LIFT = 26;
const BAR_MAX_PX = 12;
const BAR_MIN_PX = 4;

export type TalkingBarsPeer = {
  id: string;
  name: string;
  color: string;
  at: Point;
  scale: number;
  glideMs: number;
  walking: boolean;
};

export function barHeight(level: VoiceLevel): number {
  return Math.max(BAR_MIN_PX, Math.round((BAR_MAX_PX * level) / 4));
}

// The clock levels are judged by: moved on when the oldest live level would go stale, so a lost stop clears itself
// without a message. Until then a level is as fresh as its arrival (the store tells of every new one).
function useStaleClock(peers: ReadonlyMap<string, CallPeer>): number {
  const [clock, setClock] = useState(0);
  useEffect(() => {
    let next = Infinity;
    const now = performance.now();
    for (const peer of peers.values()) {
      if (levelNow(peer, now) > 0) next = Math.min(next, peer.levelAt + VOICE_STALE_MS - now);
    }
    if (next === Infinity) return;
    const timer = setTimeout(() => setClock(performance.now()), Math.max(0, next) + 50);
    return () => clearTimeout(timer);
  }, [peers, clock]);
  return clock;
}

function Bars({ level, color }: { level: VoiceLevel; color: string }) {
  const height = barHeight(level);
  return (
    <span aria-hidden className="flex h-3 items-end gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="animate-talking-bar block w-[3px] origin-bottom rounded-full"
          style={{
            height: i === 1 ? height : Math.max(BAR_MIN_PX, height - 3),
            background: color,
            // Out of step with each other, so three bars read as a voice rather than one block.
            animationDelay: `${-i * 0.23}s`,
            animationDuration: `${0.5 + i * 0.12}s`,
          }}
        />
      ))}
    </span>
  );
}

// One talker's bars. They slide with the character's glide, set on the element as the walker sets its own: a walking
// step slides, a jump (a portal, a pad, a seat) lands at once.
function PeerBars({
  peer,
  opacity,
  onWalkTo,
}: {
  peer: TalkingBarsPeer & { level: VoiceLevel };
  opacity: number;
  onWalkTo?: (peerId: string, at: Point) => void;
}) {
  const placed = useRef<HTMLDivElement>(null);
  const from = useRef(peer.at);
  useLayoutEffect(() => {
    const glides = avatarGlides(from.current, peer.at, peer.glideMs, peer.walking);
    from.current = peer.at;
    if (placed.current) {
      placed.current.style.transition = glides
        ? `left ${peer.glideMs}ms linear, top ${peer.glideMs}ms linear`
        : '';
    }
  }, [peer.at, peer.glideMs, peer.walking]);
  const label = onWalkTo ? `${peer.name} is talking, walk over` : `${peer.name} is talking`;
  return (
    <div
      ref={placed}
      data-talking-bars={peer.id}
      className="absolute z-10 -translate-x-1/2 -translate-y-full"
      style={{
        left: peer.at.x,
        top: peer.at.y - AVATAR_HEIGHT * peer.scale - PEER_BARS_LIFT,
        opacity,
      }}
    >
      <HoverCard title={label}>
        {onWalkTo ? (
          <button
            type="button"
            aria-label={label}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onWalkTo(peer.id, peer.at)}
            className="pointer-events-auto flex cursor-pointer items-end rounded-md px-1.5 py-1 transition hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-slate-900/70"
          >
            <Bars level={peer.level} color={peer.color} />
          </button>
        ) : (
          <span
            role="img"
            aria-label={label}
            className="pointer-events-auto flex items-end px-1.5 py-1"
          >
            <Bars level={peer.level} color={peer.color} />
          </span>
        )}
      </HoverCard>
    </div>
  );
}

export function TalkingBars(props: {
  peers: readonly TalkingBarsPeer[];
  self: { at: Point; scale: number; color: string } | null;
  // Pressing someone's bars walks you over: only while you walk.
  onWalkTo?: (peerId: string, at: Point) => void;
  // Do Not Disturb (Work Tracker #319) hides other people's bars; your own still show.
  hidePeers?: boolean;
}) {
  const peers = useCallPeers();
  const self = useCallSelf();
  const now = useStaleClock(peers);
  // Someone wearing a camera or screen bubble talks on the bubble (BubbleBars), which sits where these would.
  const media = useCallMedia();

  const talking = props.hidePeers
    ? []
    : props.peers.flatMap((p) => {
        if (media.has(p.id)) return [];
        const level = levelNow(peers.get(p.id), now);
        return level > 0 ? [{ ...p, level }] : [];
      });
  const selfLevel = self.muted || media.has(SELF_MEDIA_ID) ? 0 : self.level;
  if (talking.length === 0 && !(props.self && selfLevel > 0)) return null;

  return (
    <>
      {talking.map((p) => (
        <PeerBars
          key={p.id}
          peer={p}
          opacity={
            props.self ? barsOpacity(distance(props.self.at, p.at), self.heard.has(p.id)) : 1
          }
          onWalkTo={props.onWalkTo}
        />
      ))}
      {props.self && selfLevel > 0 ? (
        <div
          data-talking-bars="self"
          aria-hidden
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full px-1.5 py-1"
          style={{
            left: props.self.at.x,
            top: props.self.at.y - AVATAR_HEIGHT * props.self.scale - SELF_BARS_LIFT,
          }}
        >
          <Bars level={selfLevel} color={props.self.color} />
        </div>
      ) : null}
    </>
  );
}

/**
 * The talking equaliser of someone wearing a bubble, on the bubble's top-left corner while they talk (CallBubbles): the
 * bubble sits just over the head, where the bars over a head would be (docs/specs/012-collaboration/
 * video-and-screen-bubbles.md "Bubble size and place"). Its own subscription, so a level ticking re-renders the bars
 * alone, never the video tiles.
 */
export function BubbleBars({ id, color }: { id: string; color: string }) {
  const peers = useCallPeers();
  const self = useCallSelf();
  const now = useStaleClock(peers);
  const level = id === SELF_MEDIA_ID ? (self.muted ? 0 : self.level) : levelNow(peers.get(id), now);
  if (level <= 0) return null;
  return (
    <span
      data-bubble-bars={id}
      aria-hidden
      className="pointer-events-none absolute top-1.5 left-1.5 z-10 flex items-end rounded-md bg-slate-950/65 px-1.5 py-1"
    >
      <Bars level={level} color={color} />
    </span>
  );
}
