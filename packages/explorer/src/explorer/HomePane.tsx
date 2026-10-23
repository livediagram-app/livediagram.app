'use client';

// Home (liveplanner's HomePane, without What Happened): Jump back in, the person's latest opens as large
// cards, and Shared with you recently. Two requests, each one small page.

import { memo, useMemo } from 'react';
import type { ShownItem } from '../data/overlay';
import { useItemList } from '../data/useItemList';
import { recentLoader, sharedRecentlyLoader } from '../data/viewLists';
import { Button } from '../ui/Button';
import { RelativeTimeChip } from '../ui/RelativeTimeChip';
import { EllipsisTriggerButton, useRowMenu } from '../ui/RowMenu';
import { FOCUS_RING, MUTED } from '../ui/classes';
import { ItemIcon } from '../ui/icons';
import { AppMark } from './badges';
import { useExplorer } from './context';
import { EmptyPane } from './EmptyPane';
import { ItemMenu } from './menus';
import { PaneHeader } from './PaneHeader';

export const HOME_RECENT = 8;
export const HOME_SHARED = 4;

const SECTION_HEADING =
  'text-2xl font-extrabold tracking-[-0.03em] text-slate-900 dark:text-slate-100';
const SECTION_LINK =
  'inline-flex min-h-6 items-center rounded-sm text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300';
const CARD_SURFACE =
  'border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-brand-300 hover:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-brand-300)_25%,transparent),0_18px_36px_-16px_color-mix(in_oklab,var(--color-brand-600)_45%,transparent)] motion-safe:hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-400/60';
const SKELETON = 'rounded-md bg-slate-200/70 motion-safe:animate-pulse dark:bg-slate-800';

export function HomePane({ onOpenNav }: { onOpenNav?: () => void }) {
  const { client, app, filter, overlay, epoch, words, viewHref, navigate, onCreate, kind } =
    useExplorer();
  const recentLoad = useMemo(
    () => recentLoader(client, app, filter, HOME_RECENT),
    [client, app, filter],
  );
  const sharedLoad = useMemo(
    () => sharedRecentlyLoader(client, app, filter, HOME_SHARED),
    [client, app, filter],
  );
  const recent = useItemList({
    key: `home-recent:${filter}`,
    load: recentLoad,
    overlay,
    belongs: live,
    epoch,
  });
  const shared = useItemList({
    key: `home-shared:${filter}`,
    load: sharedLoad,
    overlay,
    belongs: live,
    epoch,
  });

  return (
    <div data-explorer-view="home">
      <PaneHeader
        title="Home"
        onOpenNav={onOpenNav}
        onCreateItem={() => onCreate({ folderId: null, teamId: null })}
      />
      <section aria-labelledby="jump-back-in" className="mb-10">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="jump-back-in" className={SECTION_HEADING}>
            Jump back in
          </h2>
          <a
            href={viewHref({ kind: 'recent' })}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              navigate({ kind: 'recent' });
            }}
            className={`${SECTION_LINK} ${FOCUS_RING}`}
          >
            See more
          </a>
        </div>
        {recent.loading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`h-[12.5rem] ${SKELETON}`} />
            ))}
          </div>
        ) : recent.items.length === 0 ? (
          <EmptyPane view={{ kind: 'home' }} words={words}>
            <Button size="sm" onClick={() => onCreate({ folderId: null, teamId: null })}>
              New {kind.one}
            </Button>
          </EmptyPane>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {recent.items.map((item) => (
              <JumpBackInCard key={item.id} item={item} showApp={filter === 'all'} />
            ))}
          </div>
        )}
      </section>
      {shared.items.length > 0 ? (
        <section aria-labelledby="shared-recently">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 id="shared-recently" className={SECTION_HEADING}>
              Shared with you recently
            </h2>
            <a
              href={viewHref({ kind: 'shared' })}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                navigate({ kind: 'shared' });
              }}
              className={`${SECTION_LINK} ${FOCUS_RING}`}
            >
              See all
            </a>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {shared.items.map((item) => (
              <JumpBackInCard key={item.id} item={item} showApp={filter === 'all'} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

const live = (i: ShownItem) => i.trashedAt === null;

const JumpBackInCard = memo(function JumpBackInCard({
  item,
  showApp,
}: {
  item: ShownItem;
  showApp: boolean;
}) {
  const { Link, itemHref, renderThumbnail } = useExplorer();
  const menu = useRowMenu();
  const title = item.title || 'Untitled';
  return (
    <div
      data-item-card={item.id}
      className={`group relative flex h-[12.5rem] flex-col gap-2 rounded-2xl p-2 ${CARD_SURFACE}`}
      onContextMenu={menu.onContextMenu}
    >
      <Link
        href={itemHref(item)}
        aria-label={`Open ${title}`}
        className={`flex h-32 w-full items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-900 ${FOCUS_RING}`}
      >
        {renderThumbnail ? (
          renderThumbnail(item, 'card')
        ) : (
          <span className="text-slate-300 dark:text-slate-600 [&_svg]:h-8 [&_svg]:w-8">
            <ItemIcon />
          </span>
        )}
      </Link>
      <div className="flex min-w-0 items-start gap-1 px-1">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            {showApp ? <AppMark app={item.app} size={14} /> : null}
            <Link
              href={itemHref(item)}
              className="truncate text-[15px] font-semibold leading-5 text-slate-900 hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
            >
              {title}
            </Link>
          </span>
          <span className={`text-xs ${MUTED}`}>
            <RelativeTimeChip at={item.lastOpenedAt ?? item.updatedAt} />
          </span>
        </div>
        <EllipsisTriggerButton
          {...menu.triggerProps}
          reveal
          tuck
          size="md"
          label={`Menu for ${title}`}
        />
      </div>
      {menu.open ? (
        <ItemMenu item={item} anchor={menu.triggerRef.current} onClose={menu.close} />
      ) : null}
    </div>
  );
});
