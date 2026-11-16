'use client';

// One item's walkthroughs, as the header button, the recorder and the player share them
// (liveworkspace/docs/specs/006-media/walkthroughs.md "The Walkthroughs menu"): the list (fetched when the item opens
// and after every save and delete), whether the caller may record, and the recorder, the hiding and the player.

import type { WalkthroughSummary } from '@liveworkspace/media/walkthrough';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { walkthroughApi } from './api';
import type { WalkthroughHost } from './host';
import { useHidden } from './useHidden';
import { usePlayer } from './usePlayer';
import { useRecorder } from './useRecorder';

export type Walkthroughs = ReturnType<typeof useWalkthroughs>;

export function useWalkthroughs(host: WalkthroughHost) {
  const { itemId, api: deps, canvasRoot } = host;
  const api = useMemo(() => (itemId ? walkthroughApi(deps, itemId) : null), [deps, itemId]);
  const [list, setList] = useState<WalkthroughSummary[] | null>(null);
  const [canRecord, setCanRecord] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!api) return;
    const listed = await api.list();
    setList(listed?.walkthroughs ?? null);
    setCanRecord(listed?.canRecord ?? false);
  }, [api]);

  useEffect(() => {
    setList(null);
    setCanRecord(false);
    void refresh();
  }, [refresh]);

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

  const record = useCallback(() => {
    player.close();
    setNotice(null);
    recorder.open();
  }, [player, recorder]);

  const play = useCallback(
    (id: string) => {
      if (recorder.phase.kind !== 'off') return;
      setNotice(null);
      void player.open(id);
    },
    [player, recorder.phase.kind],
  );

  const discard = useCallback(() => {
    recorder.close();
    hiding.clear();
  }, [recorder, hiding]);

  return {
    available: api !== null && list !== null && (list.length > 0 || canRecord),
    list: list ?? [],
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
