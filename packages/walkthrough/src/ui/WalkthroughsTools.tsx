'use client';

// Walkthroughs in the footer's Tools (each canvas app's docs/specs/012-collaboration/walkthroughs.md "In Tools";
// liveworkspace/docs/specs/004-index/footer-tools-menu.md): one row under Collaborate, published through the Tools
// door, with the count of recorded walkthroughs at its end. Pressing it opens the Walkthroughs list inside Tools, under
// its back bar (footer-tools-menu.md "Opening a tool inside Tools"): the item's walkthroughs to play, each with its
// delete where the caller may, and Record Walkthrough for an Editor; playing or recording closes Tools. No row where
// walkthroughs don't fit (a phone, an embed, Offline, a tab-scoped link) or where there is nothing to play or
// record.

import {
  ConfirmPopover,
  CountBadge,
  ResponsivePopover,
  ToolFooter,
  ToolFooterButton,
} from '@liveworkspace/ui';
import { primeAudio } from '@liveworkspace/capture/level';
import { ToolExplainer } from '@liveworkspace/ui/tool-explainer';
import { walkthroughsArt } from '@liveworkspace/ui/tool-explainer-art';
import type { ChromeToolsItem } from '@liveworkspace/workbench/components/chrome/ChromeToolsMenu';
import {
  usePublishToolsItems,
  useToolGate,
} from '@liveworkspace/workbench/components/chrome/tools-door';
import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { storedFull } from '../limit-state';
import { WalkthroughRow } from './WalkthroughRow';
import type { Walkthroughs, WalkthroughsMenu } from '../useWalkthroughs';
import { RecordIcon, WalkthroughIcon } from './icons';

// The latest menu, for the view inside Tools: the row is memoised on its count (so a recording's ticks never republish
// it), and the view reads the rest from here as it changes.
type Latest<T> = { get: () => T; subscribe: (l: () => void) => () => void };
function useLatest<T>(value: T): Latest<T> {
  const [store] = useState(() => {
    let current = value;
    const listeners = new Set<() => void>();
    return {
      get: () => current,
      subscribe: (l: () => void) => {
        listeners.add(l);
        return () => {
          listeners.delete(l);
        };
      },
      set: (next: T) => {
        current = next;
        for (const l of listeners) l();
      },
    };
  });
  useEffect(() => {
    store.set(value);
  }, [store, value]);
  return store;
}

// A tier's limit notices (Pro on only), loaded when one first shows: the list is in the editor's first load, and
// the kit's notice is not.
const StoredLimitNotice = lazy(() =>
  import('./limit-notices').then((m) => ({ default: m.StoredLimitNotice })),
);
const LengthNote = lazy(() => import('./limit-notices').then((m) => ({ default: m.LengthNote })));
const LengthLimitNotice = lazy(() =>
  import('./limit-notices').then((m) => ({ default: m.LengthLimitNotice })),
);
/** What the panel calls the open item and how a viewer moves round it: a canvas by default, a knowledgebase's pages
 *  on liveknowledge (sweep 2026-11-21: its panel said "this canvas"). */
export type WalkthroughWords = { item: string; moving: string };
const CANVAS_WORDS: WalkthroughWords = { item: 'canvas', moving: 'move around the canvas' };

// Record a Walkthrough's set-up, loaded when it first shows.
const RecordSetup = lazy(() => import('./RecordSetup'));

function WalkthroughsView({
  latest,
  onClose,
  words,
}: {
  latest: Latest<Walkthroughs>;
  onClose: () => void;
  words: WalkthroughWords;
}) {
  const walkthroughs = useSyncExternalStore(latest.subscribe, latest.get, latest.get);
  const setup = walkthroughs.recorder.phase.kind === 'setup';
  // Picking what to hide: the set-up gives way to the picking bar (RecordDock), and Tools steps aside (`stepAside`).
  const picking = walkthroughs.hiding.picking;
  // Leaving Tools mid set-up lets the microphone and camera go; Start Recording does not.
  const started = useRef(false);
  useEffect(
    () => () => {
      const now = latest.get();
      if (!started.current && now.recorder.phase.kind === 'setup') now.discard();
    },
    [latest],
  );
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const titleId = useId();
  // Tools closes once the tab is shared and the count begins: a refused share keeps the set-up open to say so.
  const counting = walkthroughs.recorder.phase.kind === 'countdown';
  useEffect(() => {
    if (!counting || anchor === null) return;
    started.current = true;
    onClose();
  }, [counting, anchor, onClose]);
  return (
    <>
      <WalkthroughsPanel
        walkthroughs={walkthroughs.menu}
        bare
        words={words}
        onClose={onClose}
        onRecord={(at) => {
          // Inside the press: Brave starts the level meter's audio only from one.
          primeAudio();
          setAnchor(at);
          walkthroughs.menu.record();
        }}
      />
      {/* The set-up opens beside Tools (a drawer on a phone), as Add Connection does (owner, 2026-11-17). A press outside
          closes it. While picking what to hide it gives way to the picking bar, the devices staying open (they live in
          the recorder), and comes back on Done. */}
      <ResponsivePopover
        open={setup && anchor !== null && !picking}
        onClose={walkthroughs.discard}
        anchor={anchor}
        titleId={titleId}
        width={400}
        placement="side"
        bare
      >
        <Suspense fallback={<div aria-busy className="min-h-64" />}>
          <RecordSetup walkthroughs={walkthroughs} titleId={titleId} onStarted={() => undefined} />
        </Suspense>
      </ResponsivePopover>
    </>
  );
}

