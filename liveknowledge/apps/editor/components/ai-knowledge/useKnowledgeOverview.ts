'use client';

// AI Knowledge's data (docs/specs/030-knowledgebase/ai-knowledge.md): `GET knowledge`, one request each time the
// view opens and one after each action here; nothing is polled. An action's request is `run`: it is one at a time
// by its id, a refusal is said in words above the sections, and the overview is read again when it has landed.
import { MOST_READ_PERIODS } from '@liveknowledge/api-schema';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KnowledgeOverviewResponse } from '@liveknowledge/api-schema';
import { apiKnowledgeOverview, type KnowledgeCaller } from '@/lib/api/knowledge';

export type OverviewState =
  | { status: 'loading' }
  | { status: 'ready'; overview: KnowledgeOverviewResponse }
  | { status: 'failed' };

export type KnowledgeOverview = {
  state: OverviewState;
  /** The ids of the actions running now (a conflict's, a question's key, a page's). */
  busy: ReadonlySet<string>;
  /** The last refusal, in words; cleared when the next action starts. */
  failure: string | null;
  refresh: () => void;
  /** With Pro on, the period Most Read covers, and a change of it (read again). */
  period: number;
  setPeriod: (days: number) => void;
  /** Run one action under `id`, then read the overview again. Resolves true when it landed. */
  run: (
    id: string,
    action: () => Promise<unknown>,
    failureText: (err: unknown) => string,
  ) => Promise<boolean>;
};

const LOADING: OverviewState = { status: 'loading' };

export function useKnowledgeOverview(
  who: KnowledgeCaller,
  documentId: string,
  // False for a knowledgebase kept Offline: there is no room to ask.
  enabled: boolean,
): KnowledgeOverview {
  const [state, setState] = useState<OverviewState>(LOADING);
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const [failure, setFailure] = useState<string | null>(null);
  const [turn, setTurn] = useState(0);
  const [period, setPeriod] = useState<number>(MOST_READ_PERIODS[0]);
  const running = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    apiKnowledgeOverview(who, documentId, abort.signal, period)
      .then((overview) => {
        if (!abort.signal.aborted) setState({ status: 'ready', overview });
      })
      .catch(() => {
        // What is on show stays when a re-read fails; a first read that fails says so.
        if (!abort.signal.aborted)
          setState((held) => (held.status === 'ready' ? held : { status: 'failed' }));
      });
    return () => abort.abort();
  }, [who, documentId, turn, enabled, period]);

  const refresh = useCallback(() => setTurn((n) => n + 1), []);
  const run = useCallback<KnowledgeOverview['run']>(
    async (id, action, failureText) => {
      if (running.current.has(id)) return false;
      running.current.add(id);
      setBusy(new Set(running.current));
      setFailure(null);
      try {
        await action();
        refresh();
        return true;
      } catch (err) {
        setFailure(failureText(err));
        return false;
      } finally {
        running.current.delete(id);
        setBusy(new Set(running.current));
      }
    },
    [refresh],
  );
  return { state, busy, failure, refresh, period, setPeriod, run };
}
