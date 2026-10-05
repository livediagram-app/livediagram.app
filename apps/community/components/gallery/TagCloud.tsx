import type { CommunityFacetsResponse } from '@livediagram/api-schema';
import { CloseIcon } from '@livediagram/ui';
import { FilterChip } from './FilterChip';

// Popular tags (docs/specs/025-community/community.md "Gallery"): the most used tags as chips;
// choosing one filters to it. The chosen tag shows first as a removable chip, also when it is not
// among the popular ones (a link from a post page). On phones the chips scroll in one row, like the
// categories, so the boards stay near the top.
export function TagCloud({
  value,
  facets,
  onChange,
}: {
  value: string | null;
  facets: CommunityFacetsResponse | null;
  onChange: (next: string | null) => void;
}) {
  const popular = (facets?.tags ?? []).filter((t) => t.tag !== value);
  if (!value && popular.length === 0) return null;
  return (
    <div
      role="group"
      aria-label="Popular Tags"
      className="scrollbar-slim -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
    >
      <span className="mr-1 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Popular Tags
      </span>
      {value ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={`Remove tag ${value}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-500 py-1 pl-3 pr-2 text-xs font-semibold text-white shadow-sm shadow-brand-500/25 transition-colors duration-micro hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          #{value}
          <CloseIcon size={12} aria-hidden />
        </button>
      ) : null}
      {popular.map(({ tag, count }) => (
        <FilterChip key={tag} pressed={false} onClick={() => onChange(tag)} count={count}>
          <span className="text-xs">#{tag}</span>
        </FilterChip>
      ))}
    </div>
  );
}
