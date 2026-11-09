'use client';

// A page's label above its top-left corner (docs/specs/007-editor/pages-mode.md "Each page's label", "Beside the
// cog"): its name, then its size and kind, on the same card as the title bar above its top-right corner
// (TITLE_BAR_CARD_CLASS), so it reads over whatever is behind it: the canvas, another page, or a stack's pages fanned
// out behind the page in front. One press target inside the card, as tall as the bar's buttons, so the two sit on one
// line; a long name truncates and the hover card says it whole. Held at one screen size and placed by the caller.
import type { ButtonHTMLAttributes } from 'react';
import { HoverCard } from '@liveworkspace/ui';
import { TITLE_BAR_CARD_CLASS } from './PageTitleBar';

export type PageLabelCardProps = {
  // The whole label, as pageLabel joins it: the hover card's title.
  label: string;
  // The page's name (empty when it has none), set first in strong ink.
  name: string;
  // The rest (its size and kind), muted after the name.
  rest: string;
  // A press drags it to reorder the pages: the grab cursor.
  grab?: boolean;
  // A press fits the page to the screen.
  onClick: () => void;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'className' | 'children' | 'onClick'>;

export function PageLabelCard({
  label,
  name,
  rest,
  grab = false,
  onClick,
  ...button
}: PageLabelCardProps) {
  return (
    // The card takes no presses of its own (its rim is the canvas's, as the space round the bare label was); the
    // button inside does.
    <div
      data-page-label=""
      className={`pointer-events-none flex min-w-0 max-w-full ${TITLE_BAR_CARD_CLASS}`}
    >
      <HoverCard
        title={label}
        description="Press to fit this page to the screen."
        className="min-w-0 max-w-full"
      >
        <button
          type="button"
          // The Pages tour's anchor (docs/specs/007-editor/pages-tour.md); the first page's leads.
          data-tour-id="page-name"
          {...button}
          onClick={onClick}
          onDoubleClick={(e) => e.stopPropagation()}
          className={`group/label pointer-events-auto block h-7 max-w-full truncate whitespace-nowrap rounded-md px-2 text-xs leading-7 text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 ${
            grab ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
        >
          {/* Its name leads, the size and kind after it quieter, so a row of pages scans by name. */}
          {name ? (
            <span className="font-semibold text-slate-800 group-hover/label:text-slate-950 dark:text-slate-100 dark:group-hover/label:text-white">
              {name}
            </span>
          ) : null}
          {name && rest ? ' · ' : null}
          {rest ? (
            <span className="font-medium group-hover/label:text-slate-700 dark:group-hover/label:text-slate-200">
              {rest}
            </span>
          ) : null}
        </button>
      </HoverCard>
    </div>
  );
}
