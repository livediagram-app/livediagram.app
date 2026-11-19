'use client';

// The Receptionist's bubble (docs/specs/008-canvas/receptionist.md "Asking the Receptionist"): a speech bubble over
// his head, amber-edged, holding replies. Every topic in one grouped list, or one topic's answer with the real control
// ringed, or his farewell. Yours alone: it is drawn on your screen and sent nowhere. It takes no focus.

import { billboardOrigin, SPACE_BILLBOARD_ATTR } from '@livehuddle/avatar/billboard';
import { InSpace3DOverlay, useInSpace3D } from '@/components/canvas/space-3d/Space3DOverlay';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useViewportStoreIfAny } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { SpeechCard } from '@livehuddle/avatar/components/AvatarSpeechBubble';
import { SPEECH_TOP_CLEAR, tailOffset } from '@livehuddle/avatar/speech';
import type { AvatarPoint } from '@livehuddle/avatar/walk';
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
import { clearNudge, clearTrim, KEEP_CLEAR_ATTR, type ScreenBox } from './keep-clear';
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
// Screen px between his head and the card when it stands beside him.
const SIDE_GAP = 12;
// The least of his topics (or an answer) a card shows when the view cannot give it its whole height: never a sliver.
const MIN_LIST_H = 160;
// How many times one opening pans the view to make room over his head: a pan in the 3D view lands a little short of
// what it asked for (the tilt), so the passes after it top it up.
const PAN_TRIES = 3;
// After the view moves (or the card opens) the card is placed again each frame until it has stood still this many
// frames: the 3D camera eases after a pan in DOM writes React never sees. Never more than SETTLE_MAX frames (2 s).
const SETTLE_STILL = 8;
const SETTLE_MAX = 120;

