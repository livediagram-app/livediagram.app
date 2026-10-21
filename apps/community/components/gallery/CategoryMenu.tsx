'use client';

import {
  COMMUNITY_CATEGORIES,
  communityCategoryLabel,
  type CommunityCategory,
  type CommunityFacetsResponse,
} from '@livediagram/api-schema';
import { CategoryIcon } from '../shared/icons';
import { SearchControlMenu } from './SearchControlMenu';

// The category control inside the search box (docs/specs/025-community/community.md "Gallery"): All,
// then each category with its count of documents. Choosing one is written into the search as
// `category:<id>` by the search box; All takes it out. Once the counts are known an empty category is
// left out (unless it is the one chosen), so every row leads somewhere.
export function CategoryMenu({
  value,
  facets,
  onChange,
}: {
  value: CommunityCategory | null;
  facets: CommunityFacetsResponse | null;
  onChange: (next: CommunityCategory | null) => void;
}) {
  const label = value ? communityCategoryLabel(value) : 'Category';
  const rows = [
    {
      id: null,
      key: 'all',
      label: 'All Categories',
      count: facets?.total,
      checked: value === null,
    },
    ...COMMUNITY_CATEGORIES.filter(
      (c) => !facets || (facets.categories[c.id] ?? 0) > 0 || c.id === value,
    ).map((c) => ({
      id: c.id,
      key: c.id,
      label: c.label,
      count: facets?.categories[c.id] ?? undefined,
      checked: c.id === value,
    })),
  ];
  return (
    <SearchControlMenu<CommunityCategory | null>
      trigger={{
        ariaLabel: value ? `Category: ${label}` : 'Filter by category',
        icon: <CategoryIcon />,
        label,
        active: value !== null,
      }}
      menuLabel="Category"
      groups={[{ rows }]}
      role="menuitemradio"
      width="w-64"
      scroll
      closeOnPick
      onPick={(next) => {
        if (next !== value) onChange(next);
      }}
    />
  );
}
