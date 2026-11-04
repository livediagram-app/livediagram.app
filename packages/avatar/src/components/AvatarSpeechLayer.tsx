'use client';

// Speech bubbles on the canvas (docs/specs/008-canvas/avatar-mode.md "Speech bubbles", blueprint
// docs/specs/008-canvas/blueprints/avatar-speech.md): the composer above your own character's head and every
// bubble floating away, yours and everyone's. Rendered INSIDE the canvas's transformed wrapper so each sits at
// its canvas point and pans with the canvas, but counter-scaled by the zoom so it is always reading size.
//
// The flight runs on one requestAnimationFrame loop that writes each bubble's transform and opacity straight to
// its node: no React render per frame, and no loop at all while nothing is flying.

import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { IDENTITY_FILL } from '@liveworkspace/ui/identity-fill';
import { avatarBindings } from '../bindings';
import {
  bubbleMotion,
  edgeShift,
  screenX,
  speechLift,
  tailOffset,
  SPEECH_LIFT_EASE_MS,
  SPEECH_RISE_PX_PER_S,
  SPEECH_SWAY_PX,
  type SpeechBubble,
  type SpeechObstacle,
} from '../speech';
import type { AvatarPoint } from '../walk';
import { AVATAR_FALLBACK_COLOUR } from '../config';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import { SendIcon, SpeechCard, SpeechCounter, SpeechDraftField } from './AvatarSpeechBubble';

// The brand cyan a character falls back to with no presence colour (AvatarWalker's).

// The composer's width, and the view's: the visible canvas in screen px, which a bubble is kept inside (spec
// "Kept inside the view"). `offsetX` is the canvas's pan, so a canvas x is at `screenX(x, zoom, offsetX, width)` on screen.
const COMPOSER_WIDTH = 240;
export type SpeechView = { offsetX: number; width: number };

type Peer = { id: string; name: string; color: string };
type Speaker = { name: string; colour: string } | null;

export type SpeechComposerProps = {
  head: AvatarPoint;
  coolingDown: boolean;
  // Sends; answers whether it went.
  onSend: (text: string) => boolean;
  onCancel: () => void;
};

// A canvas point, drawn at reading size: an empty anchor at the point, its child scaled by 1 / zoom about it.
function AtPoint({ at, zoom, children }: { at: AvatarPoint; zoom: number; children: ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: at.x, top: at.y, width: 0, height: 0 }}
    >
      <div
        className="absolute bottom-0 left-0"
        style={{ transform: `scale(${1 / zoom})`, transformOrigin: '0 100%' }}
      >
        {children}
      </div>
    </div>
  );
}

// A bubble's place and fade at `now`, and its tail's: one motion worked out per bubble per frame.
function motionOf(
  b: SpeechBubble,
  now: number,
  reduced: boolean,
  // The bubble's anchor on screen, its card's measured width and the view's width: all the edge clamp reads.
  edge: { x: number; width: number; viewWidth: number },
  // Screen px it starts higher by, to keep clear of what is in its path (speechLift).
  lift = 0,
): { transform: string; opacity: number; tail: number; tailOffset: number } {
  const m = bubbleMotion(
    now - b.bornAt,
    b.flightMs,
    reduced,
    b.leavingAt === undefined ? undefined : now - b.leavingAt,
  );
  const width = edge.width * m.scale;
  const shift = edge.viewWidth > 0 ? edgeShift(edge.x + m.sway, width, edge.viewWidth) : 0;
  return {
    transform: `translate(calc(-50% + ${m.sway + shift}px), ${-(m.rise + lift)}px) scale(${m.scale})`,
    opacity: m.opacity,
    tail: m.tail,
    tailOffset: tailOffset(shift, width),
  };
}

// `width` and `height` are the card's laid-out size, read once when it mounts: the flight loop never reads layout.
// `lift` is how far it has been lifted clear of obstacles so far (canvas px), `liftAt` when, null before its first
// frame.
type BubbleNode = {
  card: HTMLDivElement | null;
  tail: HTMLSpanElement | null;
  width: number;
  height: number;
  lift: number;
  liftAt: number | null;
};
type BubbleNodes = Map<string, BubbleNode>;

const EMPTY_OBSTACLES: readonly SpeechObstacle[] = [];

/**
 * A bubble's lift this frame, in canvas px: the largest it has needed so far (never pushed down during its flight),
 * eased toward over SPEECH_LIFT_EASE_MS, at once on its first frame and under reduced motion.
 */
