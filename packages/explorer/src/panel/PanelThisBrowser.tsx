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
  LocalPreview,
  openThisBrowserItem,
  thenReload,
  useThisBrowserItems,
} from '../explorer/ThisBrowser';
import type { ThisBrowserItem } from '../this-browser';
import { relativeSince, useNow } from '../time';
import { TrashIcon } from '../ui/icons';
import { PaneEmpty, PaneIconButton, PaneList, PaneRow } from './pane-parts';

// Sync, in words: the one verb a row spells out, since it moves the item somewhere.
const SYNC_BUTTON =
  'flex h-8 shrink-0 cursor-pointer items-center rounded-lg px-2.5 text-xs font-medium text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-500 pointer-coarse:h-11 dark:text-brand-200 dark:ring-brand-400/40 dark:hover:bg-brand-500/15';

export function PanelThisBrowser() {
  const { app, words, kind, reloadLists, openDialog } = useExplorer();
  const { host, live } = useThisBrowserItems();
  const now = useNow();
  if (!host || live.length === 0)
    return (
      <PaneEmpty
        icon={<BrowserIcon size={20} />}
        title="Nothing here"
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
              meta={`Changed ${relativeSince(item.updatedAt, now || Date.now())}`}
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
