'use client';

// The Library's Walkthroughs (liveworkspace/docs/specs/006-media/walkthroughs.md "The Explorer's Walkthroughs"): every
// walkthrough the person recorded in this app, newest first, as cards. Each card's preview box plays its media in
// place (read as a blob with the person's token, so nothing sits behind a public address), maximises to full screen,
// and closes back to the preview; under it, the title, the item it was recorded on (opening it), when and how big, and
// Delete, which asks first since it can't be undone. One plays at a time.
import { walkthroughHeroArt } from '@liveworkspace/ui/dialog-hero-art/walkthrough';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Item } from '@liveworkspace/index-client';
import {
  Button,
  ConfirmPopover,
  EmptyState,
  LinkIcon,
  Portal,
  PublicLinkPopover,
  Spinner,
  VideoDialog,
} from '@liveworkspace/ui';
import { workspaceOriginFor } from '@liveworkspace/sites';
import { useExplorer } from '../explorer/context';
import { PaneHeader } from '../explorer/PaneHeader';
import { HelpButton } from '../explorer/HomeHero';
import { lucide } from '../ui/icons';
import { WalkthroughIcon } from '../ui/library-icons';
import { SIDEBAR_LABELS } from '../views';
import { useLibraryHost } from './context';
import { LibraryUsage } from './LibraryUsage';
import type { WalkthroughEntry, WalkthroughsHost } from './types';

// The index's lookup takes this many ids a call.
const LOOKUP_BATCH = 100;

const PlayGlyph = lucide(<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none" />, 22);
// A walkthrough's public link on liveworkspace.app (staging's from a staging app), as the editor's Share makes it.
const walkthroughShareUrl = (code: string) =>
  `${workspaceOriginFor(globalThis.location?.host ?? '')}/walkthrough?c=${code}`;
const BinGlyph = lucide(<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />, 15);
const CameraGlyph = lucide(
  <>
    <path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 11" />
    <rect x="2" y="6" width="14" height="12" rx="2" />
  </>,
  13,
);
const MicGlyph = lucide(
  <>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4" />
  </>,
  13,
);
const DocGlyph = lucide(
  <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </>,
  13,
);

const DATE = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function clockOf(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function sizeOf(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Load =
  { state: 'loading' } | { state: 'failed' } | { state: 'ready'; entries: WalkthroughEntry[] };

/** The Explorer page's Walkthroughs view: its header, then the cards. */
export function WalkthroughsView() {
  const { kind } = useExplorer();
  const { walkthroughs } = useLibraryHost();
  return (
    <div data-explorer-view="walkthroughs">
      <PaneHeader
        title={SIDEBAR_LABELS.walkthroughs}
        showFilter={false}
        actions={walkthroughs?.helpHref ? <HelpButton href={walkthroughs.helpHref} /> : null}
      />
      {walkthroughs ? (
        <WalkthroughsContent host={walkthroughs} />
      ) : (
        <EmptyState
          icon={<WalkthroughIcon size={28} />}
          title="No Walkthroughs here"
          description={`${kind.many} keep no walkthroughs.`}
        />
      )}
    </div>
  );
}

export function WalkthroughsContent({
  host,
  compact = false,
}: {
  host: WalkthroughsHost;
  // In the editor panel: one card a row.
  compact?: boolean;
}) {
  const { client, kind } = useExplorer();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [items, setItems] = useState<ReadonlyMap<string, Item>>(new Map());
  const [playing, setPlaying] = useState<string | null>(null);

  // The items' names, from the index, in batches at once; one it no longer has (or a failed read) stays unnamed.
  const nameItems = useCallback(
    async (entries: readonly WalkthroughEntry[], signal?: AbortSignal) => {
      const ids = [...new Set(entries.map((e) => e.item))];
      const batches: string[][] = [];
      for (let i = 0; i < ids.length; i += LOOKUP_BATCH)
        batches.push(ids.slice(i, i + LOOKUP_BATCH));
      const found = await Promise.all(
        batches.map((batch) =>
          Promise.resolve()
            .then(() => client.lookupItems(batch))
            .then(
              (r) => r.items,
              () => [] as Item[],
            ),
        ),
      );
      if (!signal?.aborted) setItems(new Map(found.flat().map((item) => [item.id, item])));
    },
    [client],
  );
  const read = useCallback(
    (signal?: AbortSignal) => {
      host.list(signal).then(
        (entries) => {
          if (signal?.aborted) return;
          setLoad({ state: 'ready', entries });
          void nameItems(entries, signal);
        },
        () => {
          if (!signal?.aborted) setLoad({ state: 'failed' });
        },
      );
    },
    [host, nameItems],
  );
  useEffect(() => {
    const ac = new AbortController();
    read(ac.signal);
    return () => ac.abort();
  }, [read]);

  const grid = compact
    ? 'grid grid-cols-3 gap-2'
    : 'grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4 px-4 pb-6 sm:px-6';

  if (load.state === 'loading')
    return (
      <div aria-busy="true" data-walkthroughs-skeleton="" className={grid}>
        <span className="sr-only">Loading walkthroughs</span>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="aspect-video animate-pulse bg-slate-100 motion-reduce:animate-none dark:bg-slate-800" />
            <div className={`flex flex-col gap-2 ${compact ? 'p-1.5' : 'p-3'}`}>
              <div className="h-3.5 w-2/3 rounded bg-slate-200/80 dark:bg-slate-700/60" />
              <div className="h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-700/40" />
            </div>
          </div>
        ))}
      </div>
    );
  if (load.state === 'failed')
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Couldn’t load your walkthroughs.
        </p>
        <button
          type="button"
          onClick={() => {
            setLoad({ state: 'loading' });
            read();
          }}
          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          Try Again
        </button>
      </div>
    );
  const usage = host.usage?.() ?? null;
  const meter = usage ? (
    <LibraryUsage
      kind="walkthroughs"
      used={usage.stored}
      limit={usage.storedLimit}
      maxMs={usage.maxMs}
      owner={usage.owner}
      compact={compact}
      className={
        compact
          ? 'mb-3 border-b border-slate-100 pb-3 dark:border-slate-800'
          : // In line with what follows: the grid's own inset, or the empty state's edge.
            `${load.entries.length > 0 ? 'mx-4 sm:mx-6' : ''} mb-5 border-b border-slate-100 pb-4 dark:border-slate-800`
      }
    />
  ) : null;
  if (load.entries.length === 0)
    return (
      <>
        {meter}
        <EmptyState
          compact={compact}
          icon={<WalkthroughIcon size={compact ? 20 : 28} />}
          title="No walkthroughs yet"
          description={`Record one from Tools on any ${kind.lowerOne}: it collects here to watch again or tidy away.`}
        />
      </>
    );
  return (
    <>
      {meter}
      <ul aria-label={SIDEBAR_LABELS.walkthroughs} data-walkthroughs-grid="" className={grid}>
        {load.entries.map((entry) => (
          <WalkthroughCard
            key={entry.id}
            entry={entry}
            item={items.get(entry.item) ?? null}
            host={host}
            playing={playing === entry.id}
            onPlay={(on) => setPlaying(on ? entry.id : null)}
            compact={compact}
            onChanged={(next) =>
              setLoad((l) =>
                l.state === 'ready'
                  ? { state: 'ready', entries: l.entries.map((e) => (e.id === next.id ? next : e)) }
                  : l,
              )
            }
            onDeleted={() =>
              setLoad((l) =>
                l.state === 'ready'
                  ? { state: 'ready', entries: l.entries.filter((e) => e.id !== entry.id) }
                  : l,
              )
            }
          />
        ))}
      </ul>
    </>
  );
}

