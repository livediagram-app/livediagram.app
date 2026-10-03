'use client';

// The page navigator (docs/specs/007-editor/illustrate-pages.md "Getting around the pages"): a small
// bar under each page, while there are two pages or more: previous, the page's place ("2 of 5"),
// next. An arrow fits the neighbouring page in the view, as a press on its label does. Held at one
// screen size; for everyone who can see the pages.
import { lucideChevronLeft, lucideChevronRight } from '@livediagram/icons/lucide';
import { lucideGlyph, Tooltip } from '@livediagram/ui';
import { TOOLBAR_CARD } from '@/components/chrome/toolbar-surface';

const Prev = lucideGlyph(lucideChevronLeft, 16);
const Next = lucideGlyph(lucideChevronRight, 16);

export function PageNavigator({
  index,
  count,
  zoom,
  onGo,
}: {
  index: number;
  count: number;
  zoom: number;
  // Fits the page at this index (0 first) in the view.
  onGo: (index: number) => void;
}) {
  const arrow = (label: string, to: number, children: React.ReactNode) => {
    const off = to < 0 || to >= count;
    return (
      <Tooltip label={label}>
        <button
          type="button"
          aria-label={label}
          disabled={off}
          onClick={() => onGo(to)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          {children}
        </button>
      </Tooltip>
    );
  };
  return (
    <div
      role="group"
      aria-label={`Page ${index + 1} of ${count}`}
      data-page-navigator=""
      className="absolute left-1/2 top-full"
      style={{
        marginTop: 12 / zoom,
        transform: `translateX(-50%) scale(${1 / zoom})`,
        transformOrigin: 'top center',
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className={`pointer-events-auto ${TOOLBAR_CARD} !p-0.5`}>
        {arrow('Previous page', index - 1, <Prev />)}
        <span className="min-w-[4.5rem] px-1 text-center text-xs tabular-nums text-slate-600 dark:text-slate-300">
          {index + 1} of {count}
        </span>
        {arrow('Next page', index + 1, <Next />)}
      </div>
    </div>
  );
}
