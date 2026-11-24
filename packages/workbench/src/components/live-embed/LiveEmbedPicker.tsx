'use client';

// Embed File (liveworkspace/docs/specs/004-index/live-embeds.md "Making one", Work Tracker 1375): the role, as the
// Connect list asks it, where this session may connect; then a pasted share link, this file's connected files and the
// person's Recent across the apps, the host left out. One press chooses: a file the person may share and the host is
// not yet connected to is connected first, one way at the role (the embed's tab); then the row holds busy while the
// snapshot is drawn, and the dialog closes with the choice. The embed itself is read-only whatever the role. The rows
// are the Connect list's (ConnectRow), in its ink.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  linkLevelOffered,
  type ConnectionMade,
  type IndexClient,
  type Item,
  type Level,
} from '@liveworkspace/index-client';
import { isLiveEmbedApp } from '@liveworkspace/element-model/live-item';
import { Button, CompactEmptyState, lucideGlyph } from '@liveworkspace/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { liveEmbedPickerHeroArt } from '@liveworkspace/ui/dialog-hero-art/live-embed-picker';
import {
  lucideClock,
  lucideLink,
  lucideRefreshCw,
  lucideSearch,
} from '@liveworkspace/icons/lucide';
import { Dialog } from '../dialogs/Dialog';
import { workbench } from '../../bindings';
import { indexClient } from '../../lib/index-client';
import { CONNECT_DEFAULT_INK, inkStyle } from '../connect/ConnectPicker';
import { ConnectRolePicker } from '../connect/ConnectRolePicker';
import { ConnectRow, type ConnectRowState } from '../connect/ConnectRow';
import { connectFile } from '../connect/connect-file';
import { connectErrorWords, managesItem, titleMatches } from '../connect/connect-words';
import { useRecentFiles } from '../connect/useRecentFiles';
import { liveEmbedRoleLine, liveEmbedWords } from './live-embed-words';
import {
  choiceOf,
  liveEmbedBlock,
  resolvePastedLink,
  type LiveEmbedChoice,
} from './choose-live-embed';

const LinkGlyph = lucideGlyph(lucideLink, 15);
const SearchGlyph = lucideGlyph(lucideSearch, 15);
const ClockGlyph = lucideGlyph(lucideClock, 20);
const RetryGlyph = lucideGlyph(lucideRefreshCw, 14);

// How many connected files are looked up by id (a host holds at most 50 connected tabs; the first few are shown).
export const LIVE_PICKER_CONNECTED_MAX = 8;

/** Where this session may connect (Connect File's entry shows): what Embed File needs to add the embed's tab. Each host
 *  builds it from its Connect host; absent, the role is not asked and every file is embedded with no tab. */
export type LiveEmbedConnect = {
  // The host's kind in words: "canvas", "plan".
  hostKind: string;
  // The host's connected tabs: target item id to the tab holding it.
  connected: ReadonlyMap<string, string>;
  // The host's grant at `edit` (X-Index-Grant), null when the index refused or could not be reached.
  grant: () => Promise<string | null>;
  newTabId: () => string;
  // The editor's whole-tab save of the new connected tab at the end of the bar, the open tab left as it is. Throws
  // when it fails, and the connection is taken back.
  addTab: (made: ConnectionMade, tabId: string) => Promise<void>;
  client?: Pick<IndexClient, 'makeConnection' | 'takeBackConnection'>;
};

/** Whether Embed File connects `item` before embedding it: the person may share it, the host is not connected to it
 *  yet, and its app offers the role. */
export function embedConnects(
  item: Pick<Item, 'id' | 'app' | 'access' | 'sharedVia'>,
  connect: Pick<LiveEmbedConnect, 'connected'> | undefined,
  level: Level,
): boolean {
  return (
    !!connect &&
    !connect.connected.has(item.id) &&
    managesItem(item) &&
    linkLevelOffered(item.app, level)
  );
}

const appearanceNow = (): 'light' | 'dark' =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