function liftOf(
  n: BubbleNode,
  b: SpeechBubble,
  now: number,
  reduced: boolean,
  v: { zoom: number; offsetX: number; width: number },
  obstacles: readonly SpeechObstacle[],
): number {
  if (obstacles.length === 0 && n.lift === 0) return 0;
  const x = screenX(b.x, v.zoom, v.offsetX, v.width);
  const shift = v.width > 0 ? edgeShift(x, n.width, v.width) : 0;
  const reach = (SPEECH_RISE_PX_PER_S * (b.flightMs / 1000) + n.height) / v.zoom;
  const target = speechLift(
    { x: b.x + shift / v.zoom, y: b.y },
    (n.width / 2 + SPEECH_SWAY_PX) / v.zoom,
    reach,
    obstacles,
  );
  if (target > n.lift) {
    n.lift =
      reduced || n.liftAt === null
        ? target
        : n.lift + (target - n.lift) * (1 - Math.exp(-(now - n.liftAt) / SPEECH_LIFT_EASE_MS));
  }
  n.liftAt = now;
  return n.lift;
}

// One flying bubble, its own component so its ref callbacks live as long as it does: new ones each render (the canvas
// re-renders on every walk frame) would detach and reattach its nodes each time.
function FlyingBubble({
  bubble: b,
  speaker,
  zoom,
  nodes,
}: {
  bubble: SpeechBubble;
  speaker: NonNullable<Speaker>;
  zoom: number;
  nodes: RefObject<BubbleNodes>;
}) {
  const { id } = b;
  // Plain functions: the React Compiler keeps them the same while `id` and `nodes` are.
  const put = (part: 'card' | 'tail', el: HTMLElement | null) => {
    const entry = nodes.current.get(id) ?? {
      card: null,
      tail: null,
      width: 0,
      height: 0,
      lift: 0,
      liftAt: null,
    };
    if (part === 'card') {
      entry.card = el as HTMLDivElement | null;
      if (el) {
        entry.width = el.offsetWidth;
        entry.height = el.offsetHeight;
      }
    } else entry.tail = el;
    if (entry.card || entry.tail) nodes.current.set(id, entry);
    else nodes.current.delete(id);
  };
  const cardRef = (el: HTMLDivElement | null) => put('card', el);
  const tailRef = (el: HTMLSpanElement | null) => put('tail', el);
  return (
    <AtPoint at={b} zoom={zoom}>
      <div
        aria-hidden
        ref={cardRef}
        className="absolute bottom-0 left-0 w-max origin-bottom pb-[6px]"
        // Hidden until the flight loop places it, before the first paint.
        style={{ opacity: 0 }}
      >
        <SpeechCard
          floating
          colour={speaker.colour || undefined}
          name={speaker.name || undefined}
          tailRef={tailRef}
        >
          <p className="whitespace-pre-wrap break-words">{b.text}</p>
        </SpeechCard>
      </div>
    </AtPoint>
  );
}

