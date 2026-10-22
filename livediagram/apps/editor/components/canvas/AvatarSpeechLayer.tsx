'use client';

// Speech bubbles on the canvas (docs/specs/008-canvas/avatar-mode.md "Speech bubbles", blueprint
// docs/specs/008-canvas/blueprints/avatar-speech.md): the composer above your own character's head and every
// bubble floating away, yours and everyone's. Rendered INSIDE the canvas's transformed wrapper so each sits at
// its canvas point and pans with the canvas, but counter-scaled by the zoom so it is always reading size.
//
// The flight runs on one requestAnimationFrame loop that writes each bubble's transform and opacity straight to
// its node: no React render per frame, and no loop at all while nothing is flying.

import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useLatest } from '@/hooks/ui/useLatest';
import { IDENTITY_FILL, identityVars } from '@livediagram/ui';
import { bubbleMotion, type SpeechBubble } from '@/lib/avatar-speech';
import type { AvatarPoint } from '@/lib/avatar-walk';
import { AVATAR_FALLBACK_COLOUR } from '@/lib/avatar-config';
import { prefersReducedMotion } from '@/lib/motion-preference';
import { SendIcon, SpeechCard, SpeechCounter, SpeechDraftField } from './AvatarSpeechBubble';

// The brand cyan a character falls back to with no presence colour (AvatarWalker's).

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
): { transform: string; opacity: number; tail: number } {
  const m = bubbleMotion(
    now - b.bornAt,
    b.flightMs,
    reduced,
    b.leavingAt === undefined ? undefined : now - b.leavingAt,
  );
  return {
    transform: `translate(calc(-50% + ${m.sway}px), ${-m.rise}px) scale(${m.scale})`,
    opacity: m.opacity,
    tail: m.tail,
  };
}

type BubbleNodes = Map<string, { card: HTMLDivElement | null; tail: HTMLSpanElement | null }>;

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
    const entry = nodes.current.get(id) ?? { card: null, tail: null };
    if (part === 'card') entry.card = el as HTMLDivElement | null;
    else entry.tail = el;
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
  colour,
  coolingDown,
  onSend,
  onCancel,
}: SpeechComposerProps & { zoom: number; colour: string }) {
  const [draft, setDraft] = useState('');
  const canSend = !!draft.trim() && !coolingDown;
  const submit = () => {
    if (onSend(draft)) setDraft('');
  };
  return (
    <AtPoint at={head} zoom={zoom}>
      <div
        // A press here is the composer's, never a walk (useCanvasSurfaceGestures skips floating panels).
        data-floating-panel
        className="absolute bottom-0 left-0 w-[240px] -translate-x-1/2 pb-[6px]"
      >
        <div className="origin-bottom animate-speech-pop">
          <SpeechCard colour={colour || undefined}>
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
                style={canSend ? identityVars(colour || AVATAR_FALLBACK_COLOUR) : undefined}
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
  peers,
  composer,
  self,
}: {
  bubbles: SpeechBubble[];
  activeTabId: string;
  zoom: number;
  // Peers' characters on this tab, for each speaker's name and colour.
  peers: readonly Peer[];
  // The composer, while it is open.
  composer: SpeechComposerProps | null;
  // Your own name and colour, for your bubbles.
  self: { name: string; colour: string };
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
  const flying = shown.length > 0;
  useLayoutEffect(() => {
    if (!flying) return;
    let raf = 0;
    // Read once per flight, not every frame.
    const reduced = prefersReducedMotion();
    const tick = () => {
      const now = performance.now();
      for (const b of shownRef.current) {
        const n = nodes.current.get(b.id);
        if (!n?.card) continue;
        const m = motionOf(b, now, reduced);
        n.card.style.transform = m.transform;
        n.card.style.opacity = String(m.opacity);
        if (n.tail) n.tail.style.opacity = String(m.tail);
      }
    };
    const loop = () => {
      tick();
      raf = requestAnimationFrame(loop);
    };
    tick();
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [flying, shown.length, shownRef]);

  return (
    <>
      {shown.map((b) => (
        <FlyingBubble key={b.id} bubble={b} speaker={speakerOf(b)!} zoom={zoom} nodes={nodes} />
      ))}
      {composer ? <Composer {...composer} zoom={zoom} colour={self.colour} /> : null}
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
    </>
  );
}
