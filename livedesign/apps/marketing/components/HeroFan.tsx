'use client';

import { ctaHref } from '@livedesign/api-schema';
import { TemplatePreview } from '@livedesign/template-previews';
import { templateCreateHref, type TemplateKind } from '@livedesign/templates';
import { PREFERS_REDUCED_MOTION, useMediaQuery } from '@livedesign/ui';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  HERO_FAN_OPENING,
  HERO_FAN_SLOTS,
  heroTemplate,
  nextFanKind,
  shuffleFan,
} from '@/lib/hero-starts';
import { createLabelPrefix } from '@/lib/create-label';

// The fan of template cards along the hero's foot (docs/specs/019-marketing/marketing-site.md "Hero"):
// each the editor picker's preview on a card, tilted out from the middle, its lower part running off
// the band, and each a link that creates its template. Every few seconds one card flicks down and out
// and the next template springs up in its place. It deals from every listed template in a fresh random
// order each visit, so a visitor keeps seeing something new: the static HTML is a fixed opening hand,
// hidden once script runs (<html data-hero-deal>) until the shuffled hand deals in over it. It holds
// still while the pointer or focus is on it, while the hero is off screen or the tab hidden, and under
// reduced motion (which still deals a shuffled hand, without the motion). The fan clips only its foot
// (clip-path, and overflow-x for a phone's width), so a card lifted on hover rises over its top
// without losing its title.

// How long each hand holds before the next card swaps, and how long a card takes to flick out.
export const HERO_FAN_SWAP_MS = 3200;
const HERO_FAN_OUT_MS = 380;
// The shuffle button's whole new hand: each card leaves, then arrives, this long after its left neighbour.
const SHUFFLE_STAGGER_MS = 55;
const HERO_FAN_IN_MS = 640;

// Each slot's resting pose, left to right, mirrored about the middle: the outer pair hides on a phone.
const POSE = [
  'max-sm:hidden [transform:translateY(2.5rem)_rotate(-7deg)]',
  '[transform:translateY(0.5rem)_rotate(-4deg)] sm:[transform:translateY(0.75rem)_rotate(-3.5deg)]',
  '[transform:translateY(0)_rotate(0deg)]',
  '[transform:translateY(0.5rem)_rotate(4deg)] sm:[transform:translateY(0.75rem)_rotate(3.5deg)]',
  'max-sm:hidden [transform:translateY(2.5rem)_rotate(7deg)]',
];
// Which way each slot's card leans as it flicks out: away from the middle.
const FLICK = ['-16deg', '-12deg', '12deg', '12deg', '16deg'];
// The order the slots swap in, by how many show: the middle first, then out to the sides, never two
// neighbours running. A slot out of sight is never swapped, so nothing changes where nobody looks.
const ORDER_WIDE = [2, 0, 3, 1, 4];
const ORDER_PHONE = [2, 1, 3];

