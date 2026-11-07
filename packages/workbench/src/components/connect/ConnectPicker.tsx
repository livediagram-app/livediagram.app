'use client';

// Connect liveworkspace File (liveworkspace/docs/specs/004-index/connected-tabs.md "Connecting", "How it looks"): the
// list a start screen shows in its content area. The role (Editor unless changed) and Add connection to both files
// above Find a file and the person's Recent across every app; one press on a row connects it. The app does the connect
// (`onConnect`, usually through connectFile) and moves to the new tab; this list holds the row busy meanwhile and, on a
// failure, says why on the row. Painted from the start panel's palette (`ink`), else the app's light or dark look.
import { useId, useMemo, useState, type CSSProperties } from 'react';
import type { IndexClient, Item, Level } from '@liveworkspace/index-client';
import { CompactEmptyState, SwitchRow, lucideGlyph, Button } from '@liveworkspace/ui';
import { lucideClock, lucideRefreshCw, lucideSearch, lucideX } from '@liveworkspace/icons/lucide';
import {
  bothWaysLine,
  connectErrorWords,
  connectRoleLine,
  rowBlock,
  titleMatches,
} from './connect-words';
import { ConnectRolePicker } from './ConnectRolePicker';
import { ConnectRow, type ConnectRowState } from './ConnectRow';
import { useRecentFiles } from './useRecentFiles';

const SearchGlyph = lucideGlyph(lucideSearch, 15);
const ClearGlyph = lucideGlyph(lucideX, 13);
const ClockGlyph = lucideGlyph(lucideClock, 20);
const RetryGlyph = lucideGlyph(lucideRefreshCw, 14);

// A start panel's palette, or any panel painted in its own colours.
export type ConnectInk = {
  text: string;
  muted: string;
  border: string;
  // The quiet fill under the logo tiles and the search.
  surface: string;
  // The role track and the Connected chip.
  column: string;
  // The panel's own paper: the chosen role's card.
  card: string;
  accent: string;
};

// The app's own look when no ink is handed in: slate on white, and its dark counterpart.
const DEFAULT_INK =
  '[--cp-text:#0f172a] [--cp-muted:#475569] [--cp-border:#e2e8f0] [--cp-surface:#f8fafc] [--cp-column:#f1f5f9] [--cp-card:#ffffff] [--cp-accent:var(--color-brand-700)] [--cp-on-accent:#ffffff] dark:[--cp-text:#e2e8f0] dark:[--cp-muted:#94a3b8] dark:[--cp-border:#334155] dark:[--cp-surface:#111827] dark:[--cp-column:#1e293b] dark:[--cp-card:#0f172a] dark:[--cp-accent:var(--color-brand-400)] dark:[--cp-on-accent:#0f172a]';

function inkStyle(ink: ConnectInk | undefined): CSSProperties {
  const base = {
    '--cp-hover': 'color-mix(in srgb, var(--cp-text) 6%, transparent)',
  } as CSSProperties;
  if (!ink) return base;
  return {
    ...base,
    '--cp-text': ink.text,
    '--cp-muted': ink.muted,
    '--cp-border': ink.border,
    '--cp-surface': ink.surface,
    '--cp-column': ink.column,
    '--cp-card': ink.card,
    '--cp-accent': ink.accent,
    // The plus on the accent: the paper, which the start palette keeps legible under its accent.
    '--cp-on-accent': ink.card,
  } as CSSProperties;
}

export type ConnectChoice = { level: Level; both: boolean };

