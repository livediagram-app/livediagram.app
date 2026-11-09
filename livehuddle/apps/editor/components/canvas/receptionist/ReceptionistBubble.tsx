'use client';

// The Receptionist's bubble (docs/specs/008-canvas/receptionist.md "Asking the Receptionist"): a speech bubble over
// his head, amber-edged, holding replies. Every topic in one grouped list, or one topic's answer with the real control
// ringed, or his farewell. Yours alone: it is drawn on your screen and sent nowhere. It takes no focus.

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SpeechCard } from '@liveworkspace/avatar/components/AvatarSpeechBubble';
import { SPEECH_TOP_CLEAR, tailOffset } from '@liveworkspace/avatar/speech';
import type { AvatarPoint } from '@liveworkspace/avatar/walk';
import {
  RECEPTIONIST_TOPIC_GROUPS,
  receptionistTopicTelemetryType,
  receptionistTopicsFor,
  type ReceptionistTopic,
} from '@/lib/receptionist/receptionist-topics';
import {
  closeReceptionist,
  showReceptionistTopic,
  useReceptionistState,
} from '@/lib/receptionist/receptionist-store';
import { track } from '@/lib/telemetry';
import { RECEPTIONIST_COLOUR } from '@/lib/receptionist/receptionist-look';
import { ReceptionistRing } from './ReceptionistRing';
import { TypedLine } from './TypedLine';

// His bubble's width in screen px (never past a phone's screen less 32), so every topic row is the same width.
const BUBBLE_W = 300;
// A topic row's height and the gap between rows; the list shows this many rows, then scrolls.
const ROW_H = 32;
const ROW_GAP = 4;
const VISIBLE_ROWS = 7;
const LIST_MAX_H = VISIBLE_ROWS * ROW_H + (VISIBLE_ROWS - 1) * ROW_GAP;

// Screen px his bubble keeps from the canvas's sides, and the gap under his feet when it flips below him.
const EDGE = 16;
const UNDER_FEET = 10;
// The tail's reach below the card, in screen px.
const TAIL = 6;

/** His opening line: the welcome, a returning person's hello by their first name, Ask Receptionist, the bell, or goodbye. */
export function receptionistLine(
  reason: 'welcome' | 'back' | 'ask' | 'farewell' | 'bell',
  name: string | null,
): string {
  if (reason === 'welcome') return "Welcome in! I'm the receptionist. What should I show you?";
  if (reason === 'back') return `Welcome back${name ? `, ${name}` : ''}! What can I help with?`;
  if (reason === 'bell') return `You rang${name ? `, ${name}` : ''}? What can I help with?`;
  if (reason === 'farewell') return "Of course. Bring me back any time from the Avatar Pad's menu.";
  return 'What can I help with?';
}