function Composer({
  head,
  zoom,
  view,
  colour,
  coolingDown,
  onSend,
  onCancel,
}: SpeechComposerProps & { zoom: number; view: SpeechView; colour: string }) {
  const [draft, setDraft] = useState('');
  const canSend = !!draft.trim() && !coolingDown;
  const submit = () => {
    if (onSend(draft)) setDraft('');
  };
  // Kept inside the view, its tail still on the head: plain arithmetic on the head's screen x.
  const shift =
    view.width > 0
      ? edgeShift(screenX(head.x, zoom, view.offsetX, view.width), COMPOSER_WIDTH, view.width)
      : 0;
  return (
    <AtPoint at={head} zoom={zoom}>
      <div
        // A press here is the composer's, never a walk (useCanvasSurfaceGestures skips floating panels).
        data-floating-panel
        className="absolute bottom-0 left-0 w-[240px] -translate-x-1/2 pb-[6px]"
        style={shift ? { marginLeft: shift } : undefined}
      >
        <div className="origin-bottom animate-speech-pop">
          <SpeechCard colour={colour || undefined} tailShift={tailOffset(shift, COMPOSER_WIDTH)}>
            <div className="flex items-end gap-2">
              <SpeechDraftField
                autoFocus
                // One line is as tall as the send button, so the text sits level with it.
                className="py-[5px]"
                value={draft}
                onChange={setDraft}
                onSubmit={submit}
                onCancel={onCancel}
                // Pressing elsewhere keeps what you wrote; an empty composer closes itself.
                onBlur={() => {
                  if (!draft.trim()) onCancel();
                }}
              />
              <button
                type="button"
                aria-label="Send message"
                disabled={!canSend}
                // Keep the text area's focus: a press on the button must not blur an empty-looking draft away.
                onPointerDown={(e) => e.preventDefault()}
                onClick={submit}
                // Your colour, like the border, while it can send: through the identity fill, so dark mode deepens it
                // under the white glyph as it does every name chip.
                style={
                  canSend
                    ? avatarBindings.identityVars(colour || AVATAR_FALLBACK_COLOUR)
                    : undefined
                }
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${
                  canSend
                    ? `text-white ${IDENTITY_FILL}`
                    : 'cursor-default bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-400'
                }`}
              >
                <SendIcon />
              </button>
            </div>
            {coolingDown || draft ? (
              <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                <span>{coolingDown ? 'One moment…' : 'Enter to send, Esc to cancel'}</span>
                <SpeechCounter text={draft} />
              </div>
            ) : null}
          </SpeechCard>
        </div>
      </div>
    </AtPoint>
  );
}

export function AvatarSpeechLayer({
  bubbles,
  activeTabId,
  zoom,
  view,
  peers,
  composer,
  self,
  obstacles,
}: {
  bubbles: SpeechBubble[];
  activeTabId: string;
  zoom: number;
  // The visible canvas, for keeping each bubble inside it.
  view: SpeechView;
  // Peers' characters on this tab, for each speaker's name and colour.
  peers: readonly Peer[];
  // The composer, while it is open.
  composer: SpeechComposerProps | null;
  // Your own name and colour, for your bubbles.
  self: { name: string; colour: string };
  // Canvas rects every floating bubble keeps clear of (livehuddle's camera and screen bubbles), read each frame.
  obstacles?: RefObject<readonly SpeechObstacle[]>;
}) {
  // Who said each bubble, decided once their character is found: a peer whose character is not on this tab (or is
  // hidden by a hide-cursors vote) is not drawn, and one who walks off afterwards keeps their words on screen. Not
  // found yet (their presence lands a frame after their words, or they spoke on a tab you open a moment later), the
  // bubble is looked for again while it flies. Adjusted during render, so a bubble draws in the same render its
  // speaker is found in. A peer's message is read out (docs/specs/008-canvas/avatar-mode.md "The wire") at that
  // moment, once.
  const [speakers, setSpeakers] = useState(() => new Map<string, Speaker>());
  const [announcement, setAnnouncement] = useState('');
  const liveIds = new Set(bubbles.map((b) => b.id));
  const pending = bubbles.filter((b) => !b.own && !speakers.get(b.id));
  const found = pending.flatMap((b) => {
    const peer = peers.find((p) => p.id === b.from);
    return peer ? [{ b, peer }] : [];
  });
  const unseen = pending.some((b) => !speakers.has(b.id));
  const stale = [...speakers.keys()].some((id) => !liveIds.has(id));
  if (found.length > 0 || unseen || stale) {
    const next = new Map([...speakers].filter(([id]) => liveIds.has(id)));
    for (const b of pending) if (!next.has(b.id)) next.set(b.id, null);
    let heard: string | null = null;
    for (const { b, peer } of found) {
      next.set(b.id, { name: peer.name, colour: peer.color });
      heard = `${peer.name || 'Someone'} says: ${b.text}`;
    }
    setSpeakers(next);
    if (heard) setAnnouncement(heard);
  }
  const speakerOf = (b: SpeechBubble): Speaker => (b.own ? self : (speakers.get(b.id) ?? null));
  const shown = bubbles.filter((b) => b.tabId === activeTabId && speakerOf(b) !== null);

  // Each bubble's nodes, kept by callback refs and read only by the flight loop below.
  const nodes = useRef<BubbleNodes>(new Map());
  // The flight: one loop while anything is flying, its first frame written before paint so a new bubble never
  // shows a frame out of place.
  const shownRef = useLatest(shown);
  const viewRef = useLatest({ zoom, offsetX: view.offsetX, width: view.width });
  const obstaclesRef = useLatest(obstacles);
  const flying = shown.length > 0;
  useLayoutEffect(() => {
    if (!flying) return;
    let raf = 0;
    // Read once per flight, not every frame.
    const reduced = prefersReducedMotion();
    const tick = () => {
      const now = performance.now();
      const around = obstaclesRef.current?.current ?? EMPTY_OBSTACLES;
      for (const b of shownRef.current) {
        const n = nodes.current.get(b.id);
        if (!n?.card) continue;
        const v = viewRef.current;
        const m = motionOf(
          b,
          now,
          reduced,
          {
            x: screenX(b.x, v.zoom, v.offsetX, v.width),
            width: n.width,
            viewWidth: v.width,
          },
          liftOf(n, b, now, reduced, v, around) * v.zoom,
        );
        n.card.style.transform = m.transform;
        n.card.style.opacity = String(m.opacity);
        if (n.tail) {
          n.tail.style.opacity = String(m.tail);
          n.tail.style.marginLeft = `${m.tailOffset}px`;
        }
      }
    };
    const loop = () => {
      tick();
      raf = requestAnimationFrame(loop);
    };
    tick();
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [flying, shown.length, shownRef, viewRef, obstaclesRef]);

  return (
    <>
      {shown.map((b) => (
        <FlyingBubble key={b.id} bubble={b} speaker={speakerOf(b)!} zoom={zoom} nodes={nodes} />
      ))}
      {composer ? <Composer {...composer} zoom={zoom} view={view} colour={self.colour} /> : null}
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
    </>
  );
}
