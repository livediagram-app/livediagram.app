'use client';

// One item's walkthroughs, as their row in Tools, the recorder and the player share them
// (each canvas app's docs/specs/012-collaboration/walkthroughs.md "In Tools"): the list (fetched when the item opens
// and after every save and delete), whether the caller may record, and the recorder, the hiding and the player.

import {
  WALKTHROUGH_MAX_MS,
  type WalkthroughLimits,
  type WalkthroughSummary,
} from '@liveworkspace/media/walkthrough';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { walkthroughApi } from './api';
import type { WalkthroughHost } from './host';
import { stoppedAtLimit } from './limit-state';
import { useTierReread } from './tier-reread';
import { walkthroughTelemetry } from './telemetry';
import { useHidden } from './useHidden';
import { usePlayer } from './usePlayer';
import { useRecorder } from './useRecorder';
import { requestToolsView } from '@liveworkspace/workbench/components/chrome/tools-door';

export type Walkthroughs = ReturnType<typeof useWalkthroughs>;

/** What the Tools row and its panel need: one value that changes only with the list. */
export type WalkthroughsMenu = {
  available: boolean;
  list: readonly WalkthroughSummary[];
  canRecord: boolean;
  // The walkthrough being fetched to play, for its row's spinner.
  loading: string | null;
  record: () => void;
  play: (id: string) => void;
  remove: (id: string) => Promise<boolean>;
  rename: (id: string, title: string) => Promise<boolean>;
  // Its public link on or off: the walkthrough as it now is, or null when it couldn't be.
  share: (id: string, on: boolean) => Promise<WalkthroughSummary | null>;
  // With Pro on: what this person may record here, as the server answered it. Null with Pro off.
  limits: WalkthroughLimits | null;
  // The walkthrough just saved that ran to its length limit, until the next recording or a dismissal.
  limitStop: string | null;
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
  const [limits, setLimits] = useState<WalkthroughLimits | null>(null);
  const [limitStop, setLimitStop] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!api) return;
    const listed = await api.list();
    setList(listed?.walkthroughs ?? null);
    setCanRecord(listed?.canRecord ?? false);
    setLimits(listed?.limits ?? null);
  }, [api]);
  // An upgrade (or a lapse) in another tab reaches the list while the item stays open.
  useTierReread(limits, refresh);
  // The longest this person may record here: the server's answer with Pro on, else what a walkthrough always was.
  const maxMs = limits?.maxMs ?? WALKTHROUGH_MAX_MS;

  // Asked once the editor is idle after the item opens, so the list never competes with the canvas's own first load.
  useEffect(() => {
    setList(null);
    setCanRecord(false);
    setLimits(null);
    setLimitStop(null);
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
  // Filming the tab (the count and the recording): what is hidden goes from the screen, so the video never holds it.
  const [filming, setFilming] = useState(false);
  // What can be hidden besides canvas elements, and whether the tab showing has anything (host.ts).
  const hiding = useHidden(
    canvasRoot,
    recorderOpen,
    host.hideable?.marks,
    host.hideable ? host.hideable.canHide() : true,
    host.elements,
    filming,
  );
  const onSaved = useCallback(
    (saved: WalkthroughSummary) => {
      setList((prev) => [saved, ...(prev ?? []).filter((w) => w.id !== saved.id)]);
      setNotice(`Saved “${saved.title}”.`);
      // With the server's limit (Pro on), a recording that ran to it says so in the list (limit-notices.tsx).
      setLimitStop(limits && stoppedAtLimit(saved.durationMs, limits.maxMs) ? saved.id : null);
      hiding.clear();
      void refresh();
      // Back in the Walkthroughs list inside Tools, the new one at its top (walkthroughs.md "In Tools").
      requestToolsView('walkthroughs');
    },
    [refresh, hiding, limits],
  );
  const recorder = useRecorder(host, api, hiding.hidden, onSaved, maxMs);
  const player = usePlayer(host, api);

  const recording = recorder.phase.kind;
  useEffect(() => {
    setRecorderOpen(
      recording === 'setup' || recording === 'countdown' || recording === 'recording',
    );
    setFilming(recording === 'countdown' || recording === 'recording');
  }, [recording]);

  const remove = useCallback(
    async (id: string) => {
      if (!api) return false;
      const done = await api.remove(id);
      if (done) {
        walkthroughTelemetry.deleted();
        setList((prev) => prev?.filter((w) => w.id !== id) ?? null);
        // With the server's limits, how many are stored is the server's count: read again, so Record comes back.
        if (limits) void refresh();
      }
      return done;
    },
    [api, limits, refresh],
  );

  // The list's row as the service now has it.
  const replace = useCallback((next: WalkthroughSummary) => {
    setList((prev) => prev?.map((w) => (w.id === next.id ? next : w)) ?? null);
  }, []);
  const rename = useCallback(
    async (id: string, title: string) => {
      const next = api ? await api.rename(id, title) : null;
      if (next) replace(next);
      return next !== null;
    },
    [api, replace],
  );
  const share = useCallback(
    async (id: string, on: boolean) => {
      const next = api ? await api.share(id, on) : null;
      if (next) replace(next);
      return next;
    },
    [api, replace],
  );

  // The panel reads these through the latest recorder and player, so the menu's value holds still while a recording
  // ticks (the Tools row is published again only when the list does).
  const latest = useRef({ player, recorder });
  useEffect(() => {
    latest.current = { player, recorder };
  });
  const record = useCallback(() => {
    latest.current.player.close();
    setNotice(null);
    setLimitStop(null);
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
    () => ({
      available,
      list: list ?? NONE,
      canRecord,
      loading,
      record,
      play,
      remove,
      rename,
      share,
      limits,
      limitStop,
    }),
    [available, list, canRecord, loading, record, play, remove, rename, share, limits, limitStop],
  );

  return {
    menu,
    available,
    list: list ?? NONE,
    canRecord,
    limits,
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
