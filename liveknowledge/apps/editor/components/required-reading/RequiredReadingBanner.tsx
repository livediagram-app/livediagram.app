'use client';

// The Required Reading banner (docs/specs/030-knowledgebase/required-reading.md "Where it shows"): above the meta row,
// for a signed-in person the api says is asked and has not confirmed, while they read the page (never while they edit
// it). A calm brand tint, never amber or red: it asks, it does not warn. I've Read This shows at once: the banner goes.
import { useId } from 'react';
import { Button } from '@liveknowledge/ui';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { useRelativeNow } from '@/lib/relative-time';
import { bannerLine } from '@/lib/required-reading/reading-words';
import { ReadingBookIcon, ReadTickIcon } from './reading-icons';
import { useRequiredReading } from './useRequiredReading';

/** The banner itself, for its tests. */
export function RequiredReadingBannerView({
  round,
  askedAt,
  now,
  busy,
  onConfirm,
}: {
  round: number;
  askedAt: number;
  now: number;
  busy: boolean;
  onConfirm: () => void;
}) {
  const titleId = useId();
  return (
    <section
      data-required-reading-banner=""
      aria-labelledby={titleId}
      className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-brand-200 bg-brand-50/80 px-3.5 py-2.5 font-sans text-[13px] leading-5 text-slate-700 motion-safe:transition-opacity motion-safe:duration-200 motion-safe:starting:opacity-0 dark:border-brand-400/30 dark:bg-brand-500/10 dark:text-slate-200"
    >
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-brand-700 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-400/30"
      >
        <ReadingBookIcon />
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <h2 id={titleId} className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
          Required Reading
        </h2>
        <p className="text-slate-600 dark:text-slate-300">{bannerLine(round, askedAt, now)}</p>
      </div>
      <Button
        size="xs"
        busy={busy}
        onClick={onConfirm}
        data-required-reading-confirm=""
        className="shrink-0 phone:min-h-11 phone:w-full"
      >
        <ReadTickIcon />
        I&apos;ve Read This
      </Button>
    </section>
  );
}

export function RequiredReadingBanner() {
  const editing = useEditorChrome((s) => s.pageEditing.editing);
  const reading = useRequiredReading();
  const now = useRelativeNow();
  const { required, mine } = reading.entry.reading;
  if (!reading.shown || editing || !required || !mine.asked || mine.readAt !== undefined)
    return null;
  return (
    <RequiredReadingBannerView
      round={required.round}
      askedAt={required.askedAt}
      now={now}
      busy={reading.busy === 'confirm'}
      onConfirm={reading.confirm}
    />
  );
}
