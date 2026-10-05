// A placeholder card the exact shape of PostCard (blueprint §9, §11): the grid reserves its space
// while posts load, so nothing shifts when they arrive.
export function PostCardSkeleton() {
  return (
    <div
      aria-hidden
      className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="dot-grid aspect-[4/3] border-b border-slate-100 dark:border-slate-800" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="skeleton-bar h-4 w-3/4 rounded" />
        <div className="skeleton-bar h-3 w-1/3 rounded" />
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="skeleton-bar h-5 w-24 rounded-full" />
          <div className="skeleton-bar h-5 w-14 rounded" />
        </div>
      </div>
    </div>
  );
}
