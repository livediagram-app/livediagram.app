'use client';

import {
  COMMUNITY_APPS,
  communityCategories,
  communityCategoryLabel,
  type CommunityApp,
  type CommunityCategory,
  type CommunityCategoryDef,
  type CommunityCategoryFilter,
  type CommunityFacetsResponse,
} from '@liveworkspace/community';
import { siteOfApp } from '@liveworkspace/sites';
import { useCommunitySite } from '../client';
import { appNameOf } from '../lib/links';
import { CategoryIcon } from '../shared/icons';
import { SearchControlMenu } from './SearchControlMenu';

// The category control inside the search box (liveworkspace/docs/specs/007-community/community.md "One page for every
// app"): All, then the scope's categories with their counts of documents. On one app's gallery those are its own,
// written as `category:<id>`. All Apps lists each app's under the app's name, each written with its app
// (`category:livediagram/meetings`), since the same id means different things in two apps. All takes the word out.
// Once the counts are known an empty category is left out (unless it is the one chosen), so every row leads somewhere.

type Row = {
  id: CommunityCategoryFilter | null;
  key: string;
  label: string;
  ariaLabel?: string;
  count?: number;
  checked: boolean;
};

const appName = (app: CommunityApp) => siteOfApp(appNameOf(app)).name;

const sameCategory = (a: CommunityCategoryFilter | null, app: CommunityApp | null, id: string) =>
  a !== null && a.id === id && a.app === app;

function rowsOf(
  app: CommunityApp,
  qualified: boolean,
  value: CommunityCategoryFilter | null,
  counts: Partial<Record<CommunityCategory, number>> | undefined,
  known: boolean,
): Row[] {
  const as = qualified ? app : null;
  return (communityCategories(app) as readonly (CommunityCategoryDef & { id: CommunityCategory })[])
    .filter((c) => !known || (counts?.[c.id] ?? 0) > 0 || sameCategory(value, as, c.id))
    .map((c) => ({
      id: { app: as, id: c.id },
      key: `${app}/${c.id}`,
      label: c.label,
      ...(qualified ? { ariaLabel: `${c.label}, ${appName(app)}` } : {}),
      count: known ? (counts?.[c.id] ?? 0) : undefined,
      checked: sameCategory(value, as, c.id),
    }));
}

export function CategoryMenu({
  value,
  facets,
  onChange,
}: {
  value: CommunityCategoryFilter | null;
  facets: CommunityFacetsResponse | null;
  onChange: (next: CommunityCategoryFilter | null) => void;
}) {
  const { scope } = useCommunitySite();
  const all = scope === 'all';
  // A bare id on All Apps is no app's category there (lib/query-state.ts placeCategory): the trigger reads Category.
  const chosenApp = all ? value?.app : scope;
  const label = value && chosenApp ? communityCategoryLabel(chosenApp, value.id) : 'Category';
  const allRow: Row = {
    id: null,
    key: 'all',
    label: 'All Categories',
    count: facets?.total,
    checked: value === null,
  };
  const groups = all
    ? [
        { rows: [allRow] },
        ...COMMUNITY_APPS.map((app) => ({
          heading: appName(app),
          rows: rowsOf(app, true, value, facets?.apps?.[app], facets !== null),
        })),
      ]
    : [
        {
          rows: [allRow, ...rowsOf(scope, false, value, facets?.categories, facets !== null)],
        },
      ];
  return (
    <SearchControlMenu<CommunityCategoryFilter | null>
      trigger={{
        ariaLabel:
          value && chosenApp
            ? `Category: ${label}${all ? `, ${appName(chosenApp)}` : ''}`
            : 'Filter by category',
        icon: <CategoryIcon />,
        label,
        active: value !== null && Boolean(chosenApp),
      }}
      menuLabel="Category"
      groups={groups}
      role="menuitemradio"
      width="w-64"
      scroll
      closeOnPick
      onPick={(next) => {
        const same = next === null ? value === null : sameCategory(value, next.app, next.id);
        if (!same) onChange(next);
      }}
    />
  );
}
