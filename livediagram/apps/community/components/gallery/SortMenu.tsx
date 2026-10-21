'use client';

import { COMMUNITY_SORTS, type CommunitySort } from '@livediagram/api-schema';
import { SortIcon } from '../shared/icons';
import { SearchControlMenu } from './SearchControlMenu';

// The sort control inside the search box's right edge (docs/specs/025-community/community.md
// "Gallery": Newest, Most Loved, Most Copied). The choice is written into the search as a `sort:` token
// by the search box.
export function SortMenu({
  value,
  onChange,
}: {
  value: CommunitySort;
  onChange: (next: CommunitySort) => void;
}) {
  const current = COMMUNITY_SORTS.find((s) => s.id === value) ?? COMMUNITY_SORTS[0];
  const rows = COMMUNITY_SORTS.map((sort) => ({
    id: sort.id,
    key: sort.id,
    label: sort.label,
    checked: sort.id === value,
  }));
  return (
    <SearchControlMenu<CommunitySort>
      trigger={{
        ariaLabel: `Sort: ${current.label}`,
        icon: <SortIcon />,
        label: current.label,
        active: value !== 'new',
      }}
      menuLabel="Sort"
      groups={[{ rows }]}
      role="menuitemradio"
      width="min-w-44"
      closeOnPick
      onPick={(next) => {
        if (next !== value) onChange(next);
      }}
    />
  );
}
