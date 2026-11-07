'use client';

import {
  allCommunityCategories,
  communityCategories,
  communityCategoryLabel,
  type CommunityCategory,
  type CommunityFacetsResponse,
} from '@liveworkspace/community';
import { useCommunitySite } from '../client';
import { CategoryIcon } from '../shared/icons';
import { SearchControlMenu } from './SearchControlMenu';

// The category control inside the search box (liveworkspace/docs/specs/007-community/community.md "The gallery"): All,
// then each of the scope's categories with its count of documents. Choosing one is written into the search as
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
  const { scope } = useCommunitySite();
  // All Apps offers every app's categories, each once.
  const categories = scope === 'all' ? allCommunityCategories() : communityCategories(scope);
  const label = value ? communityCategoryLabel(value) : 'Category';
  const rows = [
    {
      id: null,
      key: 'all',
      label: 'All Categories',
      count: facets?.total,
      checked: value === null,
    },
    ...categories
      .filter((c) => !facets || (facets.categories[c.id] ?? 0) > 0 || c.id === value)
      .map((c) => ({
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
