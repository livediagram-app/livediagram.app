'use client';

// The header's Walkthroughs button and its menu (liveworkspace/docs/specs/006-media/walkthroughs.md "The Walkthroughs
// menu"): a full-height header action, left of Present, with a count badge; the menu under it lists the item's
// walkthroughs to play, each with its delete where the caller may, and Record Walkthrough for an Editor.

import type { WalkthroughSummary } from '@liveworkspace/media/walkthrough';
import {
  CompactEmptyState,
  ConfirmPopover,
  CountBadge,
  HoverCard,
  Portal,
  Spinner,
  TrashIcon,
  formatRelativeTime,
  useClickOutside,
  usePopoverLayer,
} from '@liveworkspace/ui';
import {
  HEADER_ACTION_BTN,
  HeaderGlyph,
} from '@liveworkspace/workbench/components/chrome/header-action';
import { useLayoutEffect, useRef, useState } from 'react';
import { formatClock } from '../timeline';
import type { WalkthroughsMenu } from '../useWalkthroughs';
import { PlayIcon, RecordIcon, WalkthroughIcon } from './icons';

const MENU_WIDTH = 336;
const MARGIN = 8;

export function WalkthroughsButton({ menu: walkthroughs }: { menu: WalkthroughsMenu }) {
  // The button the menu hangs from, while it is open.
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = anchor !== null;
  if (!walkthroughs.available) return null;
  const count = walkthroughs.list.length;
  return (
    <>
      <HoverCard
        title="Walkthroughs"
        description={
          count > 0
            ? `${count} recorded ${count === 1 ? 'walkthrough' : 'walkthroughs'} of this canvas.`
            : 'Record yourself talking through this canvas.'
        }
      >
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          data-walkthroughs-button=""
          onClick={(e) => setAnchor(open ? null : e.currentTarget)}
          className={`${HEADER_ACTION_BTN} hidden text-slate-600 hover:bg-slate-50 sm:flex dark:text-slate-200 dark:hover:bg-slate-800 ${
            open ? 'bg-slate-50 dark:bg-slate-800' : ''
          }`}
        >
          <span className="relative">
            <HeaderGlyph>
              <WalkthroughIcon size={15} />
            </HeaderGlyph>
            {count > 0 ? (
              <CountBadge
                count={count}
                tone="brand"
                label={`${count} walkthroughs`}
                className="absolute -right-2.5 -top-1.5"
              />
            ) : null}
          </span>
          <span>Walkthroughs</span>
        </button>
      </HoverCard>
      {anchor ? (
        <WalkthroughsMenu
          anchor={anchor}
          walkthroughs={walkthroughs}
          onClose={() => setAnchor(null)}
        />
      ) : null}
    </>
  );
}

function WalkthroughsMenu({
  anchor,
  walkthroughs,
  onClose,
}: {
  anchor: HTMLElement;
  walkthroughs: WalkthroughsMenu;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  // Read once when the menu opens, so every row's "2 days ago" agrees and render stays pure.
  const [now] = useState(() => Date.now());
  const [confirming, setConfirming] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const left = Math.max(
      MARGIN,
      Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - MARGIN),
    );
    setPlace({ top: r.bottom + 6, left });
  }, [anchor]);

  usePopoverLayer(panel, (e) => {
    if (e.key === 'Escape' && !confirming) {
      e.preventDefault();
      onClose();
      anchor.focus();
    }
  });
  useClickOutside(
    panel,
    (e) => {
      if (anchor.contains(e.target as Node)) return;
      onClose();
    },
    !confirming,
  );

  const { list, canRecord, loading: loadingId } = walkthroughs;

  return (
    <Portal>
      <div
        ref={panel}
        role="dialog"
        aria-label="Walkthroughs"
        data-walkthroughs-menu=""
        style={{ top: place?.top ?? -9999, left: place?.left ?? -9999, width: MENU_WIDTH }}
        className="fixed z-50 flex max-h-[min(32rem,calc(100vh-6rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
      >
        <div className="flex items-baseline justify-between border-b border-slate-100 px-4 pb-2.5 pt-3 dark:border-slate-800">
          <h2 className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">
            Walkthroughs
          </h2>
          {list.length > 0 ? (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {list.length} recorded
            </span>
          ) : null}
        </div>
        {list.length === 0 ? (
          <CompactEmptyState
            icon={<WalkthroughIcon size={16} />}
            title="No Walkthroughs Yet"
            description="Record yourself talking through this canvas. Anyone who can open it can play it back."
            className="py-6"
          />
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto py-1.5">
            {list.map((w) => (
              <WalkthroughRow
                key={w.id}
                walkthrough={w}
                now={now}
                loading={loadingId === w.id}
                deleting={deleting === w.id}
                onPlay={() => {
                  walkthroughs.play(w.id);
                  onClose();
                }}
                onDelete={(at) => setConfirming({ id: w.id, anchor: at })}
              />
            ))}
          </ul>
        )}
        {canRecord ? (
          <div className="border-t border-slate-100 p-2 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                walkthroughs.record();
                onClose();
              }}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-700 px-3 py-2 text-[13px] font-medium text-white transition hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
            >
              <RecordIcon size={12} className="text-rose-300" />
              Record Walkthrough
            </button>
          </div>
        ) : null}
      </div>
      {confirming ? (
        <ConfirmPopover
          anchor={confirming.anchor}
          message="Delete this walkthrough? It is deleted for everyone who can open this canvas."
          confirmLabel="Delete"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            const id = confirming.id;
            setConfirming(null);
            setDeleting(id);
            void walkthroughs.remove(id).finally(() => setDeleting(null));
          }}
        />
      ) : null}
    </Portal>
  );
}

function WalkthroughRow({
  walkthrough: w,
  now,
  loading,
  deleting,
  onPlay,
  onDelete,
}: {
  walkthrough: WalkthroughSummary;
  now: number;
  loading: boolean;
  deleting: boolean;
  onPlay: () => void;
  onDelete: (anchor: HTMLElement) => void;
}) {
  const by = w.mine ? 'You' : (w.author ?? 'Someone');
  return (
    <li className={`group flex items-center gap-1 px-1.5 ${deleting ? 'opacity-50' : ''}`}>
      <button
        type="button"
        onClick={onPlay}
        disabled={deleting}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 dark:hover:bg-slate-800"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-white dark:bg-brand-500/15 dark:text-brand-200">
          {loading ? <Spinner size={14} /> : <PlayIcon size={12} className="translate-x-px" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
            {w.title}
          </span>
          <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
            <span className="tabular-nums">{formatClock(w.durationMs)}</span>
            {' · '}
            {by}
            {' · '}
            {formatRelativeTime(now - w.createdAt)}
          </span>
        </span>
      </button>
      {w.canDelete ? (
        <HoverCard title="Delete Walkthrough">
          <button
            type="button"
            aria-label={`Delete ${w.title}`}
            disabled={deleting}
            onClick={(e) => onDelete(e.currentTarget)}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-rose-500/10 dark:hover:text-rose-300 [@media(hover:none)]:opacity-100"
          >
            <TrashIcon size={13} />
          </button>
        </HoverCard>
      ) : null}
    </li>
  );
}