export function ConnectPicker({
  client,
  hostId,
  hostKind,
  hostManaged,
  connected,
  ink,
  now,
  onConnect,
  onGoTo,
  onOpenExplorer,
}: {
  client: Pick<IndexClient, 'listItems'>;
  hostId: string;
  // The host's kind in words: "diagram", "plan".
  hostKind: string;
  // Whether the person may manage the host's links, which both ways needs.
  hostManaged: boolean;
  // The host's connected tabs: target item id to the tab holding it.
  connected: ReadonlyMap<string, string>;
  ink?: ConnectInk;
  // The instant "Opened 2 hours ago" is measured from.
  now: number;
  // Connect one file; throws to say it failed (an IndexError, or the tab add's error).
  onConnect: (item: Item, choice: ConnectChoice) => Promise<void>;
  // A row already connected: go to its tab.
  onGoTo: (tabId: string) => void;
  // Nothing recent: the way to the Explorer, where every file is.
  onOpenExplorer?: () => void;
}) {
  const files = useRecentFiles(client, hostId);
  const [level, setLevel] = useState<Level>('edit');
  const [both, setBoth] = useState(false);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ id: string; words: string } | null>(null);
  const roleLineId = useId();
  const bothLineId = useId();
  const items = files.state === 'ready' ? files.items : null;
  const shown = useMemo(
    () => (items ? items.filter((item) => titleMatches(item.title, query)) : []),
    [items, query],
  );

  const press = async (item: Item) => {
    const tabId = connected.get(item.id);
    if (tabId) {
      onGoTo(tabId);
      return;
    }
    // A busy or waiting row is inert (ConnectRow), so a second connect never starts while one runs.
    setFailure(null);
    setBusyId(item.id);
    try {
      await onConnect(item, { level, both: both && hostManaged });
    } catch (error) {
      setFailure({ id: item.id, words: connectErrorWords(error, hostKind) });
    } finally {
      setBusyId(null);
    }
  };

  const rowState = (item: Item): ConnectRowState => {
    if (connected.has(item.id)) return { kind: 'connected' };
    if (busyId === item.id) return { kind: 'busy' };
    const reason = rowBlock(item, level);
    if (reason) return { kind: 'blocked', reason };
    if (busyId) return { kind: 'waiting' };
    return { kind: 'open' };
  };

  return (
    <div
      data-connect-picker=""
      className={`flex flex-col text-[var(--cp-text)] ${ink ? '' : DEFAULT_INK}`}
      style={inkStyle(ink)}
    >
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cp-muted)]">
            Role
          </span>
          <ConnectRolePicker level={level} onChange={setLevel} describedBy={roleLineId} />
          <p id={roleLineId} className="text-[12px] leading-snug text-[var(--cp-muted)]">
            {connectRoleLine(level, hostKind)}
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cp-muted)]">
            Both Ways
          </span>
          <SwitchRow
            checked={both && hostManaged}
            onChange={setBoth}
            disabled={!hostManaged}
            aria-describedby={bothLineId}
            onColor="var(--cp-accent)"
            className="min-h-9 rounded-[10px] border border-[var(--cp-border)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--cp-hover)] disabled:hover:bg-transparent"
          >
            Add connection to both files
          </SwitchRow>
          <p id={bothLineId} className="text-[12px] leading-snug text-[var(--cp-muted)]">
            {bothWaysLine(hostKind, hostManaged)}
          </p>
        </div>
      </div>

      <label className="mt-4 flex h-9 items-center gap-2 rounded-xl border border-[var(--cp-border)] bg-[var(--cp-surface)] px-3 text-[var(--cp-muted)] focus-within:ring-2 focus-within:ring-[var(--cp-accent)]">
        <SearchGlyph />
        <input
          aria-label="Find a file"
          placeholder="Find a file"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && query) {
              e.stopPropagation();
              setQuery('');
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--cp-text)] outline-none placeholder:text-[var(--cp-muted)]"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery('')}
            className="flex size-5 cursor-pointer items-center justify-center rounded-full hover:bg-[var(--cp-hover)]"
          >
            <ClearGlyph />
          </button>
        ) : null}
      </label>

      <h3 className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--cp-muted)]">
        Recent
      </h3>
      {files.state === 'loading' ? (
        <ul aria-label="Loading recent files" aria-busy className="flex flex-col">
          {[0, 1, 2, 3, 4].map((n) => (
            <li key={n} className="flex items-center gap-3 px-2.5 py-2">
              <span className="size-9 shrink-0 animate-pulse rounded-[10px] bg-[var(--cp-column)] motion-reduce:animate-none" />
              <span className="flex flex-1 flex-col gap-1.5">
                <span
                  className="h-3 animate-pulse rounded bg-[var(--cp-column)] motion-reduce:animate-none"
                  style={{ width: `${62 - n * 7}%` }}
                />
                <span className="h-2.5 w-1/3 animate-pulse rounded bg-[var(--cp-column)] motion-reduce:animate-none" />
              </span>
            </li>
          ))}
        </ul>
      ) : files.state === 'failed' ? (
        <CompactEmptyState
          role="status"
          className="py-10"
          ink={{ text: 'var(--cp-text)', muted: 'var(--cp-muted)' }}
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
      ) : items && items.length === 0 ? (
        <CompactEmptyState
          className="py-10"
          ink={{ text: 'var(--cp-text)', muted: 'var(--cp-muted)' }}
          icon={<ClockGlyph />}
          title="No recent files yet"
          description="Files you open in any liveworkspace app show here."
          action={
            onOpenExplorer ? (
              <Button variant="secondary" size="sm" onClick={onOpenExplorer}>
                Open Explorer
              </Button>
            ) : undefined
          }
        />
      ) : shown.length === 0 ? (
        <CompactEmptyState
          role="status"
          className="py-10"
          ink={{ text: 'var(--cp-text)', muted: 'var(--cp-muted)' }}
          icon={<SearchGlyph />}
          title={`No recent file matches “${query.trim()}”`}
          description="Try another word."
        />
      ) : (
        <ul aria-label="Recent files" className="lvd-cascade -mx-2.5 flex flex-col">
          {shown.map((item) => (
            <ConnectRow
              key={item.id}
              item={item}
              state={rowState(item)}
              error={failure?.id === item.id ? failure.words : null}
              now={now}
              onPress={() => void press(item)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