function WalkthroughCard({
  entry,
  item,
  host,
  playing,
  onPlay,
  onDeleted,
  onChanged,
  compact,
}: {
  entry: WalkthroughEntry;
  item: Item | null;
  host: WalkthroughsHost;
  playing: boolean;
  onPlay: (on: boolean) => void;
  onDeleted: () => void;
  onChanged: (next: WalkthroughEntry) => void;
  // In the editor panel: three small tiles a row, the title alone under each; one playing takes the whole row so its
  // controls have room.
  compact: boolean;
}) {
  const { itemHref, Link } = useExplorer();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirmAt, setConfirmAt] = useState<HTMLElement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const shareRef = useRef<HTMLButtonElement>(null);
  const [sharing, setSharing] = useState(false);

  // The media is read once, when first played, and its object URL let go when the card goes.
  useEffect(() => {
    if (!playing || url) return;
    const ac = new AbortController();
    setLoading(true);
    setFailed(false);
    host
      .media(entry, ac.signal)
      .then((blob) => setUrl(URL.createObjectURL(blob)))
      .catch(() => {
        if (!ac.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [playing, url, host, entry]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  const initial = (entry.author ?? 'Y').trim().charAt(0).toUpperCase() || 'Y';
  const when = useMemo(() => DATE.format(entry.createdAt), [entry.createdAt]);

  async function remove() {
    setConfirmAt(null);
    setDeleting(true);
    try {
      await host.remove(entry);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  }

  return (
    <li
      data-walkthrough-card={entry.id}
      title={compact ? `${entry.title} · ${when}` : undefined}
      className={`group flex flex-col overflow-hidden ${compact ? 'rounded-xl' : 'rounded-2xl'} border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition-[box-shadow,transform,opacity] duration-short hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-900 ${
        deleting ? 'pointer-events-none opacity-50' : ''
      }`}
    >
      <div
        className={`relative aspect-video overflow-hidden ${
          entry.camera
            ? 'bg-slate-950'
            : 'bg-gradient-to-br from-brand-500 via-brand-600 to-violet-700'
        }`}
      >
        {/* Playing opens the same centred modal as the editor's Tools (owner, 2026-11-17); the card stays as it is. */}
        {
          <button
            type="button"
            onClick={() => onPlay(true)}
            aria-label={`Play ${entry.title}`}
            className="group/play absolute inset-0 flex cursor-pointer items-center justify-center bg-gradient-to-br from-brand-500 via-brand-600 to-violet-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
          >
            {/* A faint dot grid and the recorder's face (a camera for one with video). */}
            <svg
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full text-white/15"
            >
              <defs>
                <pattern
                  id={`wt-dots-${entry.id}`}
                  width="16"
                  height="16"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="2" cy="2" r="1.2" fill="currentColor" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#wt-dots-${entry.id})`} />
            </svg>
            {compact ? null : (
              <span
                aria-hidden
                className="absolute left-3 top-3 flex size-9 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur-sm"
              >
                {initial}
              </span>
            )}
            <span
              className={`relative flex ${
                compact ? 'size-8' : 'size-14'
              } items-center justify-center rounded-full bg-white text-brand-700 shadow-xl shadow-brand-900/30 transition-transform duration-short group-hover/play:scale-110 motion-reduce:transition-none`}
            >
              {loading ? <Spinner /> : <PlayGlyph size={compact ? 14 : 22} className="ml-0.5" />}
            </span>
            {compact ? null : (
              <span className="absolute bottom-2.5 left-3 inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                {entry.screen || entry.camera ? <CameraGlyph /> : <MicGlyph />}
                {entry.screen ? 'Video' : entry.camera ? 'Camera' : 'Voice'}
              </span>
            )}
            <span
              className={`absolute rounded-full bg-black/45 font-semibold tabular-nums text-white backdrop-blur-sm ${
                compact
                  ? 'bottom-1 right-1 px-1.5 text-[10px]'
                  : 'bottom-2.5 right-3 px-2 py-0.5 text-[11px]'
              }`}
            >
              {clockOf(entry.durationMs)}
            </span>
          </button>
        }
        {failed ? (
          <p
            role="alert"
            className="absolute inset-x-3 top-3 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white"
          >
            Couldn’t play it. Try again.
          </p>
        ) : null}
      </div>
      <div className={`flex items-start ${compact ? 'gap-0.5 p-1.5 pr-0.5' : 'gap-2 p-3'}`}>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p
            className={`truncate font-semibold text-slate-900 dark:text-slate-50 ${
              compact ? 'text-[11px] leading-5' : 'text-sm'
            }`}
            title={entry.title}
          >
            {entry.title}
          </p>
          {compact ? null : item ? (
            <Link
              href={itemHref(item)}
              className="inline-flex min-w-0 items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              <DocGlyph className="shrink-0" />
              <span className="truncate">{item.title || 'Untitled'}</span>
            </Link>
          ) : (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              An item you can no longer open
            </span>
          )}
          {compact ? null : (
            <p className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
              {when} · {sizeOf(entry.mediaBytes)}
            </p>
          )}
        </div>
        <button
          type="button"
          title="Delete"
          aria-label={`Delete ${entry.title}`}
          onClick={(e) => setConfirmAt(e.currentTarget)}
          className={`relative flex ${
            compact ? 'touch-target size-5 rounded-md' : 'size-8 rounded-lg'
          } shrink-0 cursor-pointer items-center justify-center text-slate-400 transition-colors duration-micro hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15 dark:hover:text-rose-300`}
        >
          {deleting ? <Spinner /> : <BinGlyph size={compact ? 12 : 15} />}
        </button>
      </div>
      {confirmAt ? (
        <ConfirmPopover
          anchor={confirmAt}
          message="Delete this walkthrough? It can't be undone."
          confirmLabel="Delete"
          onConfirm={() => void remove()}
          onCancel={() => setConfirmAt(null)}
        />
      ) : null}
      {playing && url ? (
        <Portal>
          <VideoDialog
            art={walkthroughHeroArt}
            title={entry.title}
            meta={`${clockOf(entry.durationMs)} · ${when}`}
            src={url}
            onClose={() => onPlay(false)}
            actions={
              entry.screen && host.share ? (
                <Button
                  ref={shareRef}
                  variant={entry.shareCode ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => setSharing(true)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <LinkIcon size={13} />
                    {entry.shareCode ? 'Shared' : 'Share'}
                  </span>
                </Button>
              ) : null
            }
          />
          <PublicLinkPopover
            open={sharing}
            anchor={shareRef.current}
            url={entry.shareCode ? walkthroughShareUrl(entry.shareCode) : null}
            title="Share Walkthrough"
            description="Anyone with the link can watch this video, without signing in. They see its name and who made it, never the canvas."
            onShare={async (on) => {
              const next = await host.share!(entry, on).catch(() => null);
              if (next) onChanged(next);
              return next !== null;
            }}
            onClose={() => setSharing(false)}
          />
        </Portal>
      ) : null}
    </li>
  );
}
