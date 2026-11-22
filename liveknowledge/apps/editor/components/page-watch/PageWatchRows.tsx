'use client';

// Watching, in a page's menus (docs/specs/030-knowledgebase/watching.md "Where it shows"): Watch, Watch This Section
// (for a page with subpages) and Unwatch, each a checkmark row; under a watched section, a greyed "Watching Through
// <Section>" whose hover card says where to stop it. The tree's row menu and the rail's Watch button draw these same
// rows. Pure: the caller holds the watch.
import type { ReactNode } from 'react';
import type { PageWatchResponse, PageWatchScope } from '@liveknowledge/api-schema';
import { HoverCard } from '@liveknowledge/ui';
import { MenuActionRow } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { CheckIcon } from '@/components/knowledge/knowledge-icons';
import { EyeIcon, EyeOffIcon, SectionWatchIcon } from './watch-icons';

export function PageWatchRows({
  watch,
  ready,
  onSet,
}: {
  watch: PageWatchResponse;
  /** Read: until then the rows show, greyed, so the menu keeps its shape. */
  ready: boolean;
  onSet: (scope: PageWatchScope | null) => void;
}): ReactNode {
  const check = (on: boolean) => (on ? <CheckIcon data-checked="" /> : undefined);
  const rows: ReactNode[] = [
    <MenuActionRow
      key="watch"
      plain
      label="Watch"
      icon={<EyeIcon />}
      aside={check(watch.watching === 'page')}
      disabled={!ready}
      onClick={() => onSet(watch.watching === 'page' ? null : 'page')}
    />,
  ];
  if (watch.section)
    rows.push(
      <MenuActionRow
        key="section"
        plain
        label="Watch This Section"
        icon={<SectionWatchIcon />}
        aside={check(watch.watching === 'section')}
        disabled={!ready}
        onClick={() => onSet(watch.watching === 'section' ? null : 'section')}
      />,
    );
  if (watch.watching)
    rows.push(
      <MenuActionRow
        key="unwatch"
        plain
        label={watch.watching === 'section' ? 'Unwatch This Section' : 'Unwatch'}
        icon={<EyeOffIcon />}
        disabled={!ready}
        onClick={() => onSet(null)}
      />,
    );
  if (watch.through && !watch.watching) {
    const label = `Watching Through ${watch.through.name.trim() || 'Untitled Page'}`;
    rows.push(
      <HoverCard
        key="through"
        block
        title={label}
        description="You get updates about every page in that section. Unwatch it from its own page."
      >
        <MenuActionRow
          plain
          disabled
          label={label}
          icon={<SectionWatchIcon />}
          onClick={() => {}}
        />
      </HoverCard>,
    );
  }
  return rows;
}
