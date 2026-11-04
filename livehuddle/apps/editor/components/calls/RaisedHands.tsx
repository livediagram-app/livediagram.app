'use client';

// Raised hands (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Raise hand"): a small round badge beside the
// head of everyone whose hand is up, amber with a hand, or the brand's microphone once they are let speak. For
// whoever may let speak (an Editor, or someone speaking from a stage) each peer's badge is a button: Let Speak on a
// raised hand, Done on a speaking one. Drawn inside the canvas's transformed layer, beside the talking bars.
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { lucideHand, lucideMic } from '@liveworkspace/icons/lucide';
import { avatarGlides } from '@liveworkspace/avatar/relay';
import { AVATAR_HEIGHT } from '@liveworkspace/avatar/walk';
import { HoverCard, lucideGlyph } from '@livehuddle/ui';
import { useCallHands, useCallSelf } from '@/lib/calls/calls-store';
import type { Point } from '@/lib/calls/hearing';
import type { TalkingBarsPeer } from './TalkingBars';

const HandIcon = lucideGlyph(lucideHand, 12);
const MicIcon = lucideGlyph(lucideMic, 12);

/** The badge's centre: right of the head, level with the eyes, scaled with the character. */
export const HAND_BADGE_DX = 15;
export const HAND_BADGE_DY = 6;

export function handBadgeAt(at: Point, scale: number): Point {
  return {
    x: at.x + HAND_BADGE_DX * scale,
    y: at.y - AVATAR_HEIGHT * scale + HAND_BADGE_DY * scale,
  };
}

// The badge's face: amber hand while raised, brand microphone while speaking. A ring in the canvas's own colour lifts
// it off a character or the floor in either theme.
const FACE =
  'flex size-[22px] items-center justify-center rounded-full shadow-md ring-2 ring-white dark:ring-slate-900';
const RAISED = 'bg-amber-400 text-amber-950';
const SPEAKING = 'bg-brand-600 text-white';

function Badge({ speaking }: { speaking: boolean }) {
  return (
    <span aria-hidden className={`${FACE} ${speaking ? SPEAKING : RAISED}`}>
      {speaking ? <MicIcon /> : <HandIcon />}
    </span>
  );
}

// Placed where the character's head is, sliding with its glide as the talking bars do.
function Placed(props: {
  id: string;
  at: Point;
  scale: number;
  glideMs: number;
  walking: boolean;
  children: ReactNode;
}) {
  const placed = useRef<HTMLDivElement>(null);
  const from = useRef(props.at);
  useLayoutEffect(() => {
    const glides = avatarGlides(from.current, props.at, props.glideMs, props.walking);
    from.current = props.at;
    if (placed.current) {
      placed.current.style.transition = glides
        ? `left ${props.glideMs}ms linear, top ${props.glideMs}ms linear`
        : '';
    }
  }, [props.at, props.glideMs, props.walking]);
  const centre = handBadgeAt(props.at, props.scale);
  return (
    <div
      ref={placed}
      data-raised-hand={props.id}
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2 motion-safe:animate-card-rise"
      style={{ left: centre.x, top: centre.y }}
    >
      {props.children}
    </div>
  );
}

export function RaisedHands(props: {
  peers: readonly TalkingBarsPeer[];
  self: { at: Point; scale: number } | null;
  // Present when you may let a raised hand speak.
  onLetSpeak?: (peerId: string, on: boolean) => void;
}) {
  const { hands, letByMe } = useCallHands();
  const self = useCallSelf();
  const raised = props.peers.filter((p) => hands.has(p.id));
  const selfUp = props.self && self.hand !== 'down';
  if (raised.length === 0 && !selfUp) return null;

  return (
    <>
      {raised.map((p) => {
        const hand = hands.get(p.id)!;
        const speaking = hand.letSpeak !== null || letByMe.has(p.id);
        const label = speaking ? `${p.name} is speaking` : `${p.name} raised a hand`;
        const action = speaking ? 'Done' : 'Let Speak';
        return (
          <Placed
            key={p.id}
            id={p.id}
            at={p.at}
            scale={p.scale}
            glideMs={p.glideMs}
            walking={p.walking}
          >
            {props.onLetSpeak ? (
              <HoverCard
                title={`${label}`}
                description={
                  speaking
                    ? 'Press Done to end their turn. Their hand goes down.'
                    : 'Press to let them speak: the whole Space hears them, as from the stage.'
                }
              >
                <button
                  type="button"
                  aria-label={`${label}, ${action}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => props.onLetSpeak?.(p.id, !speaking)}
                  className="pointer-events-auto block cursor-pointer rounded-full transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-95"
                >
                  <Badge speaking={speaking} />
                </button>
              </HoverCard>
            ) : (
              <HoverCard title={label}>
                <span role="img" aria-label={label} className="pointer-events-auto block">
                  <Badge speaking={speaking} />
                </span>
              </HoverCard>
            )}
          </Placed>
        );
      })}
      {selfUp && props.self ? (
        <Placed id="self" at={props.self.at} scale={props.self.scale} glideMs={0} walking={false}>
          <span
            role="img"
            aria-label={self.hand === 'speaking' ? 'You are speaking' : 'Your hand is raised'}
            className="block"
          >
            <Badge speaking={self.hand === 'speaking'} />
          </span>
        </Placed>
      ) : null}
    </>
  );
}