function Reply({
  children,
  onClick,
  tone = 'topic',
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: 'topic' | 'leave' | 'quiet';
}) {
  const look =
    tone === 'leave'
      ? 'border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-400/50 dark:text-rose-300 dark:hover:bg-rose-400/10'
      : tone === 'quiet'
        ? 'border-slate-300 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800'
        : 'border-brand-500/60 text-brand-700 hover:bg-brand-50 dark:text-brand-200 dark:hover:bg-brand-400/10';
  return (
    <button
      type="button"
      className={`touch-target-y relative cursor-pointer rounded-full border px-2.5 py-1 text-[12px] font-semibold leading-none transition-colors duration-micro ${look}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

/** One topic: a full-width row, ticked once heard, with a chevron on its right. */
function TopicRow({
  topic,
  heard,
  onChoose,
}: {
  topic: ReceptionistTopic;
  heard: boolean;
  onChoose: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={`relative flex w-full cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-left text-[13px] font-semibold leading-tight transition-colors duration-micro after:ml-auto after:text-[15px] after:font-normal after:opacity-60 after:content-['›'] ${
          heard
            ? 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
            : 'border-brand-500/40 text-brand-700 hover:border-brand-500/70 hover:bg-brand-50 dark:text-brand-200 dark:hover:bg-brand-400/10'
        }`}
        style={{ height: ROW_H }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onChoose();
        }}
      >
        {heard ? (
          <span aria-hidden className="text-emerald-600 dark:text-emerald-400">
            ✓
          </span>
        ) : null}
        <span className="min-w-0 truncate">{topic.title}</span>
        {heard ? <span className="sr-only"> (heard)</span> : null}
      </button>
    </li>
  );
}

/**
 * The topic rows: seven show, then the list scrolls, a fade at its foot while there is more below. Its own scroll, so
 * a wheel or a swipe over it moves the list, never the canvas.
 */
function TopicList({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const measure = () => {
    const el = ref.current;
    if (el) setMore(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  };
  useLayoutEffect(measure);
  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      className={`mt-2 touch-pan-y overflow-y-auto overscroll-contain ${
        more ? '[mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]' : ''
      }`}
      style={{ maxHeight: LIST_MAX_H }}
      onScroll={measure}
      onWheel={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

export function ReceptionistBubble({
  head,
  feet,
  zoom,
  onLeave,
}: {
  head: AvatarPoint;
  feet: AvatarPoint;
  zoom: number;
  // An Editor's Ask Receptionist to Leave; absent for everyone else.
  onLeave?: () => void;
}) {
  const { chat, can, heard, name } = useReceptionistState();
  const topics = useMemo(() => receptionistTopicsFor(can), [can]);
  // Kept inside the canvas: nudged sideways (screen px) off its sides, its tail still on his head; above him when it
  // fits under the chrome along the top, else on whichever side of him has more room (SPEECH_TOP_CLEAR from the top
  // and bottom edges, as every bubble), its replies scrolling inside when even that is too short.
  const card = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState({ nudge: 0, below: false, width: 0, maxH: 0 });
  const { nudge, below, width, maxH } = place;
  const view = chat.open ? `${chat.topicId}|${chat.reason}` : '';
  useLayoutEffect(() => {
    const el = card.current;
    const list = scroller.current;
    if (!el || !list) return;
    const r = el.getBoundingClientRect();
    // Not laid out (hidden, or no layout at all): nothing to keep on screen.
    if (r.width === 0) return;
    const box = el.closest('[data-canvas-root]')?.getBoundingClientRect();
    // The canvas, and never past the window (a phone's canvas can run wider than its screen).
    const minX = Math.max(box?.left ?? 0, 0) + EDGE;
    const maxX = Math.min(box?.right ?? window.innerWidth, window.innerWidth) - EDGE;
    const left = r.left - nudge;
    const right = r.right - nudge;
    const nextNudge = left < minX ? minX - left : right > maxX ? maxX - right : 0;
    // Where his head and feet are on screen, from wherever the card sits now.
    const tall = (feet.y - head.y) * zoom;
    const headY = below ? r.top - UNDER_FEET - tall : r.bottom + TAIL;
    const feetY = headY + tall;
    const top = Math.max(box?.top ?? 0, 0) + SPEECH_TOP_CLEAR;
    const bottom =
      Math.min(box?.bottom ?? window.innerHeight, window.innerHeight) - SPEECH_TOP_CLEAR;
    const roomAbove = headY - TAIL - top;
    const roomBelow = bottom - feetY - UNDER_FEET;
    // Its whole height uncapped: the card round the list, plus all of the list.
    const frame = r.height - list.clientHeight;
    const natural = frame + list.scrollHeight;
    const nextBelow = natural > roomAbove && roomBelow > roomAbove;
    const room = nextBelow ? roomBelow : roomAbove;
    const nextMaxH = natural > room ? Math.max(80, Math.floor(room - frame)) : 0;
    if (
      Math.abs(nextNudge - nudge) > 0.5 ||
      nextBelow !== below ||
      Math.abs(r.width - width) > 0.5 ||
      nextMaxH !== maxH
    )
      setPlace({ nudge: nextNudge, below: nextBelow, width: r.width, maxH: nextMaxH });
  }, [head.y, feet.y, head.x, zoom, view, nudge, below, width, maxH]);
  if (!chat.open) return null;
  const topic = chat.topicId ? (topics.find((t) => t.id === chat.topicId) ?? null) : null;
  const choose = (t: ReceptionistTopic) => {
    track('UI', 'View', receptionistTopicTelemetryType(t.id));
    showReceptionistTopic(t.id);
  };
  const isHeard = (t: ReceptionistTopic) => heard.includes(t.id);
  const line = topic ? topic.answer : receptionistLine(chat.reason, name);
  return (
    <>
      <div
        role="dialog"
        aria-label="Receptionist"
        data-receptionist-bubble=""
        className="pointer-events-auto absolute z-10"
        style={{
          left: head.x,
          top: below ? feet.y : head.y,
          transform: below
            ? `translate(-50%, ${UNDER_FEET / zoom}px) scale(${1 / zoom})`
            : `translate(-50%, -100%) scale(${1 / zoom})`,
          transformOrigin: below ? '50% 0' : '50% 100%',
          width: `min(${BUBBLE_W}px, calc(100vw - 32px))`,
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div ref={card} style={nudge ? { transform: `translateX(${nudge}px)` } : undefined}>
          <SpeechCard
            colour={RECEPTIONIST_COLOUR}
            maxWidth={BUBBLE_W}
            // Under his feet there is nothing to point at; shifted sideways, the tail still points at his head.
            tail={!below}
            tailShift={tailOffset(nudge, width)}
          >
            <div
              ref={scroller}
              className={maxH ? 'overscroll-contain overflow-y-auto' : undefined}
              style={maxH ? { maxHeight: maxH } : undefined}
            >
              <TypedLine className="text-[13px] leading-snug" text={line} />
              {topic ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Reply onClick={() => showReceptionistTopic(null)}>Another Topic</Reply>
                  <Reply tone="quiet" onClick={closeReceptionist}>
                    I&apos;ll Explore
                  </Reply>
                </div>
              ) : chat.reason === 'farewell' ? null : (
                <>
                  <TopicList label="Topics">
                    {RECEPTIONIST_TOPIC_GROUPS.map((group) => {
                      const inGroup = topics.filter((t) => t.group === group);
                      if (inGroup.length === 0) return null;
                      return (
                        <section key={group} aria-label={group} className="mb-1.5 last:mb-0">
                          <h3 className="sticky top-0 z-[1] bg-white pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-600 dark:bg-slate-900 dark:text-amber-300">
                            {group}
                          </h3>
                          <ul className="flex flex-col" style={{ gap: ROW_GAP }}>
                            {inGroup.map((t) => (
                              <TopicRow
                                key={t.id}
                                topic={t}
                                heard={isHeard(t)}
                                onChoose={() => choose(t)}
                              />
                            ))}
                          </ul>
                        </section>
                      );
                    })}
                  </TopicList>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Reply tone="quiet" onClick={closeReceptionist}>
                      I&apos;ll Explore
                    </Reply>
                    {onLeave ? (
                      <Reply tone="leave" onClick={onLeave}>
                        Ask Receptionist to Leave
                      </Reply>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </SpeechCard>
        </div>
      </div>
      {topic?.target && topic.target !== 'room' ? (
        <ReceptionistRing selector={topic.target} />
      ) : null}
    </>
  );
}