/** The controls on screen his card keeps clear of (keep-clear.ts): each one's box, skipping any not laid out. */
function keepClearBoxes(): ScreenBox[] {
  const out: ScreenBox[] = [];
  for (const el of document.querySelectorAll(`[${KEEP_CLEAR_ATTR}]`)) {
    const b = el.getBoundingClientRect();
    if (b.width > 0 && b.height > 0)
      out.push({ left: b.left, right: b.right, top: b.top, bottom: b.bottom });
  }
  return out;
}

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
      className={`mt-2 min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain ${
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
  // An Editor's Ask to Leave; absent for everyone else.
  onLeave?: () => void;
}) {
  const { chat, can, heard, name } = useReceptionistState();
  const topics = useMemo(() => receptionistTopicsFor(can), [can]);
  // Kept inside the canvas: nudged sideways (screen px) off its sides, its tail still on his head; above him when it
  // fits under the chrome along the top, else on whichever side of him has more room (SPEECH_TOP_CLEAR from the top
  // and bottom edges, as every bubble), its replies scrolling inside when even that is too short.
  const card = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState({
    nudge: 0,
    below: false,
    width: 0,
    maxH: 0,
    lift: 0,
    beside: false,
    fit: 1,
  });
  const { nudge, below, width, maxH, lift, beside, fit } = place;
  // In the 3D view the card is drawn in the overlay, standing over his head, and placed again whenever the view turns.
  const in3D = useInSpace3D();
  // The view, to pan it when there is no room over his head (below), and to place the card again as it moves.
  const viewport = useViewportStoreIfAny();
  // The pans this opening has made (PAN_TRIES at most), reset as it opens.
  const pans = useRef(0);
  function placeCard() {
    const el = card.current;
    const list = scroller.current;
    if (!el || !list) return;
    const r = el.getBoundingClientRect();
    // Not laid out (hidden, or no layout at all): nothing to keep on screen.
    if (r.width === 0) return;
    // In the 3D view the camera's depth scales the card too: it is scaled back to read at its own size, as flat, so it
    // never grows past a phone's sides as he comes nearer, and the screen px below are its own px again.
    const depth = in3D && el.offsetWidth > 0 ? r.width / el.offsetWidth : 1;
    const nextFit = in3D ? fit / depth : 1;
    if (Math.abs(nextFit - fit) > 0.02 * fit) {
      setPlace({ ...place, fit: nextFit });
      return;
    }
    const box = el.closest('[data-canvas-root]')?.getBoundingClientRect();
    // The canvas, and never past the window (a phone's canvas can run wider than its screen).
    const minX = Math.max(box?.left ?? 0, 0) + EDGE;
    const maxX = Math.min(box?.right ?? window.innerWidth, window.innerWidth) - EDGE;
    const left = r.left - nudge;
    const right = r.right - nudge;
    // Where the card would stand with no lift (it is moved down only beside him, below).
    const rTop = r.top - lift;
    const rBottom = r.bottom - lift;
    const inside = left < minX ? minX - left : right > maxX ? maxX - right : 0;
    // Where his head and feet are on screen, from wherever the card sits now.
    const tall = (feet.y - head.y) * zoom;
    const headY = below ? rTop - UNDER_FEET - tall : rBottom + TAIL;
    const feetY = headY + tall;
    const top = Math.max(box?.top ?? 0, 0) + SPEECH_TOP_CLEAR;
    const bottom =
      Math.min(box?.bottom ?? window.innerHeight, window.innerHeight) - SPEECH_TOP_CLEAR;
    const roomAbove = headY - TAIL - top;
    const roomBelow = bottom - feetY - UNDER_FEET;
    // Its whole height uncapped: the card as it is, plus what its scroller (the topic list, up to its own seven rows, or
    // a long answer) hides while it is capped.
    const frame = r.height - list.clientHeight;
    let hidden = 0;
    for (const c of Array.from(list.children) as HTMLElement[]) {
      const own = c.style.maxHeight ? parseFloat(c.style.maxHeight) : Infinity;
      hidden += Math.max(0, Math.min(c.scrollHeight, own) - c.clientHeight);
    }
    const natural = r.height + hidden;
    // No room over his head for the whole card: the view pans down to make it, clear of the chrome along the top, before
    // anything else, keeping his feet on screen (receptionist.md "His bubble", Work Tracker 1256). Then it stands over
    // his head at its own height. In the 3D view as flat.
    // Never so far that a control kept clear of the card (keep-clear.ts, a desk's Welcome with its Ring Bell) leaves
    // the screen.
    const keep = keepClearBoxes();
    const lowest = keep.reduce((y, k) => Math.max(y, k.bottom), feetY);
    if (natural > roomAbove + 1 && viewport && pans.current < PAN_TRIES && !below && !beside) {
      const pan = Math.min(natural - roomAbove, bottom - lowest);
      if (pan > 1) {
        pans.current += 1;
        // The offset is in canvas px, under the zoom (viewportTransform).
        const z = viewport.get().zoom;
        viewport.setOffset((o) => ({ x: o.x, y: o.y + pan / z }));
        return;
      }
    }
    // Under his feet only when the view could not make the room over his head, there is more room below, and the card
    // there covers no such control even moved sideways. In the 3D view never (docs/specs/008-canvas/3d-view.md): it
    // would lie on the floor under the walls.
    const underTop = feetY + UNDER_FEET;
    const under = { left, right, top: underTop, bottom: underTop + Math.min(natural, roomBelow) };
    const underClear = keep.length === 0 || clearNudge(under, inside, keep, minX, maxX) !== null;
    const nextBelow = !in3D && natural > roomAbove + 1 && roomBelow > roomAbove && underClear;
    const room = nextBelow ? roomBelow : roomAbove;
    // In 3D with too little room over his head for the whole card, it stands beside him instead, on the side with
    // more room, level with his head and kept between the top and bottom edges, its tail dropped (receptionist.md "His
    // bubble"): never capped to a sliver with no topics showing. Only where that side has room for the card.
    const headX = (left + right) / 2;
    const roomLeft = headX - SIDE_GAP - minX;
    const roomRight = maxX - headX - SIDE_GAP;
    const nextBeside = in3D && natural > roomAbove + 1 && Math.max(roomLeft, roomRight) >= r.width;
    const sideH = Math.min(natural, bottom - top);
    const sideNudge = (roomRight >= roomLeft ? 1 : -1) * (r.width / 2 + SIDE_GAP);
    const sideTop = Math.min(Math.max(headY - sideH / 2, top), bottom - sideH);
    const nextLift = nextBeside ? Math.round(sideTop - (rBottom - sideH)) : 0;
    const fitH = nextBeside
      ? sideH < natural
        ? Math.max(MIN_LIST_H, Math.floor(sideH - frame))
        : 0
      : natural > room + 1
        ? Math.max(MIN_LIST_H, Math.floor(room - frame))
        : 0;
    // Clear of those controls (Work Tracker 1256), judged on the whole card, uncapped, where it stands, so the answer is
    // the same on every pass: off to the nearer side that has the room; else, over his head, shorter, its replies
    // scrolling.
    const cardTop = nextBeside ? sideTop : nextBelow ? rTop : rBottom - natural;
    const whole = { left, right, top: cardTop, bottom: cardTop + (nextBeside ? sideH : natural) };
    const base = nextBeside ? sideNudge : inside;
    const sideways = keep.length > 0 ? clearNudge(whole, base, keep, minX, maxX) : base;
    const nextNudge = sideways ?? base;
    const trim =
      sideways === null && !nextBelow && !nextBeside
        ? clearTrim({ ...whole, left: left + inside, right: right + inside }, keep)
        : 0;
    const trimH = trim > 0 ? Math.max(MIN_LIST_H, Math.floor(natural - trim - frame)) : 0;
    const nextMaxH = trimH && fitH ? Math.min(trimH, fitH) : trimH || fitH;
    if (
      Math.abs(nextNudge - nudge) > 0.5 ||
      nextBelow !== below ||
      Math.abs(r.width - width) > 0.5 ||
      nextMaxH !== maxH ||
      nextLift !== lift ||
      nextBeside !== beside
    )
      setPlace({
        fit,
        nudge: nextNudge,
        below: nextBelow,
        width: r.width,
        maxH: nextMaxH,
        lift: nextLift,
        beside: nextBeside,
      });
  }
  // Placed after every render (a new line or topic, his head moving, the zoom, the 3D view turning): it measures and
  // sets state only when the place changed, so it settles in one more pass. The latest pass is kept for the view and
  // the window to run again (below).
  const placeAgain = useRef<() => void>(() => {});
  const open = chat.open;
  useLayoutEffect(() => {
    if (open) pans.current = 0;
  }, [open]);
  useLayoutEffect(() => {
    placeAgain.current = placeCard;
    placeCard();
  });
  // Placed again whenever the view pans or zooms under it, or the window resizes (Work Tracker 912): his head's canvas
  // point and the zoom stay the same through a pan, a camera fit or a phone turning, so the pass above would not run
  // and the card was left where it was, off the screen's side. At most once a frame, only while it is open, and only
  // until it stands still (SETTLE_STILL, SETTLE_MAX): a still Space asks for no frames (Work Tracker 1257).
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    let left = 0;
    let still = 0;
    let last = '';
    const tick = () => {
      frame = 0;
      placeAgain.current();
      const b = card.current?.getBoundingClientRect();
      const now = b ? `${Math.round(b.left)} ${Math.round(b.top)} ${Math.round(b.width)}` : '';
      still = now === last ? still + 1 : 0;
      last = now;
      left -= 1;
      if (left > 0 && still < SETTLE_STILL) frame = requestAnimationFrame(tick);
    };
    const again = () => {
      left = SETTLE_MAX;
      still = 0;
      if (!frame) frame = requestAnimationFrame(tick);
    };
    again();
    const off = viewport?.subscribe(again);
    window.addEventListener('resize', again);
    return () => {
      off?.();
      window.removeEventListener('resize', again);
      cancelAnimationFrame(frame);
    };
  }, [viewport, open]);
  if (!chat.open) return null;
  const topic = chat.topicId ? (topics.find((t) => t.id === chat.topicId) ?? null) : null;
  const choose = (t: ReceptionistTopic) => {
    track('UI', 'View', receptionistTopicTelemetryType(t.id));
    showReceptionistTopic(t.id);
  };
  const isHeard = (t: ReceptionistTopic) => heard.includes(t.id);
  const line = topic ? topic.answer : receptionistLine(chat.reason, name);
  return (
    // In the 3D view the card stands up about his feet (billboard.ts), in the overlay where no wall hides it; flat,
    // this zero box does nothing.
    <InSpace3DOverlay>
      <div
        {...SPACE_BILLBOARD_ATTR}
        className="pointer-events-none absolute left-0 top-0"
        style={billboardOrigin(feet.x, feet.y, '0px', '0px')}
      >
        <div
          role="dialog"
          aria-label="Receptionist"
          data-receptionist-bubble=""
          // The box stays where he stands while the card inside moves sideways, so only the card takes presses: a
          // control the card moved off (a Ring Bell, Work Tracker 1256) stays pressable under the empty box.
          className="pointer-events-none absolute z-10"
          style={{
            left: head.x,
            top: below ? feet.y : head.y,
            transform: below
              ? `translate(-50%, ${UNDER_FEET / zoom}px) scale(${1 / zoom})`
              : `translate(-50%, -100%) scale(${fit / zoom})`,
            transformOrigin: below ? '50% 0' : '50% 100%',
            width: `min(${BUBBLE_W}px, calc(100vw - 32px))`,
          }}
        >
          <div
            ref={card}
            className="pointer-events-auto"
            style={
              nudge || lift
                ? { transform: `translateX(${nudge}px)${lift ? ` translateY(${lift}px)` : ''}` }
                : undefined
            }
            onPointerDown={(e) => e.stopPropagation()}
          >
            <SpeechCard
              colour={RECEPTIONIST_COLOUR}
              maxWidth={BUBBLE_W}
              // Under his feet or beside him there is nothing to point at; shifted sideways, the tail still points at his head.
              tail={!below && !beside}
              tailShift={tailOffset(nudge, width)}
            >
              {/* One scroller at a time (the topic list, or a long answer), the replies pinned at the foot
                  (receptionist.md "The card"). */}
              <div
                ref={scroller}
                className="flex min-h-0 flex-col"
                style={maxH ? { maxHeight: maxH } : undefined}
              >
                {topic ? (
                  <>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                      <TypedLine className="text-[13px] leading-snug" text={line} />
                    </div>
                    <div className="mt-2 flex shrink-0 flex-wrap gap-1.5">
                      <Reply onClick={() => showReceptionistTopic(null)}>Another Topic</Reply>
                      <Reply tone="quiet" onClick={closeReceptionist}>
                        I&apos;ll Explore
                      </Reply>
                    </div>
                  </>
                ) : chat.reason === 'farewell' ? (
                  <TypedLine className="text-[13px] leading-snug" text={line} />
                ) : (
                  <>
                    <TypedLine className="shrink-0 text-[13px] leading-snug" text={line} />
                    <TopicList label="Topics">
                      {RECEPTIONIST_TOPIC_GROUPS.map((group) => {
                        const inGroup = topics.filter((t) => t.group === group);
                        if (inGroup.length === 0) return null;
                        return (
                          <section key={group} aria-label={group} className="mb-2 last:mb-0">
                            <h3 className="sticky top-0 z-[1] bg-white pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-600 dark:bg-slate-900 dark:text-amber-300">
                              {group}
                            </h3>
                            {/* A pixel under the heading, so the first row's top border is never under it. */}
                            <ul className="flex flex-col pt-px" style={{ gap: ROW_GAP }}>
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
                    <div className="mt-2 flex shrink-0 flex-wrap gap-1.5 border-t border-slate-200 pt-2 dark:border-slate-700">
                      <Reply tone="quiet" onClick={closeReceptionist}>
                        I&apos;ll Explore
                      </Reply>
                      {onLeave ? (
                        <Reply tone="leave" onClick={onLeave}>
                          Ask to Leave
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
      </div>
    </InSpace3DOverlay>
  );
}
