'use client';

// This Browser's verbs for one item (open, archive, reload after a move), the pill and Changed line its rows
// and cards carry, and its menu (ThisBrowserItemMenu), shared by the page, the panel and Home's cards.
// ThisBrowser.tsx re-exports them.

import { useCallback, useState } from 'react';
import {
  setThisBrowserArchived,
  BROWSER_STORAGE_COPY,
  THIS_BROWSER_FOCUS,
  THIS_BROWSER_HOVER,
  THIS_BROWSER_TONE,
  type ThisBrowserItem,
} from '../this-browser';
import { MEDIUM_DATE_TIME } from '@liveworkspace/ui/date-format';
import { relativeSince, useNow } from '../time';
import { ArchiveIcon, FolderOutlineIcon, OpenIcon, SyncIcon, TrashIcon } from '../ui/icons';
import { quoted } from '../quoted';
import { MenuActionRow, MenuGroupSeparator, MenuHeader, PortalMenu } from '../ui/Menu';
import { useExplorer } from './context';
import { BrowserIcon, useHostExtras } from './host';
import { useSyncLocal } from './this-browser-space/space';
import type { ThisBrowserHost } from './ThisBrowser';

// A host's verb that moved an item (Sync, Take Offline) without a page load: the lists load again once it settles,
// whether it moved or not, so they show where the item is now.
export function thenReload(result: Promise<unknown> | void, reloadLists: () => void): void {
  if (result) void result.then(reloadLists, reloadLists);
}

/** Move to Archived for an item kept only in this browser: marked in this browser alone, nothing uploaded
 *  (one-explorer.md "Archived"). */
export function useArchiveLocal(): (item: ThisBrowserItem) => void {
  const { app, toast } = useExplorer();
  return useCallback(
    (item: ThisBrowserItem) => {
      setThisBrowserArchived(app, item.id, Date.now());
      toast.show(`Moved ${quoted(item.title || 'Untitled')} to Archived.`, { tone: 'success' });
    },
    [app, toast],
  );
}

/** Opens one in its app: the host's `open` (the editor's panel, no page load), else a page load of its address. */
export function openThisBrowserItem(host: ThisBrowserHost, item: ThisBrowserItem): void {
  if (host.open) host.open(item);
  else window.location.assign(host.itemHref(item));
}

let pillSeq = 0;

/** The teal pill every local row and card carries: not colour alone (an icon and the words), its sentence as its
 *  description, and a link to the app's help where the row is not itself a link. Its tone (THIS_BROWSER_TONE) is the
 *  editors' pill's too (@liveworkspace/workbench ThisBrowserPill). */
export function ThisBrowserPill({ inLink = false }: { inLink?: boolean }) {
  const { thisBrowser } = useHostExtras();
  const [id] = useState(() => `this-browser-pill-${++pillSeq}`);
  const body = (
    <>
      <BrowserIcon size={11} />
      <span>{BROWSER_STORAGE_COPY.label}</span>
      <span id={id} className="sr-only">
        {BROWSER_STORAGE_COPY.sentence}
      </span>
    </>
  );
  const className = `inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${THIS_BROWSER_TONE}`;
  if (inLink || !thisBrowser?.helpHref)
    return (
      <span
        data-this-browser=""
        aria-describedby={id}
        title={BROWSER_STORAGE_COPY.sentence}
        className={className}
      >
        {body}
      </span>
    );
  return (
    <a
      data-this-browser=""
      href={thisBrowser.helpHref}
      target="_blank"
      rel="noreferrer"
      aria-describedby={id}
      title={BROWSER_STORAGE_COPY.sentence}
      className={`${className} hover:underline ${THIS_BROWSER_HOVER} ${THIS_BROWSER_FOCUS}`}
    >
      {body}
    </a>
  );
}

/** "Changed 3 hours ago", its full date and time in the reader's locale on hover: This Browser's rows, on the page
 *  and in the panel alike. */
export function ChangedAgo({ at }: { at: number }) {
  const now = useNow();
  // A stored date past what a Date holds has no full date to give.
  if (Number.isNaN(new Date(at).getTime())) return <span>Changed</span>;
  return (
    <time dateTime={new Date(at).toISOString()} title={MEDIUM_DATE_TIME.format(at)}>
      Changed {relativeSince(at, now || Date.now())}
    </time>
  );
}

/** This Browser's menu for one live item, from its card's on Home ⋯ or a right-click: Open; Sync (signed in: in
 *  place with `sync`, or the page's hand-over to the editor with `syncHref`), as This Browser's rows offer it; and
 *  Delete, asked first, where the host deletes in place (`remove`). */
export function ThisBrowserItemMenu({
  item,
  anchor,
  onClose,
}: {
  item: ThisBrowserItem;
  anchor: HTMLElement | null;
  onClose: () => void;
}) {
  const { thisBrowser: host } = useHostExtras();
  const { kind, openDialog } = useExplorer();
  const archive = useArchiveLocal();
  const syncLocal = useSyncLocal();
  const title = item.title || 'Untitled';
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  if (!host) return null;
  const sync = syncLocal ? () => syncLocal(item) : null;
  return (
    <PortalMenu anchor={anchor} onClose={onClose} label={`Actions for ${title}`}>
      <MenuHeader title={title} aside={<ThisBrowserPill inLink />} />
      <MenuActionRow
        label="Open"
        icon={<OpenIcon />}
        onClick={run(() => openThisBrowserItem(host, item))}
      />
      {sync ? (
        <MenuActionRow label={`Sync ${kind.one}`} icon={<SyncIcon />} onClick={run(sync)} />
      ) : null}
      <MenuActionRow
        label="Move to Folder"
        icon={<FolderOutlineIcon />}
        onClick={run(() => openDialog({ kind: 'move-local-item', item }))}
      />
      <MenuActionRow
        label="Move to Archived"
        icon={<ArchiveIcon />}
        onClick={run(() => archive(item))}
      />
      {host.remove ? (
        <>
          <MenuGroupSeparator />
          <MenuActionRow
            label={`Delete ${kind.one}`}
            icon={<TrashIcon />}
            onClick={run(() => openDialog({ kind: 'delete-local', item }))}
          />
        </>
      ) : null}
    </PortalMenu>
  );
}
