'use client';

// The editor panel's This Browser section, as livediagram's own panel showed it before the shared Explorer (its
// `browser` section): the items this browser keeps only for itself (offline), newest change first, each a row that
// opens it in the editor. The editor runs the app's own code, so Sync (signed in) moves one into the account in
// place, and Delete removes one for good after a confirmation (the Explorer's `delete-local` dialog, which a drop on
// the Trash asks too), since nothing else holds it. The rail shows the section
// only while there are some (sections.ts), with their count.

import { useExplorer } from '../explorer/context';
import { BrowserIcon } from '../explorer/host';
import {
  ChangedAgo,
  LocalPreview,
  openThisBrowserItem,
  THIS_BROWSER_EMPTY,
  ThisBrowserItemMenu,
  ThisBrowserPill,
  thenReload,
  useThisBrowserItems,
} from '../explorer/ThisBrowser';
import { memo } from 'react';
import { useThisBrowserDrag } from '../drag/drag';
import { jumpBackInLine } from '../data/viewLists';
import type { ThisBrowserItem } from '../this-browser';
import { useNow } from '../time';
import { EllipsisTriggerButton, useRowMenu } from '../ui/RowMenu';
import { TrashIcon } from '../ui/icons';
import { PaneCard, PaneEmpty, PaneIconButton, PaneList, PaneRow } from './pane-parts';

// Sync, in words: the one verb a row spells out, since it moves the item somewhere.
const SYNC_BUTTON =
  'flex h-8 shrink-0 cursor-pointer items-center rounded-lg px-2.5 text-xs font-medium text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-500 pointer-coarse:h-11 dark:text-brand-200 dark:ring-brand-400/40 dark:hover:bg-brand-500/15';

export function PanelThisBrowser() {
  const { app, words, kind, reloadLists, openDialog } = useExplorer();
  const { host, live } = useThisBrowserItems();
  if (!host || live.length === 0)
    return (
      <PaneEmpty
        icon={<BrowserIcon size={20} />}
        title={THIS_BROWSER_EMPTY}
        description={`${words.many} you keep only in this browser show up here.`}
      />
    );
  const open = (item: ThisBrowserItem) => openThisBrowserItem(host, item);
  return (
    <div className="flex flex-col gap-3">
      <p className="px-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
        {words.many} kept only in this browser. They aren’t in your account and don’t sync to other
        devices.
      </p>
      <PaneList label="This Browser">
        {live.map((item) => {
          const name = item.title || `Untitled ${kind.lowerOne}`;
          return (
            <PaneRow
              key={item.id}
              leading={
                <LocalPreview app={app} iconSize={16} className="size-8 shrink-0 rounded-lg" />
              }
              title={name}
              label={name}
              meta={<ChangedAgo at={item.updatedAt} />}
              onActivate={() => open(item)}
              rowProps={{ 'data-this-browser-row': item.id } as React.HTMLAttributes<HTMLLIElement>}
              trailing={
                host.sync || host.remove ? (
                  <>
                    {host.sync ? (
                      <button
                        type="button"
                        aria-label={`Sync ${kind.one}: ${name}`}
                        onClick={() => thenReload(host.sync?.(item), reloadLists)}
                        className={SYNC_BUTTON}
                      >
                        Sync
                      </button>
                    ) : null}
                    {host.remove ? (
                      <PaneIconButton
                        label={`Delete ${name}`}
                        tone="danger"
                        onClick={() => openDialog({ kind: 'delete-local', item })}
                      >
                        <TrashIcon />
                      </PaneIconButton>
                    ) : null}
                  </>
                ) : null
              }
            />
          );
        })}
      </PaneList>
    </div>
  );
}

/** Home's Jump Back In card for an item kept only in this browser, as the page's Home shows one: This Browser's
 *  picture, the pill and when it was opened, This Browser's menu (Open, Sync, Delete) and its drag. */
export const PanelLocalCard = memo(function PanelLocalCard({ item }: { item: ThisBrowserItem }) {
  const { app, kind } = useExplorer();
  const { host } = useThisBrowserItems();
  const menu = useRowMenu();
  const drag = useThisBrowserDrag(item);
  const now = useNow();
  const name = item.title || `Untitled ${kind.lowerOne}`;
  return (
    <PaneCard
      preview={<LocalPreview app={app} iconSize={28} className="h-full w-full" />}
      title={name}
      label={name}
      meta={
        <span className="flex min-w-0 items-center gap-1.5">
          <ThisBrowserPill inLink />
          <span className="truncate">{jumpBackInLine(item, now || Date.now())}</span>
        </span>
      }
      onActivate={host ? () => openThisBrowserItem(host, item) : undefined}
      rowProps={
        {
          'data-this-browser-card': '',
          onContextMenu: menu.onContextMenu,
          ...drag,
        } as React.HTMLAttributes<HTMLLIElement>
      }
      trailing={
        <>
          <EllipsisTriggerButton
            {...menu.triggerProps}
            size="md"
            reveal
            label={`Menu for ${name}`}
          />
          {menu.open ? (
            <ThisBrowserItemMenu
              item={item}
              anchor={menu.triggerRef.current}
              onClose={menu.close}
            />
          ) : null}
        </>
      }
    />
  );
});
