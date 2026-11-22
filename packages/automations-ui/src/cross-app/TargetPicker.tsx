'use client';

// Where a step in another app acts (liveworkspace/docs/specs/018-automations/automations.md "Steps in other apps";
// blueprint cross-app.md "Picking the target"): the person's Recent in the apps the step reaches, as the Connect list
// draws them (ConnectRow). Only an item they can edit may be picked: one they can only view stays in the list, locked
// and saying so, so nobody wonders where it went. The item the rule lives in is left out.
import { useMemo, useState } from 'react';
import type { App, IndexClient, Item } from '@liveworkspace/index-client';
import {
  Button,
  CompactEmptyState,
  Dialog,
  DialogHeader,
  PANEL_INK,
  lucideGlyph,
} from '@liveworkspace/ui';
import { lucideClock, lucideRefreshCw, lucideSearch } from '@liveworkspace/icons/lucide';
import {
  ConnectRow,
  type ConnectRowState,
} from '@liveworkspace/workbench/components/connect/ConnectRow';
import { useRecentFiles } from '@liveworkspace/workbench/components/connect/useRecentFiles';

const SearchGlyph = lucideGlyph(lucideSearch, 15);
const ClockGlyph = lucideGlyph(lucideClock, 20);
const RetryGlyph = lucideGlyph(lucideRefreshCw, 14);

export const VIEW_ONLY = 'View Only';
export const VIEW_ONLY_REASON = 'You can open it, but not edit it';

/** A row's state: only an item the person edits may be picked. */
export const targetRowState = (item: Pick<Item, 'access'>): ConnectRowState =>
  item.access === 'edit'
    ? { kind: 'open' }
    : { kind: 'blocked', reason: VIEW_ONLY_REASON, lock: VIEW_ONLY };

/** The items a step may name: those of its apps, the one the rule lives in left out, matching the words typed. */
export function targetItems(items: readonly Item[], apps: readonly App[], query: string): Item[] {
  const q = query.trim().toLocaleLowerCase();
  return items.filter(
    (i) => apps.includes(i.app) && (!q || i.title.toLocaleLowerCase().includes(q)),
  );
}

export function TargetPicker({
  client,
  hostId,
  apps,
  noun,
  now,
  onPick,
  onClose,
}: {
  client: Pick<IndexClient, 'listItems'>;
  // The item the rule lives in, never its own target.
  hostId: string;
  apps: readonly App[];
  // What is being picked: "plan", "knowledgebase".
  noun: string;
  now: number;
  onPick: (item: Item) => void;
  onClose: () => void;
}) {
  const files = useRecentFiles(client, hostId);
  const [query, setQuery] = useState('');
  const shown = useMemo(
    () => (files.state === 'ready' ? targetItems(files.items, apps, query) : []),
    [files, apps, query],
  );
  return (
    <Dialog open onClose={onClose} ariaLabel={`Pick a ${noun}`} size="lg" phoneSheet>
      <DialogHeader
        title={`Pick a ${noun.charAt(0).toUpperCase()}${noun.slice(1)}`}
        subtitle="The step acts as you, so only what you can edit can be picked."
      />
      <div data-target-picker="" className={`flex flex-col gap-3 px-5 pb-5 ${PANEL_INK}`}>
        <label className="flex h-9 items-center gap-2 rounded-xl border border-[var(--cp-border)] bg-[var(--cp-surface)] px-3 text-[var(--cp-muted)] focus-within:ring-2 focus-within:ring-[var(--cp-accent)]">
          <SearchGlyph />
          <input
            aria-label={`Find a ${noun}`}
            placeholder={`Find a ${noun}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--cp-text)] outline-none placeholder:text-[var(--cp-muted)]"
          />
        </label>
        {files.state === 'loading' ? (
          <p
            role="status"
            aria-busy
            className="py-8 text-center text-[13px] text-[var(--cp-muted)]"
          >
            Loading your recent files
          </p>
        ) : files.state === 'failed' ? (
          <CompactEmptyState
            role="status"
            className="py-8"
            icon={<ClockGlyph />}
            title="Your recent files did not load"
            description="Check your connection and try again."
            action={
              <Button variant="secondary" size="sm" onClick={files.retry}>
                <RetryGlyph />
                Try Again
              </Button>
            }
          />
        ) : shown.length === 0 ? (
          <CompactEmptyState
            role="status"
            className="py-8"
            icon={<SearchGlyph />}
            title={query.trim() ? `No ${noun} matches “${query.trim()}”` : `No recent ${noun} yet`}
            description={
              query.trim() ? 'Try another word.' : `Open the ${noun} once, and it shows here.`
            }
          />
        ) : (
          <ul
            aria-label={`Recent ${noun}s`}
            className="-mx-2.5 flex max-h-[24rem] flex-col overflow-y-auto"
          >
            {shown.map((item) => (
              <ConnectRow
                key={item.id}
                item={item}
                state={targetRowState(item)}
                error={null}
                now={now}
                onPress={() => onPick(item)}
              />
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