export function HeroFan() {
  const [slots, setSlots] = useState<TemplateKind[]>(() => [...HERO_FAN_OPENING]);
  // Whether the shuffled hand has been dealt (the static opening hand shows until it is), and whether
  // its cards are still springing in (until the first swap).
  const [dealt, setDealt] = useState(false);
  const [firstDeal, setFirstDeal] = useState(false);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [entering, setEntering] = useState<number | null>(null);
  const [held, setHeld] = useState(false);
  // The shuffle button's deal: the whole hand flicking out, then a new one springing in, card by card.
  const [shuffling, setShuffling] = useState<'out' | 'in' | null>(null);
  const shuffleTimers = useRef<number[]>([]);
  const [onScreen, setOnScreen] = useState(true);
  const reduceMotion = useMediaQuery(PREFERS_REDUCED_MOTION);
  const wide = useMediaQuery('(min-width: 640px)');
  const rootRef = useRef<HTMLDivElement>(null);
  // This visit's shuffled pool, where the deal has got to in it, and how many swaps so far.
  const pool = useRef<TemplateKind[]>([...HERO_FAN_OPENING]);
  const at = useRef(HERO_FAN_SLOTS - 1);
  const swaps = useRef(0);
  // The kinds on show, kept beside the state so a swap reads them without an updater.
  const shown = useRef<TemplateKind[]>(slots);

  // Deal this visit's hand: shuffle the whole pool and lay its first HERO_FAN_SLOTS in, each springing up.
  useEffect(() => {
    pool.current = shuffleFan(Math.random);
    shown.current = pool.current.slice(0, HERO_FAN_SLOTS);
    at.current = HERO_FAN_SLOTS - 1;
    // Reading a random order is the one thing this effect is for: the static HTML has to be one hand
    // for everyone, so the shuffle cannot happen in render.
    setSlots(shown.current);
    setDealt(true);
    setFirstDeal(true);
  }, []);

  // Off screen, or in a hidden tab, nobody is watching: hold.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e?.isIntersecting ?? true));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!dealt || held || shuffling || !onScreen || reduceMotion) return;
    let out: number | undefined;
    const tick = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      const order = wide ? ORDER_WIDE : ORDER_PHONE;
      const slot = order[swaps.current % order.length]!;
      swaps.current += 1;
      setFirstDeal(false);
      setEntering(null);
      setLeaving(slot);
      out = window.setTimeout(() => {
        // Picked here, not in a state updater: React may run an updater twice, which dealt two.
        const next = nextFanKind(pool.current, shown.current, at.current);
        at.current = next.at;
        shown.current = shown.current.map((k, i) => (i === slot ? next.kind : k));
        setSlots(shown.current);
        setLeaving(null);
        setEntering(slot);
      }, HERO_FAN_OUT_MS);
    }, HERO_FAN_SWAP_MS);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(out);
      setLeaving(null);
    };
  }, [dealt, held, shuffling, onScreen, reduceMotion, wide]);

  useEffect(() => () => shuffleTimers.current.forEach((t) => window.clearTimeout(t)), []);

  // A whole new hand: the next cards from this visit's pool that are not showing, so every press brings new ones.
  function dealNewHand() {
    const next: TemplateKind[] = [];
    for (let i = 0; i < shown.current.length; i++) {
      const pick = nextFanKind(pool.current, [...shown.current, ...next], at.current);
      at.current = pick.at;
      next.push(pick.kind);
    }
    shown.current = next;
    setSlots(next);
  }

  function shuffle() {
    if (shuffling || !dealt) return;
    shuffleTimers.current.forEach((t) => window.clearTimeout(t));
    setFirstDeal(false);
    setLeaving(null);
    setEntering(null);
    if (reduceMotion) {
      dealNewHand();
      return;
    }
    const cards = shown.current.length;
    setShuffling('out');
    shuffleTimers.current = [
      window.setTimeout(
        () => {
          dealNewHand();
          setShuffling('in');
        },
        HERO_FAN_OUT_MS + SHUFFLE_STAGGER_MS * (cards - 1),
      ),
      window.setTimeout(
        () => setShuffling(null),
        HERO_FAN_OUT_MS + HERO_FAN_IN_MS + SHUFFLE_STAGGER_MS * 2 * (cards - 1),
      ),
    ];
  }

  return (
    <div
      ref={rootRef}
      data-dealt={dealt ? '' : undefined}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget)) setHeld(false);
      }}
      className="hero-fan mt-12 flex h-36 shrink-0 justify-center gap-2 overflow-x-clip px-4 pt-3 [clip-path:inset(-24rem_0_0_0)] sm:mt-28 sm:h-56 sm:gap-5"
    >
      {slots.map((kind, i) => {
        const t = heroTemplate(kind);
        const motion =
          shuffling === 'out' || leaving === i
            ? 'hero-fan-out'
            : shuffling === 'in' || entering === i || firstDeal
              ? 'hero-fan-in'
              : '';
        return (
          // The pose sits on the slot, the swap's motion on the card inside it, so the two never fight
          // over one transform; hovering or focusing a card straightens and lifts its slot.
          <div
            key={i}
            className={`shrink-0 transition-transform duration-micro ease-out hover:[transform:translateY(-0.5rem)_rotate(0deg)] has-[:focus-visible]:[transform:translateY(-0.5rem)_rotate(0deg)] motion-reduce:transition-none ${POSE[i]}`}
            style={{ '--hero-flick': FLICK[i] } as CSSProperties}
          >
            <a
              key={kind}
              href={ctaHref(templateCreateHref(kind), 'Home.HeroFan')}
              style={shuffling ? { animationDelay: `${i * SHUFFLE_STAGGER_MS}ms` } : undefined}
              className={`flex h-56 w-[6.5rem] flex-col gap-2 rounded-xl border border-rose-100 bg-white p-2 text-slate-900 shadow-[0_30px_60px_-30px_var(--hero-card-shadow)] outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-400 sm:h-72 sm:w-56 sm:gap-3 sm:rounded-2xl sm:p-4 dark:border-transparent ${motion}`}
            >
              <span className="truncate text-xs font-semibold sm:text-sm">
                <span className="sr-only">{createLabelPrefix(t.title)}</span>
                {t.title}
              </span>
              <span className="flex h-20 items-center justify-center rounded-lg bg-slate-50 sm:h-32 sm:rounded-xl [&>svg]:h-14 [&>svg]:w-auto sm:[&>svg]:h-24">
                <TemplatePreview kind={kind} />
              </span>
            </a>
          </div>
        );
      })}
      {/* A fresh hand on demand (docs/specs/019-marketing/marketing-site.md "Hero"): to the right of the cards. */}
      <button
        type="button"
        onClick={shuffle}
        disabled={shuffling !== null}
        aria-label="Shuffle templates"
        title="Shuffle templates"
        className="flex size-9 shrink-0 cursor-pointer items-center justify-center self-center rounded-full border border-brand-100 bg-white text-slate-500 shadow-sm transition hover:text-brand-700 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 disabled:cursor-default sm:size-10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`size-4 transition-transform duration-300 ${shuffling ? 'rotate-180' : ''}`}
        >
          <path d="m18 14 4 4-4 4" />
          <path d="m18 2 4 4-4 4" />
          <path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22" />
          <path d="M2 6h1.972a4 4 0 0 1 3.6 2.2" />
          <path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45" />
        </svg>
      </button>
    </div>
  );
}
