'use client';

// Speech bubbles on the canvas (docs/specs/008-canvas/avatar-mode.md "Speech bubbles", blueprint
// docs/specs/008-canvas/blueprints/avatar-speech.md): the composer above your own character's head and every
// bubble floating away, yours and everyone's. Rendered INSIDE the canvas's transformed wrapper so each sits at
// its canvas point and pans with the canvas, but counter-scaled by the zoom so it is always reading size.
//
// The flight runs on one requestAnimationFrame loop that writes each bubble's transform and opacity straight to
// its node: no React render per frame, and no loop at all while nothing is flying.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { bubbleMotion, type SpeechBubble } from '@/lib/avatar-speech';
import type { AvatarPoint } from '@/lib/avatar-walk';
import { prefersReducedMotion } from '@/lib/motion-preference';
import { SendIcon, SpeechCard, SpeechCounter, SpeechDraftField } from './AvatarSpeechBubble';

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

function motionStyle(b: SpeechBubble, now: number, reduced: boolean): CSSProperties {
  const m = bubbleMotion(
    now - b.bornAt,
    b.flightMs,
    reduced,
    b.leavingAt === undefined ? undefined : now - b.leavingAt,
  );
  return {
    transform: `translate(calc(-50% + ${m.sway}px), ${-m.rise}px) scale(${m.scale})`,
    opacity: m.opacity,
  };
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
                disabled={!draft.trim() || coolingDown}
                // Keep the text area's focus: a press on the button must not blur an empty-looking draft away.
                onPointerDown={(e) => e.preventDefault()}
                onClick={submit}
                // Your colour, like the border: while it can send.
                style={
                  colour && draft.trim() && !coolingDown ? { backgroundColor: colour } : undefined
                }
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:cursor-default disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
              >
                <SendIcon />
              </button>
            </div>
            {coolingDown || draft ? (
              <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-400">
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
  // Who said each bubble, decided once, when it first arrives: a peer whose character is not on this tab (or
  // hidden by a hide-cursors vote) is not drawn, and one who walks off afterwards keeps their words on screen.
  const speakers = useRef(new Map<string, Speaker>());
  const nodes = useRef(
    new Map<string, { card: HTMLDivElement | null; tail: HTMLSpanElement | null }>(),
  );
  const peersRef = useRef(peers);
  peersRef.current = peers;
  const speakerOf = (b: SpeechBubble): Speaker => {
    if (b.own) return self;
    if (!speakers.current.has(b.id)) {
      const peer = peersRef.current.find((p) => p.id === b.from);
      speakers.current.set(b.id, peer ? { name: peer.name, colour: peer.color } : null);
    }
    return speakers.current.get(b.id) ?? null;
  };
  const shown = bubbles.filter((b) => b.tabId === activeTabId && speakerOf(b) !== null);

  // Forget the speakers and nodes of bubbles that are gone.
  useEffect(() => {
    const live = new Set(bubbles.map((b) => b.id));
    for (const id of speakers.current.keys()) if (!live.has(id)) speakers.current.delete(id);
    for (const id of nodes.current.keys()) if (!live.has(id)) nodes.current.delete(id);
  }, [bubbles]);

  // A peer's message, read out once (docs/specs/008-canvas/avatar-mode.md "The wire").
  const [announcement, setAnnouncement] = useState('');
  const announced = useRef(new Set<string>());
  const newestPeer = [...shown].reverse().find((b) => !b.own);
  useEffect(() => {
    if (!newestPeer || announced.current.has(newestPeer.id)) return;
    announced.current.add(newestPeer.id);
    if (announced.current.size > 50)
      announced.current.delete(announced.current.values().next().value!);
    const who = speakers.current.get(newestPeer.id)?.name || 'Someone';
    setAnnouncement(`${who} says: ${newestPeer.text}`);
  }, [newestPeer]);

  // The flight: one loop while anything is flying.
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const flying = shown.length > 0;
  useEffect(() => {
    if (!flying) return;
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const reduced = prefersReducedMotion();
      for (const b of shownRef.current) {
        const n = nodes.current.get(b.id);
        if (!n?.card) continue;
        const style = motionStyle(b, now, reduced);
        n.card.style.transform = style.transform as string;
        n.card.style.opacity = String(style.opacity);
        if (n.tail) {
          n.tail.style.opacity = String(bubbleMotion(now - b.bornAt, b.flightMs, reduced).tail);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [flying]);

  const renderNow = performance.now();
  const reducedNow = prefersReducedMotion();
  return (
    <>
      {shown.map((b) => {
        const speaker = speakerOf(b)!;
        const entry = nodes.current.get(b.id) ?? { card: null, tail: null };
        nodes.current.set(b.id, entry);
        return (
          <AtPoint key={b.id} at={b} zoom={zoom}>
            <div
              aria-hidden
              ref={(el) => {
                entry.card = el;
              }}
              className="absolute bottom-0 left-0 w-max origin-bottom pb-[6px]"
              style={motionStyle(b, renderNow, reducedNow)}
            >
              <SpeechCard
                floating
                colour={speaker.colour || undefined}
                name={speaker.name || undefined}
                tailRef={(el) => {
                  entry.tail = el;
                }}
              >
                <p className="whitespace-pre-wrap break-words">{b.text}</p>
              </SpeechCard>
            </div>
          </AtPoint>
        );
      })}
      {composer ? <Composer {...composer} zoom={zoom} colour={self.colour} /> : null}
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
    </>
  );
}
