'use client';

// A project kit's run on the page (liveworkspace/docs/specs/010-site/site.md "Start a Project"): the setup, one run
// at a time, its Retry with what was made, and Remove What Was Made. The index does the work in one request each.
import { useCallback, useRef, useState } from 'react';
import type { IndexClient, KitId, KitRun, Level } from '@liveworkspace/index-client';
import { refusalWords } from './kit-words';

export type KitPhase =
  | { kind: 'setup' }
  | { kind: 'running'; run: KitRun | null }
  | { kind: 'finished'; run: KitRun }
  | { kind: 'confirming'; run: KitRun }
  | { kind: 'removing'; run: KitRun };

export type KitRunState = {
  phase: KitPhase;
  // Why the last request was refused, in words, shown where it was asked from.
  error: string | null;
  start: (input: { kit: KitId; level: Level; name: string }) => void;
  retry: () => void;
  askRemove: () => void;
  cancelRemove: () => void;
  remove: () => void;
  reset: () => void;
};

const madeOf = (run: KitRun) =>
  Object.fromEntries(run.parts.flatMap((p) => (p.itemId ? [[p.slot, p.itemId]] : [])));

export function useKitRun(client: Pick<IndexClient, 'startKit' | 'removeKit'>): KitRunState {
  const [phase, setPhase] = useState<KitPhase>({ kind: 'setup' });
  const [error, setError] = useState<string | null>(null);
  // The run's kit, role and name, for Retry.
  const asked = useRef<{ kit: KitId; level: Level; name: string } | null>(null);

  const send = useCallback(
    async (previous: KitRun | null) => {
      const input = asked.current!;
      setError(null);
      setPhase({ kind: 'running', run: previous });
      try {
        const run = await client.startKit(
          previous ? { ...input, folderId: previous.folderId, made: madeOf(previous) } : input,
        );
        setPhase({ kind: 'finished', run });
      } catch (e) {
        setError(refusalWords(e, 'create'));
        setPhase(previous ? { kind: 'finished', run: previous } : { kind: 'setup' });
      }
    },
    [client],
  );

  const start = useCallback(
    (input: { kit: KitId; level: Level; name: string }) => {
      asked.current = input;
      void send(null);
    },
    [send],
  );

  const retry = useCallback(() => {
    if (phase.kind === 'finished') void send(phase.run);
  }, [phase, send]);

  const askRemove = useCallback(() => {
    if (phase.kind === 'finished') setPhase({ kind: 'confirming', run: phase.run });
  }, [phase]);

  const cancelRemove = useCallback(() => {
    if (phase.kind === 'confirming') setPhase({ kind: 'finished', run: phase.run });
  }, [phase]);

  const remove = useCallback(async () => {
    if (phase.kind !== 'confirming') return;
    const { run } = phase;
    setError(null);
    setPhase({ kind: 'removing', run });
    try {
      await client.removeKit({ folderId: run.folderId, made: madeOf(run) });
      setPhase({ kind: 'setup' });
    } catch (e) {
      setError(refusalWords(e, 'remove'));
      setPhase({ kind: 'finished', run });
    }
  }, [client, phase]);

  const reset = useCallback(() => {
    setError(null);
    setPhase({ kind: 'setup' });
  }, []);

  return {
    phase,
    error,
    start,
    retry,
    askRemove,
    cancelRemove,
    remove: () => void remove(),
    reset,
  };
}