export function WalkthroughsTools({
  walkthroughs,
  words = CANVAS_WORDS,
}: {
  walkthroughs: Walkthroughs;
  words?: WalkthroughWords;
}) {
  const latest = useLatest(walkthroughs);
  const menu = walkthroughs.menu;
  const { available, canRecord } = menu;
  const count = menu.list.length;
  const picking = walkthroughs.hiding.picking;
  // Signed out, or the item kept Offline (owner, 2026-11-17): still there, badged as History is ("Sign In",
  // "Sync Canvas"), and a press opens the same gate.
  const gate = useToolGate();
  const rows = useMemo<ChromeToolsItem[]>(
    () =>
      available
        ? [
            {
              id: 'walkthroughs',
              group: 'collaborate',
              label: 'Walkthroughs',
              description: canRecord
                ? 'Record yourself talking through it.'
                : 'Play a recorded talk-through.',
              icon: <WalkthroughIcon size={16} />,
              aside:
                count > 0 ? (
                  <CountBadge
                    tone="brand"
                    count={count}
                    label={count === 1 ? '1 walkthrough' : `${count} walkthroughs`}
                  />
                ) : undefined,
              onSelect: () => {},
              // Closes on a press outside like any tool (owner, 2026-11-17: only Slide Deck stays open), except while
              // Hide From Recording picks things on the canvas: then it stays open but steps out of sight, so it never
              // covers what is being picked (a Dashboard tab's right-hand slots, Work Tracker 1287).
              keepOpen: picking,
              stepAside: picking,
              view: ({ close }) => (
                <WalkthroughsView latest={latest} onClose={close} words={words} />
              ),
            },
          ]
        : gate
          ? [
              {
                id: 'walkthroughs',
                group: 'collaborate',
                label: 'Walkthroughs',
                description: 'Record yourself talking through it.',
                icon: <WalkthroughIcon size={16} />,
                inPlace: true,
                badges: gate.badges,
                onSelect: () => gate.open('walkthroughs'),
              },
            ]
          : [],
    [available, canRecord, count, latest, gate, picking, words],
  );
  usePublishToolsItems('walkthroughs', rows);
  return null;
}

// The list's body: its heading (none inside Tools, `bare`, whose back bar names it), the list (or the empty state) and
// Record Walkthrough at its foot. Escape and a press outside are the popover's; the delete's confirm is a popover of
// its own above it, so a press in it never closes this.
export function WalkthroughsPanel({
  walkthroughs,
  sheet = false,
  bare = false,
  onClose,
  onRecord,
  words = CANVAS_WORDS,
}: {
  walkthroughs: WalkthroughsMenu;
  words?: WalkthroughWords;
  sheet?: boolean;
  bare?: boolean;
  onClose: () => void;
  // Inside Tools: Record Walkthrough opens its set-up beside it, from this button.
  onRecord?: (anchor: HTMLElement) => void;
}) {
  // Read once when the panel opens, so every row's "2 days ago" agrees and render stays pure.
  const [now] = useState(() => Date.now());
  const [confirming, setConfirming] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { list, canRecord, loading: loadingId, limits, limitStop } = walkthroughs;
  // With Pro on: the person keeps as many as they may, so the notice stands where Record Walkthrough would.
  const full = storedFull(limits);

  return (
    <div
      data-walkthroughs-menu=""
      className={`flex min-h-0 flex-col ${sheet || bare ? '' : 'max-h-[min(32rem,calc(100vh-6rem))]'} ${
        bare ? 'flex-1 border-t border-slate-100 dark:border-slate-800' : ''
      }`}
    >
      {bare ? null : (
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
      )}
      {limits && limitStop ? (
        <div className="px-3 pt-3">
          <Suspense fallback={null}>
            <LengthLimitNotice
              limits={limits}
              onWatch={() => {
                walkthroughs.play(limitStop);
                onClose();
              }}
            />
          </Suspense>
        </div>
      ) : null}
      {list.length === 0 ? (
        // The tool's explainer (footer-tools-menu.md "Explainers"): nothing recorded yet.
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 pt-4">
          <ToolExplainer
            art={walkthroughsArt}
            title="No walkthroughs yet"
            description={`Record a video of this ${words.item} while you talk it through. Anyone who can open it can watch, or share it by a link.`}
            steps={[
              'Press Record Walkthrough, then share this tab when your browser asks.',
              `Talk it through as you ${words.moving}.`,
              'Finish, and the video is saved here, ready to share.',
            ]}
            data="walkthroughs"
          />
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1.5">
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
              onRename={(title) => walkthroughs.rename(w.id, title)}
              onShare={(on) => walkthroughs.share(w.id, on)}
            />
          ))}
        </ul>
      )}
      {canRecord && limits && !full && !limitStop ? (
        <div data-walkthroughs-length="">
          <Suspense fallback={null}>
            <LengthNote limits={limits} />
          </Suspense>
        </div>
      ) : null}
      {canRecord && full && limits ? (
        <div
          data-walkthroughs-full=""
          className="border-t border-slate-100 p-3 dark:border-slate-800"
        >
          <Suspense fallback={null}>
            <StoredLimitNotice limits={limits} />
          </Suspense>
        </div>
      ) : canRecord ? (
        // Pinned at the bottom: the list scrolls above it (owner, 2026-11-17).
        <ToolFooter>
          <ToolFooterButton
            onClick={(e) => {
              if (onRecord) onRecord(e.currentTarget);
              else {
                primeAudio();
                walkthroughs.record();
                onClose();
              }
            }}
          >
            <RecordIcon size={12} className="text-rose-300" />
            Record Walkthrough
          </ToolFooterButton>
        </ToolFooter>
      ) : null}
      {confirming ? (
        <ConfirmPopover
          anchor={confirming.anchor}
          message={`Delete this walkthrough? It is deleted for everyone who can open this ${words.item}.`}
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
    </div>
  );
}