export function LiveEmbedPicker({
  client,
  hostId,
  connectedIds,
  connect,
  now: nowGiven,
  onChoose,
  onClose,
}: {
  client: Pick<IndexClient, 'listItems' | 'getItem' | 'resolveShare'>;
  hostId: string;
  // The item ids this file's connected tabs stand for (connectedTargets), first in the list.
  connectedIds: readonly string[];
  // Where this session may connect: the role, and the embed's tab for a file the person may share.
  connect?: LiveEmbedConnect | undefined;
  // The instant "Opened 2 hours ago" is measured from: when the picker opened, unless given.
  now?: number;
  onChoose: (choice: LiveEmbedChoice) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const [openedAt] = useState(() => Date.now());
  const now = nowGiven ?? openedAt;
  const files = useRecentFiles(client, hostId);
  const connected = useConnectedItems(client, connectedIds);
  const [query, setQuery] = useState('');
  const [paste, setPaste] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ id: string; words: string } | null>(null);
  const [level, setLevel] = useState<Level>('edit');
  const roleLineId = useId();

  const recent = useMemo(() => {
    if (files.state !== 'ready') return [];
    const shown = new Set(connected.map((item) => item.id));
    return files.items.filter(
      (item) => isLiveEmbedApp(item.app) && !shown.has(item.id) && titleMatches(item.title, query),
    );
  }, [files, connected, query]);
  // Only files a live embed can show are listed: a huddle's would sit there unpickable.
  const connectedShown = connected.filter(
    (item) => isLiveEmbedApp(item.app) && titleMatches(item.title, query),
  );

  // The embed's tab, made first: a failure stops here, in the Connect list's words, and nothing is embedded.
  const connectFirst = async (item: Item, to: LiveEmbedConnect) => {
    const grant = await to.grant();
    // connectErrorWords' network line: the grant is the index's, so a missing one is the index out of reach.
    if (!grant) throw new Error('no grant');
    const tabId = to.newTabId();
    await connectFile({
      client: to.client ?? indexClient,
      hostId,
      grant,
      tabId,
      targetId: item.id,
      level,
      both: false,
      addTab: (made) => to.addTab(made, tabId),
    });
    workbench.track('Tab', 'Added', 'Connected');
    workbench.track('Tab', 'Added', 'EmbedConnected');
  };

  const choose = async (item: Item) => {
    setFailure(null);
    setBusyId(item.id);
    try {
      if (connect && embedConnects(item, connect, level)) {
        try {
          await connectFirst(item, connect);
        } catch (error) {
          setFailure({ id: item.id, words: connectErrorWords(error, connect.hostKind) });
          return;
        }
      }
      onChoose(await choiceOf(item, appearanceNow()));
      onClose();
    } catch {
      setFailure({ id: item.id, words: 'That file could not be added. Try again.' });
    } finally {
      setBusyId(null);
    }
  };

  const submitPaste = async () => {
    if (!paste.trim() || busyId) return;
    setPasteError(null);
    setBusyId('paste');
    const resolved = await resolvePastedLink(paste, client);
    setBusyId(null);
    if (!resolved.ok) {
      setPasteError(resolved.words);
      return;
    }
    // The code is gone with the field: only the file's id goes on.
    setPaste('');
    const blocked = liveEmbedBlock(resolved.item, hostId);
    if (blocked) {
      setPasteError(blocked);
      return;
    }
    await choose(resolved.item);
  };

  const rowState = (item: Item): ConnectRowState => {
    if (busyId === item.id) return { kind: 'busy' };
    const reason = liveEmbedBlock(item, hostId);
    if (reason) return { kind: 'blocked', reason };
    if (busyId) return { kind: 'waiting' };
    return { kind: 'open' };
  };

  const rows = (items: Item[], label: string) => (
    <ul aria-label={label} className="lvd-cascade -mx-2.5 flex flex-col">
      {items.map((item) => (
        <ConnectRow
          key={item.id}
          item={item}
          state={rowState(item)}
          error={failure?.id === item.id ? failure.words : null}
          now={now}
          busyLabel="Adding"
          // Where a tab could be made, a file that gets none says so before it is pressed.
          note={
            connect && !connect.connected.has(item.id) && !embedConnects(item, connect, level)
              ? liveEmbedWords.noTab
              : undefined
          }
          onPress={() => void choose(item)}
        />
      ))}
    </ul>
  );

  return (
    <Dialog open onClose={onClose} titleId={titleId} size="lg" className="max-h-[90vh]">
      <HeroDialogHeader
        art={liveEmbedPickerHeroArt}
        titleId={titleId}
        title={liveEmbedWords.title}
        subtitle={liveEmbedWords.subtitle}
        onClose={onClose}
      />
      <div
        data-live-embed-picker=""
        className={`flex flex-1 flex-col overflow-y-auto px-6 pb-6 pt-4 text-[var(--cp-text)] ${CONNECT_DEFAULT_INK}`}
        style={inkStyle(undefined)}
      >
        {connect ? (
          <div data-live-embed-role="" className="mb-5 flex min-w-0 flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cp-muted)]">
              Role
            </span>
            <ConnectRolePicker level={level} onChange={setLevel} describedBy={roleLineId} />
            {/* What the role means, read out with the control as the Connect list's is (connected-tabs.md). */}
            <p id={roleLineId} className="sr-only">
              {liveEmbedRoleLine(level, connect.hostKind)}
            </p>
          </div>
        ) : null}
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void submitPaste();
          }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cp-muted)]">
            Paste a Share Link
          </span>
          <div className="flex gap-2">
            <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--cp-border)] bg-[var(--cp-surface)] px-3 text-[var(--cp-muted)] focus-within:ring-2 focus-within:ring-[var(--cp-accent)]">
              <LinkGlyph />
              <input
                aria-label="Share link"
                aria-invalid={pasteError ? true : undefined}
                aria-describedby={pasteError ? 'live-embed-paste-error' : undefined}
                placeholder="https://www.liveplanner.app/project/shared?s=…"
                value={paste}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => {
                  setPaste(e.target.value);
                  setPasteError(null);
                }}
                className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--cp-text)] outline-none placeholder:text-[var(--cp-muted)]"
              />
            </label>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!paste.trim() || busyId !== null}
              aria-busy={busyId === 'paste' || undefined}
            >
              {busyId === 'paste' ? 'Checking' : 'Add'}
            </Button>
          </div>
          {pasteError ? (
            <p
              id="live-embed-paste-error"
              role="status"
              className="text-[12px] font-medium text-rose-700 dark:text-rose-300"
            >
              {pasteError}
            </p>
          ) : null}
        </form>

        <label className="mt-5 flex h-9 items-center gap-2 rounded-xl border border-[var(--cp-border)] bg-[var(--cp-surface)] px-3 text-[var(--cp-muted)] focus-within:ring-2 focus-within:ring-[var(--cp-accent)]">
          <SearchGlyph />
          <input
            aria-label="Find a file"
            placeholder="Find a file"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--cp-text)] outline-none placeholder:text-[var(--cp-muted)]"
          />
        </label>

        {connectedShown.length > 0 ? (
          <>
            <h3 className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--cp-muted)]">
              Connected
            </h3>
            {rows(connectedShown, 'Connected files')}
          </>
        ) : null}

        <h3 className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--cp-muted)]">
          Recent
        </h3>
        {files.state === 'loading' ? (
          <p
            aria-busy
            role="status"
            className="py-6 text-center text-[12px] text-[var(--cp-muted)]"
          >
            Loading your recent files
          </p>
        ) : files.state === 'failed' ? (
          <CompactEmptyState
            role="status"
            className="py-8"
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
        ) : recent.length === 0 ? (
          <CompactEmptyState
            className="py-8"
            ink={{ text: 'var(--cp-text)', muted: 'var(--cp-muted)' }}
            icon={query ? <SearchGlyph /> : <ClockGlyph />}
            title={query ? `No recent file matches “${query.trim()}”` : 'No recent files yet'}
            description={
              query ? 'Try another word.' : 'Files you open in any of our apps show here.'
            }
          />
        ) : (
          rows(recent, 'Recent files')
        )}
      </div>
    </Dialog>
  );
}

// The connected files, each read by id (the first LIVE_PICKER_CONNECTED_MAX), in the order given; any that cannot be
// read are left out.
function useConnectedItems(client: Pick<IndexClient, 'getItem'>, ids: readonly string[]): Item[] {
  const key = ids.slice(0, LIVE_PICKER_CONNECTED_MAX).join('\n');
  const [found, setFound] = useState<{ key: string; items: Item[] } | null>(null);
  // Read when it asks, so a caller that builds a client per render does not ask again.
  const clientRef = useRef(client);
  useLayoutEffect(() => {
    clientRef.current = client;
  });
  useEffect(() => {
    if (!key) return;
    let live = true;
    void Promise.all(
      key.split('\n').map((id) =>
        clientRef.current.getItem(id).then(
          (read) => read.item,
          () => null,
        ),
      ),
    ).then((items) => {
      if (live) setFound({ key, items: items.filter((item): item is Item => item !== null) });
    });
    return () => {
      live = false;
    };
  }, [key]);
  return found?.key === key ? found.items : [];
}
