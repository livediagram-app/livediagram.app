// The site's empty state at the size of a panel, a list or a popover (docs/specs/004-interface-design/empty-states.md):
// the brand badge with the surface's glyph, a "No <things>" heading, an optional line and at most one way forward.
// The page-sized one is EmptyState; NoMatches is this, written for a search or a filter that found nothing.
import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';
import { SearchIcon } from './icons/navigation';

type EmptyStateSize = 'regular' | 'small';

// The heading's and the line's colours on a surface painted in its own theme (a start panel), in place of
// the app's slate. The badge keeps the brand.
type EmptyStateInk = { text: string; muted: string };

// How much of the person's words a no-match heading quotes before it cuts them with an ellipsis, so a pasted
// paragraph never fills a popover. 40 fits two lines of the small heading in the narrowest popover (16rem).
const NO_MATCH_QUERY_MAX = 40;

const SIZES: Record<
  EmptyStateSize,
  { box: string; badge: string; title: string; line: string; action: string }
> = {
  regular: {
    box: 'gap-2 p-4',
    badge: 'h-10 w-10 rounded-xl shadow-md [&_svg]:h-[18px] [&_svg]:w-[18px]',
    title: 'text-[13px]',
    line: 'max-w-[18rem] text-[12px]',
    action: 'mt-1',
  },
  small: {
    box: 'gap-1.5 px-3 py-3',
    badge: 'h-7 w-7 rounded-lg shadow-sm [&_svg]:h-3.5 [&_svg]:w-3.5',
    title: 'text-[12px]',
    line: 'max-w-[16rem] text-[11px]',
    action: 'mt-0.5',
  },
};

export function CompactEmptyState({
  icon,
  title,
  description,
  className = '',
  action,
  size = 'regular',
  role,
  ink,
}: {
  icon: ReactNode;
  title: string;
  // The line under the title; left out where the title and action say enough (a gallery with nothing yet).
  description?: string;
  className?: string;
  // A button under the line, for the empty state's one way forward.
  action?: ReactNode;
  size?: EmptyStateSize;
  // 'status' where the list empties as the person types, so a screen reader hears it (LiveStatus).
  role?: 'status';
  ink?: EmptyStateInk;
}) {
  const s = SIZES[size];
  // Announced through a live region that is in the page before its words (LiveStatus), so a screen reader hears an
  // empty state that appears as the person types; the words on show are then hidden from it, so it reads them once.
  const live = role === 'status';
  return (
    <div
      data-empty-state={size}
      className={`flex flex-col items-center justify-center overflow-hidden text-center ${s.box} ${className}`}
    >
      {live ? <LiveStatus message={description ? `${title}. ${description}` : title} /> : null}
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-brand-500/25 ${s.badge}`}
      >
        {icon}
      </span>
      <span
        aria-hidden={live || undefined}
        className={`max-w-full font-semibold text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100 ${s.title}`}
        style={ink ? { color: ink.text } : undefined}
      >
        {title}
      </span>
      {description ? (
        <span
          aria-hidden={live || undefined}
          className={`leading-snug text-slate-500 dark:text-slate-400 ${s.line}`}
          style={ink ? { color: ink.muted } : undefined}
        >
          {description}
        </span>
      ) : null}
      {action ? <span className={`flex ${s.action}`}>{action}</span> : null}
    </div>
  );
}

// A polite live region that mounts empty and takes its words a moment later: a region that arrives already holding
// its text is often not announced, as nothing in it changed. Visually hidden; the empty state shows the words.
function LiveStatus({ message }: { message: string }) {
  const region = useRef<HTMLSpanElement>(null);
  // Written after mount (and on each change), never rendered with the region, so the region is there first.
  useEffect(() => {
    if (region.current) region.current.textContent = message;
  }, [message]);
  return <span ref={region} role="status" className="sr-only" />;
}

// The person's words as a no-match heading quotes them: trimmed, and cut to NO_MATCH_QUERY_MAX with an ellipsis.
function quotedQuery(query: string): string {
  const q = query.trim().replace(/\s+/g, ' ');
  return `“${q.length > NO_MATCH_QUERY_MAX ? `${q.slice(0, NO_MATCH_QUERY_MAX - 1).trimEnd()}…` : q}”`;
}

// The heading of a search or filter that found nothing: "No cards match “launch”", or "No cards match these
// filters" when only filters narrowed it. `things` is the plural noun, lowercase.
export function noMatchTitle(things: string, query = '', filters = 0): string {
  if (query.trim()) return `No ${things} match ${quotedQuery(query)}`;
  if (filters > 0) return `No ${things} match these filters`;
  return `No ${things} match`;
}

// The line under a no-match heading when the surface has no advice of its own.
export function noMatchHint(query = '', filters = 0): string {
  if (query.trim())
    return filters > 0 ? 'Try another word or remove a filter.' : 'Try another word.';
  return 'Remove a filter to see more.';
}

// A search's or a filter's empty state: "No <things> match …", a line, and Clear Search / Clear Filters when the
// surface can clear (docs/specs/004-interface-design/empty-states.md).
export function NoMatches({
  things,
  query = '',
  filters = 0,
  hint,
  onClear,
  clearsBoth = false,
  icon,
  size = 'small',
  className,
  ink,
}: {
  things: string;
  query?: string;
  filters?: number;
  // The line under the heading; the default says to try another word or remove a filter. `null` leaves it out.
  hint?: string | null;
  onClear?: () => void;
  // The clear takes the words and the filters together (not the words alone), so its label names both when both
  // narrowed the list.
  clearsBoth?: boolean;
  icon?: ReactNode;
  size?: EmptyStateSize;
  className?: string;
  ink?: EmptyStateInk;
}) {
  const hasWords = !!query.trim();
  return (
    <CompactEmptyState
      role="status"
      size={size}
      ink={ink}
      className={className}
      icon={icon ?? <SearchIcon />}
      title={noMatchTitle(things, query, filters)}
      description={hint === null ? undefined : (hint ?? noMatchHint(query, filters))}
      action={
        onClear ? (
          <Button type="button" variant="secondary" size="xs" onClick={onClear}>
            {clearLabel(hasWords, filters, clearsBoth)}
          </Button>
        ) : undefined
      }
    />
  );
}

// What a no-match empty state's clear says it takes: the search, the filters, or both when it takes both and both are
// in force.
function clearLabel(hasWords: boolean, filters: number, clearsBoth: boolean): string {
  if (hasWords && filters > 0 && clearsBoth) return 'Clear Search and Filters';
  return hasWords || filters === 0 ? 'Clear Search' : 'Clear Filters';
}
