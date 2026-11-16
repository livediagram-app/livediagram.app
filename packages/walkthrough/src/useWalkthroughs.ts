'use client';

// One item's walkthroughs, as the header button, the recorder and the player share them
// (liveworkspace/docs/specs/006-media/walkthroughs.md "The Walkthroughs menu"): the list (fetched when the item opens
// and after every save and delete), whether the caller may record, and the recorder, the hiding and the player.

import type { WalkthroughSummary } from '@liveworkspace/media/walkthrough';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { walkthroughApi } from './api';
import type { WalkthroughHost } from './host';
import { useHidden } from './useHidden';
import { usePlayer } from './usePlayer';
import { useRecorder } from './useRecorder';

export type Walkthroughs = ReturnType<typeof useWalkthroughs>;

/** What the header's button needs: one value that changes only with the list. */
export type WalkthroughsMenu = {
  available: boolean;
  list: readonly WalkthroughSummary[];
  canRecord: boolean;
  // The walkthrough being fetched to play, for its row's spinner.
  loading: string | null;
  record: () => void;
  play: (id: string) => void;
  remove: (id: string) => Promise<boolean>;
};

const NONE: readonly WalkthroughSummary[] = [];

// The latest the list waits for the editor to be idle, and the wait where the browser can't say.
const LIST_IDLE_MAX_MS = 3000;
const LIST_DELAY_MS = 300;

export function useWalkthroughs(host: WalkthroughHost) {
  const { itemId, api: deps, canvasRoot } = host;
  const api = useMemo(() => (itemId ? walkthroughApi(deps, itemId) : null), [deps, itemId]);
  const [list, setList] = useState<readonly WalkthroughSummary[] | null>(null);
  const [canRecord, setCanRecord] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!api) return;
    const listed = await api.list();
    setList(listed?.walkthroughs ?? null);
    setCanRecord(listed?.canRecord ?? false);
  }, [api]);

  // Asked once the editor is idle after the item opens, so the list never competes with the canvas's own first load.
  useEffect(() => {
    setList(null);
    setCanRecord(false);
    if (!api) return;
    const idle = globalThis.requestIdleCallback;
    if (idle) {
      const handle = idle(() => void refresh(), { timeout: LIST_IDLE_MAX_MS });
      return () => cancelIdleCallback(handle);
    }
    const timer = setTimeout(() => void refresh(), LIST_DELAY_MS);
    return () => clearTimeout(timer);
  }, [api, refresh]);

  const [recorderOpen, setRecorderOpen] = useState(false);
  const hiding = useHidden(canvasRoot, recorderOpen);
  const onSaved = useCallback(
    (saved: WalkthroughSummary) => {
      setList((prev) => [saved, ...(prev ?? []).filter((w) => w.id !== saved.id)]);
      setNotice(`Saved “${saved.title}”.`);
      hiding.clear();
      void refresh();
    },
    [refresh, hiding],
  );
  const recorder = useRecorder(host, api, hiding.hidden, onSaved);
  const player = usePlayer(host, api);

  const recording = recorder.phase.kind;
  useEffect(() => {
    setRecorderOpen(
      recording === 'setup' || recording === 'countdown' || recording === 'recording',
    );
  }, [recording]);

  const remove = useCallback(
    async (id: string) => {
      if (!api) return false;
      const done = await api.remove(id);
      if (done) setList((prev) => prev?.filter((w) => w.id !== id) ?? null);
      return done;
    },
    [api],
  );

  // The header's menu reads these through the latest recorder and player, so the menu's value holds still while a
  // recording ticks (an editor's memoised header renders again only when the list does).
  const latest = useRef({ player, recorder });
  useEffect(() => {
    latest.current = { player, recorder };
  });
  const record = useCallback(() => {
    latest.current.player.close();
    setNotice(null);
    latest.current.recorder.open();
  }, []);

  const play = useCallback((id: string) => {
    if (latest.current.recorder.phase.kind !== 'off') return;
    setNotice(null);
    void latest.current.player.open(id);
  }, []);

  const discard = useCallback(() => {
    recorder.close();
    hiding.clear();
  }, [recorder, hiding]);

  const available = api !== null && list !== null && (list.length > 0 || canRecord);
  const loading = player.phase.kind === 'loading' ? player.phase.id : null;
  const menu = useMemo<WalkthroughsMenu>(
    () => ({ available, list: list ?? NONE, canRecord, loading, record, play, remove }),
    [available, list, canRecord, loading, record, play, remove],
  );

  return {
    menu,
    available,
    list: list ?? NONE,
    canRecord,
    notice,
    dismissNotice: () => setNotice(null),
    busy: recorder.phase.kind !== 'off',
    record,
    play,
    remove,
    discard,
    recorder,
    hiding,
    player,
    host,
  };
}
