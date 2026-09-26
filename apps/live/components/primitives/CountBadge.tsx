// The small grey count pill beside a folder's name: how many things are
// inside. The Explorer page's rows, cards and sidebar and the floating
// panel's tree all show one, and had each typed out the same class
// string (with the panel's copy drifting to a different dark-mode text
// colour). `className` is for the caller's spacing only.
export function CountBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={`inline-flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300${
        className ? ` ${className}` : ''
      }`}
    >
      {count}
    </span>
  );
}
