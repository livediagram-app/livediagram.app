'use client';

// Show Me in the Share dialog: a short tour of issuing and managing passes, run on the dialog itself. Never offered;
// only the button runs it. Each step rings its control (a `data-tour-id` in the dialog) and says what it does in a
// card beside it; the control stays usable, so the person can pick a level or make a pass with the step up.
// Escape or Skip ends it; the steps are fixed when it starts, so a tab added meanwhile can't shift them.

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Button } from '@liveworkspace/ui';
import type { ShareTelemetry } from './types';

export type TourStep = { id: string; title: string; body: string; target?: string };

export function shareTourSteps(multiTab: boolean, word: string): TourStep[] {
  return [
    {
      id: 'role',
      title: 'Choose What They Can Do',
      body: 'Editors change anything, Participants comment, vote and work items, Viewers only look.',
      target: 'share-role',
    },
    ...(multiTab
      ? [
          {
            id: 'scope',
            title: 'Choose Which Tabs It Opens',
            body: 'Share every tab, or just one.',
            target: 'share-scope',
          },
        ]
      : []),
    {
      id: 'valid',
      title: 'Set How Long It Lasts',
      body: 'The link stops working after this. You can extend it later.',
      target: 'share-valid',
    },
    {
      id: 'create',
      title: 'Create the Pass',
      body: 'The link is copied as soon as it is made, ready to paste.',
      target: 'share-create',
    },
    {
      id: 'passes',
      title: 'Your Passes',
      body: 'Your links. Copy, embed, change or revoke any of them.',
      target: 'share-passes',
    },
    {
      id: 'password',
      title: 'Add a Password',
      body: 'Anyone opening a link must enter it first. Note it down: it can’t be shown again.',
      target: 'share-password',
    },
    {
      id: 'outro',
      title: 'That Is Sharing',
      body: `Open Share any time to make, change or revoke a link to this ${word}.`,
    },
  ];
}

export type ShareTour = {
  active: boolean;
  step: TourStep | null;
  index: number;
  count: number;
  start: () => void;
  next: () => void;
  back: () => void;
  end: (completed: boolean) => void;
};

export function useShareTour(
  multiTab: boolean,
  word: string,
  onTelemetry?: ShareTelemetry,
): ShareTour {
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const end = useCallback(
    (completed: boolean) => {
      setSteps(null);
      setIndex(0);
      onTelemetry?.('Ended', completed ? 'ShareTourCompleted' : 'ShareTourSkipped');
    },
    [onTelemetry],
  );
  const count = steps?.length ?? 0;
  return {
    active: steps !== null,
    step: steps?.[index] ?? null,
    index,
    count,
    start: () => {
      onTelemetry?.('Started', 'ShareTour');
      setSteps(shareTourSteps(multiTab, word));
      setIndex(0);
    },
    next: () => (index + 1 >= count ? end(true) : setIndex(index + 1)),
    back: () => setIndex(Math.max(0, index - 1)),
    end,
  };
}

export function ShowMeButton({ tour }: { tour: ShareTour }) {
  return (
    <button
      type="button"
      onClick={tour.start}
      disabled={tour.active}
      className="inline-flex h-7 items-center rounded-md border border-slate-200 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      Show Me
    </button>
  );
}

type Box = { left: number; top: number; width: number; height: number };

/** The ring round the step's control and the card that explains it, over the dialog. */
export function ShareTourStage({ tour, helpHref }: { tour: ShareTour; helpHref?: string }) {
  const [box, setBox] = useState<Box | null>(null);
  const target = tour.step?.target;
  useLayoutEffect(() => {
    if (!target) {
      setBox(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-tour-id="${target}"]`);
    if (!el) {
      setBox(null);
      return;
    }
    el.scrollIntoView?.({ block: 'nearest' });
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ left: r.left, top: r.top, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [target]);
  useEffect(() => {
    if (!tour.active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      tour.end(false);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [tour]);
  if (!tour.step) return null;
  const last = tour.index + 1 >= tour.count;
  // The card sits under the control, or above it near the bottom of the screen; centred with no control.
  const viewH = typeof window === 'undefined' ? 800 : window.innerHeight;
  const cardStyle = box
    ? box.top + box.height + 180 < viewH
      ? { left: Math.max(12, box.left), top: box.top + box.height + 10 }
      : { left: Math.max(12, box.left), top: Math.max(12, box.top - 170) }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  return (
    <>
      {box ? (
        <div
          aria-hidden
          data-share-tour-ring=""
          className="pointer-events-none fixed z-[60] rounded-xl ring-2 ring-brand-500 ring-offset-2 transition-all duration-200 dark:ring-brand-400 dark:ring-offset-slate-900"
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
        />
      ) : null}
      <div
        role="dialog"
        aria-label={tour.step.title}
        data-share-tour-step={tour.step.id}
        className="fixed z-[61] w-72 max-w-[calc(100vw-24px)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-800"
        style={cardStyle}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {tour.index + 1} of {tour.count}
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {tour.step.title}
        </p>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{tour.step.body}</p>
        {last && helpHref ? (
          <a
            href={helpHref}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
          >
            Read about sharing
          </a>
        ) : null}
        <div className="mt-3 flex items-center gap-2">
          {last ? null : (
            <button
              type="button"
              onClick={() => tour.end(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Skip
            </button>
          )}
          <span className="flex-1" />
          {tour.index > 0 ? (
            <Button variant="secondary" size="xs" onClick={tour.back}>
              Back
            </Button>
          ) : null}
          <Button size="xs" onClick={tour.next}>
            {last ? 'Done' : 'Next'}
          </Button>
        </div>
      </div>
    </>
  );
}
