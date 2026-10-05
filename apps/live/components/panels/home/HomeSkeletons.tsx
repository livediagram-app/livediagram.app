// Home's loading state (docs/specs/013-workspace/explorer-home.md "States"): each skeleton has the
// box of what replaces it, so the page lands without a shift. Decorative and hidden from assistive
// technology; the busy section says it is loading.

import { GRID, GRID_THUMB, SKELETON, STRIP_HEIGHT, STRIP_THUMB, STRIP_TILE } from './home-styles';

const GRID_ITEMS = 8;
const STRIP_ITEMS = 4;
const ENTRY_ROWS = 3;

function TileSkeleton({ thumb }: { thumb: string }) {
  return (
    <>
      <div className={`${thumb} ${SKELETON}`} />
      <div className="mt-1 h-4 py-0.5">
        <div className={`h-3 w-3/4 ${SKELETON}`} />
      </div>
    </>
  );
}

/** Jump back in's grid: two rows of four tiles. */
export function GridSkeleton() {
  return (
    <div aria-hidden className={GRID}>
      {Array.from({ length: GRID_ITEMS }, (_, i) => (
        <div key={i} className="min-w-0">
          <TileSkeleton thumb={GRID_THUMB} />
        </div>
      ))}
    </div>
  );
}

/** Jump back in's phone strip. */
export function StripSkeleton() {
  return (
    <div aria-hidden className={`-mx-1 flex ${STRIP_HEIGHT} gap-3 overflow-hidden px-1 pb-2 pt-1`}>
      {Array.from({ length: STRIP_ITEMS }, (_, i) => (
        <div key={i} className={STRIP_TILE}>
          <TileSkeleton thumb={STRIP_THUMB} />
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
