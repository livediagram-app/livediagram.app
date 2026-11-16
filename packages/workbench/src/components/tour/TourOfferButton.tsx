'use client';

import { useEffect, useRef, useState } from 'react';
import { lucidePlay } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveworkspace/ui';
import { useTourOffer, useTourOffers, type TourOffer } from './tour-offer';
import { GetStartedPopover } from './GetStartedPopover';

const TourGlyph = lucideGlyph(lucidePlay, 18);

const PlayGlyph = lucideGlyph(lucidePlay, 10);
// The play triangle inks 0.4px right of its viewBox centre at 10px: moved back by a transform, which lands on the
// device-pixel grid, where padding moves the glyph by whole CSS px (the browser snaps an svg's layout box), so a
// 1px pad left it up to 1.4px off (optical-alignment.md; the guard is in TourOfferButton.test.tsx).
export const PLAY_GLYPH_SHIFT_PX = -0.4;

// Offers already counted as shown in this page load, so each host's telemetry says so once.
const counted = new Set<string>();

/** The button's words for a tour's name: "Draw" → "Start Draw Tour". */
export const startTourLabel = (name: string) => `Start ${name} Tour`;

// The footer's Start Tour button (docs/specs/007-editor/editor-tour.md "Where it appears"): the one way into a
// tour. It leads the editor's bottom-bar cluster, left of Tools and Search, and offers the most relevant tour on offer
// (tour-offer.ts), "Start Draw Tour", "Start Sankey Tour", until the person has taken it: a tour started, finished or
// skipped leaves the button, and its Settings › Getting Started switch brings it back. With no tour on offer it is not drawn. A contained chip, as tall as its neighbours, the play
// glyph in a small accent disc and the words beside it; icon only on a phone, and wherever its neighbours drop their
// words (`labelled`), keeping its name for assistive technology.
export function TourOfferButton({ labelled = true }: { labelled?: boolean }) {
  const offer = useTourOffer();
  const id = offer?.id ?? null;
  useEffect(() => {
    if (!id || counted.has(id)) return;
    counted.add(id);
    offer?.onShown?.();
    // oxlint-disable-next-line react/exhaustive-deps -- once per offer: a new name on the same host (another element kind) is a fresh id from its host
  }, [id]);
  const offers = useTourOffers();
  const ref = useRef<HTMLButtonElement>(null);
  const [listOpen, setListOpen] = useState(false);
  // Each tour's length, asked for as Get Started opens (some load their steps to count them).
  const [lengths, setLengths] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!listOpen) return;
    let live = true;
    for (const o of offers) {
      void Promise.resolve(o.length?.()).then((len) => {
        if (live && len) setLengths((had) => (had[o.id] === len ? had : { ...had, [o.id]: len }));
      });
    }
    return () => {
      live = false;
    };
  }, [listOpen, offers]);
  if (!offer) return null;
  // A press: the host's own lessons when it is the only tour on offer and has them (it toggles them itself), else the
  // Get Started popover of every tour on offer, a pick starting it (toggled by a second press, as Tools is).
  const own = offers.length === 1 && offers[0]!.ownPanel === true;
  const press = () => {
    if (own) offer.start();
    else setListOpen((o) => !o);
  };
  // The button reads Get Started in every app, with no hover card; which tour it starts is in its accessible name.
  const label = offer.label ?? startTourLabel(offer.name);
  return (
    <>
    <button
      type="button"
      ref={ref}
      onClick={press}
      aria-expanded={own ? undefined : listOpen}
      aria-label={`Get Started, ${label}`}
      data-tour-offer={offer.id}
      className={`relative touch-target ml-0.5 flex h-7 min-w-7 shrink-0 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-1.5 text-slate-600 transition duration-micro hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:ml-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-white ${labelled ? 'sm:pl-1 sm:pr-2.5' : ''}`}
    >
      <span
        aria-hidden
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-brand-700 text-white dark:bg-brand-600"
      >
        <PlayGlyph style={{ translate: `${PLAY_GLYPH_SHIFT_PX}px 0` }} />
      </span>
      {labelled ? (
        <span className="hidden whitespace-nowrap text-xs font-medium sm:inline">Get Started</span>
      ) : null}
    </button>
    {listOpen && !own && ref.current ? (
      <GetStartedPopover
        anchor={ref.current}
        topics={offers.map((o) => topicOf(o, lengths[o.id]))}
        onPick={(id) => {
          setListOpen(false);
          offers.find((o) => o.id === id)?.start();
        }}
        onClose={() => setListOpen(false)}
      />
    ) : null}
    </>
  );
}

// A tour on offer as a Get Started row: its words, what it shows, its glyph.
function topicOf(o: TourOffer, length: string | undefined) {
  return {
    id: o.id,
    title: o.label ?? `${o.name} Tour`,
    line: o.description ?? 'A short guided tour, step by step.',
    icon: o.icon ?? <TourGlyph />,
    ...(length ? { meta: length } : {}),
    taken: false,
  };
}

/** Forgets which offers were counted, for tests. */
export function resetTourOfferButtonForTests(): void {
  counted.clear();
}
