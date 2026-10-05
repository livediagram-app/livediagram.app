import {
  COMMUNITY_CATEGORIES,
  type CommunityCategory,
  type CommunityFacetsResponse,
} from '@livediagram/api-schema';
import { FilterChip } from './FilterChip';

// The category row (docs/specs/025-community/community.md "Gallery"): All, then each category with
// its post count. Once the counts are known an empty category is left out (unless it is the one
// chosen), so every chip leads somewhere. Scrolls sideways on a phone rather than wrapping.
export function CategoryChips({
  value,
  facets,
  onChange,
}: {
  value: CommunityCategory | null;
  facets: CommunityFacetsResponse | null;
  onChange: (next: CommunityCategory | null) => void;
}) {
  const visible = COMMUNITY_CATEGORIES.filter(
    (c) => !facets || (facets.categories[c.id] ?? 0) > 0 || c.id === value,
  );
  return (
    <div
      role="group"
      aria-label="Categories"
      className="scrollbar-slim -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
    >
      <FilterChip pressed={value === null} onClick={() => onChange(null)} count={facets?.total}>
        All
      </FilterChip>
      {visible.map((c) => (
        <FilterChip
          key={c.id}
          pressed={value === c.id}
          onClick={() => onChange(c.id)}
          count={facets ? (facets.categories[c.id] ?? 0) : undefined}
        >
          {c.label}
        </FilterChip>
      ))}
    </div>
  );
}
