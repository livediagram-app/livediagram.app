import { SOLID_BRAND_DARK } from '@livediagram/ui';

// The small count pill: how many things are inside or waiting. The
// Explorer page's rows, cards and sidebar and the floating panel's tree
// show the neutral one beside a folder's name; the Collaborate button and
// panel show the brand one for their open count (docs/specs/012-collaboration/assigned-actions.md §5), the
// "something here wants you" tone. `className` is for the caller's spacing
// and placement only.
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
      ? `bg-brand-500 font-semibold text-white ${SOLID_BRAND_DARK}`
      : 'bg-slate-200 font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300';
  return (
    <span
      className={`inline-flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-full px-1 text-[10px] ${colours}${
        className ? ` ${className}` : ''
      }`}
    >
      <span className="text-optical-centre">{count}</span>
    </span>
  );
}
