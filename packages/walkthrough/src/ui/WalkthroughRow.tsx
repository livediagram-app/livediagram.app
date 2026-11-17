'use client';

// One walkthrough in the list (liveworkspace/docs/specs/006-media/walkthroughs.md "Each walkthrough's menu"): press it
// to play; its ⋯ menu renames it in place, shares a screen recording by a public link, and deletes it.

import type { WalkthroughSummary } from '@liveworkspace/media/walkthrough';
import { WALKTHROUGH_TITLE_MAX } from '@liveworkspace/media/walkthrough';
import {
  LinkIcon,
  PencilIcon,
  PublicLinkPopover,
  Spinner,
  TextInput,
  TrashIcon,
  formatRelativeTime,
} from '@liveworkspace/ui';
import { EllipsisTriggerButton } from '@liveworkspace/workbench/components/primitives/EllipsisTriggerButton';
import {
  MenuActionRow,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { useRowMenu } from '@liveworkspace/workbench/components/primitives/useRowMenu';
import { useRef, useState } from 'react';
import { formatClock } from '../timeline';
import { PlayIcon } from './icons';
import { SHARE_DESCRIPTION, SHARE_TITLE, walkthroughShareUrl } from './share-link';

export function WalkthroughRow({
  walkthrough: w,
  now,
  loading,
  deleting,
  onPlay,
  onDelete,
  onRename,
  onShare,
}: {
  walkthrough: WalkthroughSummary;
  now: number;
  loading: boolean;
  deleting: boolean;
  onPlay: () => void;
  onDelete: (anchor: HTMLElement) => void;
  onRename: (title: string) => Promise<boolean>;
  onShare: (on: boolean) => Promise<WalkthroughSummary | null>;
}) {
  const by = w.mine ? 'You' : (w.author ?? 'Someone');
  const menu = useRowMenu({ disabled: !w.canDelete });
  const rowRef = useRef<HTMLLIElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [sharing, setSharing] = useState(false);
  const run = (fn: () => void) => () => {
    menu.close();
    fn();
  };
  return (
    <li
      ref={rowRef}
      onContextMenu={menu.onContextMenu}
      className={`px-1.5 ${deleting ? 'opacity-50' : ''}`}
    >
      {/* One item: the ⋯ sits inside its hover box, at its end, never beside it (owner, 2026-11-17). */}
      <div
        className={`group flex items-center rounded-lg transition ${
          renaming
            ? ''
            : 'hover:bg-slate-50 has-[[aria-expanded=true]]:bg-slate-50 dark:hover:bg-slate-800 dark:has-[[aria-expanded=true]]:bg-slate-800'
        }`}
      >
        {renaming ? (
          <RenameField title={w.title} onDone={() => setRenaming(false)} onRename={onRename} />
        ) : (
          <button
            type="button"
            onClick={onPlay}
            disabled={deleting}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-white dark:bg-brand-500/15 dark:text-brand-200">
              {loading ? <Spinner size={14} /> : <PlayIcon size={12} className="translate-x-px" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
                  {w.title}
                </span>
                {w.shareCode ? (
                  <LinkIcon
                    size={11}
                    aria-label="Public link on"
                    className="shrink-0 text-brand-600 dark:text-brand-300"
                  />
                ) : null}
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
        )}
        {w.canDelete && !renaming ? (
          <EllipsisTriggerButton
            {...menu.triggerProps}
            label={`Menu for ${w.title}`}
            size="lg"
            reveal
            className="mr-1.5 !h-7 !w-7 rounded-md hover:!bg-slate-200/70 dark:hover:!bg-slate-700 [@media(hover:none)]:opacity-100"
          />
        ) : null}
      </div>
      {menu.open ? (
        <PortalMenu
          anchor={menu.triggerRef.current}
          onClose={menu.close}
          label={`Actions for ${w.title}`}
        >
          <MenuActionRow
            plain
            label="Rename"
            icon={<PencilIcon size={14} />}
            onClick={run(() => setRenaming(true))}
          />
          {w.screen ? (
            <MenuActionRow
              plain
              label="Share"
              icon={<LinkIcon size={14} />}
              onClick={run(() => setSharing(true))}
            />
          ) : null}
          <MenuActionRow
            plain
            label="Delete"
            icon={<TrashIcon size={14} />}
            onClick={run(() => rowRef.current && onDelete(rowRef.current))}
          />
        </PortalMenu>
      ) : null}
      <PublicLinkPopover
        open={sharing}
        anchor={rowRef.current}
        url={w.shareCode ? walkthroughShareUrl(w.shareCode) : null}
        title={SHARE_TITLE}
        description={SHARE_DESCRIPTION}
        onShare={async (on) => (await onShare(on)) !== null}
        onClose={() => setSharing(false)}
      />
    </li>
  );
}

function RenameField({
  title,
  onRename,
  onDone,
}: {
  title: string;
  onRename: (title: string) => Promise<boolean>;
  onDone: () => void;
}) {
  const [value, setValue] = useState(title);
  const [saving, setSaving] = useState(false);
  const done = useRef(false);
  const commit = () => {
    if (done.current) return;
    done.current = true;
    const next = value.trim();
    // Blank or unchanged keeps the old name.
    if (!next || next === title) return onDone();
    setSaving(true);
    void onRename(next).finally(onDone);
  };
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1.5">
      <TextInput
        aria-label="Walkthrough name"
        value={value}
        maxLength={WALKTHROUGH_TITLE_MAX}
        disabled={saving}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            // Escape cancels here, and goes no further (Tools would step back).
            e.preventDefault();
            e.nativeEvent.stopImmediatePropagation();
            done.current = true;
            onDone();
          }
        }}
        className="min-w-0 flex-1"
      />
      {saving ? <Spinner size={14} /> : null}
    </div>
  );
}
