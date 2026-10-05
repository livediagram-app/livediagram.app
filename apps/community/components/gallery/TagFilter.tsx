'use client';

import type { CommunityFacetsResponse } from '@livediagram/api-schema';
import { HashIcon } from '../shared/icons';
import { SearchControlMenu } from './SearchControlMenu';

// The tag filter inside the search box's right edge (docs/specs/025-community/community.md "Gallery"):
// the most used tags, each a checkable row. Choosing one adds its `#tag` to the search and choosing it
// again takes it out, so the search box always shows every filter in words. The menu stays open so several
// tags can be picked in turn.
export function TagFilter({
  facets,
  selected,
  onToggle,
}: {
  facets: CommunityFacetsResponse | null;
  // The tags the search currently asks for.
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  const popular = facets?.tags ?? [];
  // A tag asked for by a link but no longer popular still shows, checked, so it can be taken out; it has its
  // own group, so it never sits under a heading that calls it popular.
  const chosenOnly = selected
    .filter((t) => !popular.some((p) => p.tag === t))
    .map((tag) => ({ id: tag, key: tag, label: `#${tag}`, checked: true }));
  const popularRows = popular.map(({ tag, count }) => ({
    id: tag,
    key: tag,
    label: `#${tag}`,
    count,
    checked: selected.includes(tag),
  }));
  if (chosenOnly.length === 0 && popularRows.length === 0) return null;
  return (
    <SearchControlMenu<string>
      trigger={{
        ariaLabel: selected.length ? `Tags, ${selected.length} chosen` : 'Filter by tag',
        icon: <HashIcon />,
        label: 'Tags',
        active: selected.length > 0,
        badge: selected.length,
      }}
      menuLabel="Tags"
      groups={[
        { heading: 'Chosen', rows: chosenOnly },
        { heading: 'Popular Tags', rows: popularRows },
      ]}
      role="menuitemcheckbox"
      width="w-60"
      scroll
      closeOnPick={false}
      onPick={onToggle}
    />
  );
}
