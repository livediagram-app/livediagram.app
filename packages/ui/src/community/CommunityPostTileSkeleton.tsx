import { COMMUNITY_DOT_GRID, COMMUNITY_SKELETON_BAR } from './surfaces';

// A placeholder the exact shape of CommunityPostTile (docs/specs/025-community/community.md "Gallery"): a grid
// reserves its space while posts load, so nothing shifts when they arrive. Shared by the Community app and the
// landing page. Still under reduced motion.
const BAR = COMMUNITY_SKELETON_BAR;

export function CommunityPostTileSkeleton() {
  return (
    <div
      aria-hidden
      className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div
        className={`aspect-[4/3] border-b border-slate-100 dark:border-slate-800 ${COMMUNITY_DOT_GRID}`}
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className={`h-4 w-3/4 ${BAR}`} />
        <div className={`h-3 w-1/3 ${BAR}`} />
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className={`h-7 w-28 ${BAR}`} />
          <div className={`h-5 w-14 ${BAR}`} />
        </div>
      </div>
    </div>
  );
}
