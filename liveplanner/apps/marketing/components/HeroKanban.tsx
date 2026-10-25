'use client';

import { ctaHref } from '@liveplanner/api-schema';
import { TemplatePreview } from '@liveplanner/template-previews';
import { templateCreateHref, type TemplateKind } from '@liveplanner/templates';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { boardHand, HERO_BOARD_OPENING, heroTemplate } from '@/lib/hero-starts';
import { createLabelPrefix } from '@/lib/create-label';

// The landing hero's kanban wall (docs/specs/019-marketing/marketing-site.md "Hero"): five lanes down the
// band at every width, fading behind the copy, headed from `md`; from `xl` six template cards in them, one
// being dragged from Doing to Review. The lanes are one flex row (a size container), so the drag moves by
// exactly one lane at any width (`--pitch`, in container units) and is a transform only. The static HTML is a
// fixed opening hand, hidden once script runs (<html data-hero-deal>) until this visit's shuffled six replace
// it; after that it holds still. It sits behind the copy.

const LANES = [
  { name: 'Backlog', count: '7' },
  { name: 'To do', count: '4' },
  { name: 'Doing', count: '2/3' },
  { name: 'Review', count: '1' },
  { name: 'Done', count: '12' },
] as const;

// Which lane each of the six cards sits in, how far down and how it leans; the last is the one being dragged.
const SLOTS: readonly { lane: number; top: string; tilt: string }[] = [
  { lane: 0, top: '4.75rem', tilt: '-2deg' },
  { lane: 0, top: '20.625rem', tilt: '2deg' },
  { lane: 4, top: '4.75rem', tilt: '2deg' },
  { lane: 4, top: '20.625rem', tilt: '-2deg' },
  { lane: 1, top: '36.875rem', tilt: '-1deg' },
];
const DRAGGED = { lane: 2, top: '36.5rem' };

const CARD =
  'pointer-events-auto flex w-[12.25rem] flex-col gap-1.5 rounded-[0.875rem] border border-brand-100 bg-white p-1.5 text-slate-900 shadow-[0_22px_40px_-22px_var(--hero-card-shadow)] outline-none transition-[transform,box-shadow] duration-micro ease-out focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 motion-reduce:transition-none dark:border-transparent';

function Card({ kind, tilt }: { kind: TemplateKind; tilt: string }) {
  const t = heroTemplate(kind);
  return (
    <a
      href={ctaHref(templateCreateHref(kind), 'Home.HeroBoard')}
      style={{ '--tilt': tilt } as CSSProperties}
      className={`${CARD} [transform:rotate(var(--tilt))] hover:shadow-[0_30px_50px_-24px_var(--hero-card-shadow)] hover:[transform:translateY(-0.375rem)_rotate(0deg)] focus-visible:[transform:translateY(-0.375rem)_rotate(0deg)]`}
    >
      <span className="flex aspect-[8/5] items-center justify-center rounded-[0.5625rem] bg-slate-50 [&>svg]:h-[80%] [&>svg]:w-auto">
        <TemplatePreview kind={kind} />
      </span>
      <span className="truncate px-1 pb-0.5 text-[0.8125rem] font-semibold">
        <span className="sr-only">{createLabelPrefix(t.title)}</span>
        {t.title}
      </span>
    </a>
  );
}

export function HeroKanban() {
  const [hand, setHand] = useState<TemplateKind[]>(() => [...HERO_BOARD_OPENING]);
  const [dealt, setDealt] = useState(false);
  const dealtHand = useRef<TemplateKind[]>(hand);

  // This visit's six, read in an effect: the static HTML has to be one hand for everyone, so the
  // shuffle cannot happen in render.
  useEffect(() => {
    dealtHand.current = boardHand(Math.random);
    setHand(dealtHand.current);
    setDealt(true);
  }, []);

  const dragged = hand[SLOTS.length];

  return (
    <div
      data-dealt={dealt ? '' : undefined}
      className="hero-kanban pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="hero-kanban-lanes absolute inset-2 flex gap-4">
        {LANES.map((lane, i) => (
          <div
            key={lane.name}
            className={`relative min-w-0 flex-1 rounded-2xl ${i % 2 ? 'bg-brand-100/60 dark:bg-brand-900/30' : 'bg-brand-100/35 dark:bg-brand-900/15'}`}
          >
            <p
              aria-hidden
              className="absolute left-4 top-4 hidden items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-brand-600 md:flex dark:text-brand-400"
            >
              {lane.name}
              <span className="rounded-full bg-brand-500/15 px-1.5 py-px font-medium normal-case tracking-normal text-(--hero-ink)">
                {lane.count}
              </span>
            </p>
          </div>
        ))}
      </div>
      {/* The cards from `xl`, in the same five columns as the lanes, over the lanes' fade. */}
      <div className="hero-kanban-cards absolute inset-2 z-20 hidden gap-4 xl:flex">
        {LANES.map((lane, i) => (
          <div key={lane.name} className="relative min-w-0 flex-1">
            {SLOTS.map((slot, n) => {
              const kind = hand[n];
              if (slot.lane !== i || !kind) return null;
              return (
                <div
                  key={kind}
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{ top: slot.top }}
                >
                  <Card kind={kind} tilt={slot.tilt} />
                </div>
              );
            })}
            {i === DRAGGED.lane + 1 ? (
              <div
                aria-hidden
                className="absolute left-1/2 h-40 w-[12.25rem] -translate-x-1/2 rounded-[0.875rem] border-2 border-dashed border-brand-300 dark:border-brand-700"
                style={{ top: DRAGGED.top }}
              />
            ) : null}
            {i === DRAGGED.lane && dragged ? (
              <div
                className="hero-kanban-drag absolute left-1/2 z-10 -ml-[6.125rem]"
                style={{ top: DRAGGED.top }}
              >
                <Card kind={dragged} tilt="0deg" />
                <svg
                  aria-hidden
                  viewBox="0 0 90 46"
                  className="hero-kanban-cursor absolute left-[9rem] top-14 w-[5.625rem] overflow-visible"
                >
                  <path
                    d="M0 0L0 20L5.4 14.8L9.4 23.6L12.4 22.2L8.6 13.6L15.8 13.4Z"
                    fill="#db2777"
                    stroke="#fff"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <rect x="14" y="22" width="56" height="22" rx="7" fill="#db2777" />
                  <text
                    x="42"
                    y="37.5"
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="600"
                    fill="#fff"
                  >
                    Priya
                  </text>
                </svg>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
