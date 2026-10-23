// The small count pill beside a folder's or a section's name (liveplanner's CountBadge).
export function CountBadge({
  count,
  className,
  tone = 'neutral',
}: {
  count: number;
  className?: string;
  tone?: 'neutral' | 'brand';
}) {
  const colours =
    tone === 'brand'
      ? 'bg-brand-700 font-semibold text-white dark:bg-brand-600'
      : 'bg-slate-200 font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300';
  return (
    <span
      className={`inline-flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-full px-1 text-[10px] ${colours}${
        className ? ` ${className}` : ''
      }`}
    >
      {count}
    </span>
  );
}
