// Home's loading state (docs/specs/013-workspace/explorer-home.md "States"): each skeleton has the
// box of what replaces it, so the page lands without a shift. Decorative and hidden from assistive
// technology; the busy section says it is loading.

import { ENTRY_GRID, ENTRY_HEIGHT, ENTRY_THUMB, MARKER_OFFSET, SKELETON } from './home-styles';

const STRIP_ITEMS = 6;
const ENTRY_ROWS = 3;
const TIMELINE_ITEMS = 4;

export function StripSkeleton() {
  return (
    <div aria-hidden className="-mx-1 flex h-28 gap-3 overflow-hidden px-1 pb-2 pt-1">
      {Array.from({ length: STRIP_ITEMS }, (_, i) => (
        <div key={i} className="w-32 shrink-0">
          <div className={`h-20 w-32 ${SKELETON}`} />
          <div className={`mt-2 h-3 w-24 ${SKELETON}`} />
        </div>
      ))}
    </div>
  );
}

export function WhatHappenedSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-1">
      <div className={`mb-1 h-3 w-16 ${SKELETON}`} />
      {Array.from({ length: ENTRY_ROWS }, (_, i) => (
        <div key={i} className="flex h-14 items-center gap-3 px-2">
          <div className={`h-7 w-7 shrink-0 rounded-full ${SKELETON}`} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className={`h-3 w-3/4 ${SKELETON}`} />
            <div className={`h-2.5 w-1/3 ${SKELETON}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** One entry's placeholder; `visible` false keeps its box empty (the idle paging slot). */
export function TimelineEntrySkeleton({
  side,
  visible = true,
}: {
  side: 'start' | 'end';
  visible?: boolean;
}) {
  if (!visible) return <div aria-hidden className={ENTRY_HEIGHT} />;
  const thumb = (
    <div className={side === 'start' ? 'justify-self-end' : 'justify-self-start'}>
      <div className={`${ENTRY_THUMB} ${SKELETON}`} />
      <div className={`mt-1 h-3 w-20 ${SKELETON} ${side === 'start' ? 'ml-auto' : ''}`} />
    </div>
  );
  return (
    <div aria-hidden className={`${ENTRY_GRID} ${ENTRY_HEIGHT}`}>
      {side === 'start' ? thumb : <span />}
      <span
        className={`${MARKER_OFFSET} h-5 w-5 justify-self-center rounded-full bg-slate-200 dark:bg-slate-800`}
      />
      {side === 'start' ? <span /> : thumb}
    </div>
  );
}

export function TimelineSkeleton() {
  return (
    <div aria-hidden className="relative flex flex-col gap-4">
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-200 dark:bg-slate-700" />
      <div className="flex justify-center">
        <div className={`h-5 w-14 rounded-full ${SKELETON}`} />
      </div>
      {Array.from({ length: TIMELINE_ITEMS }, (_, i) => (
        <TimelineEntrySkeleton key={i} side={i % 2 === 0 ? 'start' : 'end'} />
      ))}
    </div>
  );
}
