'use client';

// Connect's Check It Worked (docs/specs/030-knowledgebase/mcp-connect.md "The view" 4, blueprint "The checks"): the
// overview Insights reads, once on opening and then every CHECK_EVERY_MS while the browser tab shows, for
// CHECK_FOR_MS, until a connection arrives. At most 1 + 30 reads a window, none while hidden, none once connected.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KnowledgeAgent } from '@liveknowledge/api-schema';
import { apiKnowledgeOverview, type KnowledgeCaller } from '@/lib/api/knowledge';
import {
  CHECK_EVERY_MS,
  CHECK_FOR_MS,
  agentMarks,
  newConnection,
  type AgentMarks,
} from '@/lib/knowledge-connect/connect-status';

export type ConnectStatus =
  | { kind: 'loading' }
  | { kind: 'waiting' }
  | { kind: 'stopped' }
  | { kind: 'failed' }
  | { kind: 'connected'; agent: KnowledgeAgent };

export type ConnectCheck = {
  status: ConnectStatus;
  /** The connections of the last good read; null before one. */
  agents: readonly KnowledgeAgent[] | null;
  /** Read now and wait another CHECK_FOR_MS (Check Now, Check Again, Try Again). */
  checkNow: () => void;
};

const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

export function useConnectStatus(
  who: KnowledgeCaller,
  documentId: string,
  // False signed out or Offline: there is nothing to check.
  enabled: boolean,
): ConnectCheck {
  const [status, setStatus] = useState<ConnectStatus>({ kind: 'loading' });
  const [agents, setAgents] = useState<readonly KnowledgeAgent[] | null>(null);
  // Bumped by checkNow: each window is one run of the effect below.
  const [run, setRun] = useState(0);
  // The first good read's marks, kept across windows: an app that arrived while stopped is still new.
  const baseline = useRef<AgentMarks | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const until = Date.now() + CHECK_FOR_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: AbortController | null = null;
    let done = false;

    const finish = (next: ConnectStatus) => {
      done = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      setStatus(next);
    };
    const next = () => {
      clearTimeout(timer);
      if (Date.now() >= until) return finish({ kind: 'stopped' });
      timer = setTimeout(turn, Math.min(CHECK_EVERY_MS, until - Date.now()));
    };
    const read = () => {
      abort = new AbortController();
      const signal = abort.signal;
      apiKnowledgeOverview(who, documentId, signal)
        .then((overview) => {
          if (signal.aborted || done) return;
          setAgents(overview.agents);
          if (!baseline.current) baseline.current = agentMarks(overview.agents);
          const arrived = newConnection(baseline.current, overview.agents);
          if (arrived) return finish({ kind: 'connected', agent: arrived });
          setStatus({ kind: 'waiting' });
          next();
        })
        .catch(() => {
          if (!signal.aborted && !done) finish({ kind: 'failed' });
        });
    };
    // A hidden tab's turn is skipped, not queued: the next one comes CHECK_EVERY_MS later.
    function turn() {
      if (done) return;
      if (hidden()) next();
      else read();
    }
    // Back to the tab inside the window: read at once rather than at the next turn.
    function onVisible() {
      if (done || hidden() || Date.now() >= until) return;
      clearTimeout(timer);
      abort?.abort();
      read();
    }
    document.addEventListener('visibilitychange', onVisible);
    read();
    return () => {
      done = true;
      clearTimeout(timer);
      abort?.abort();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [who, documentId, enabled, run]);

  const checkNow = useCallback(() => {
    // Waiting at once, so the button's press shows; a read that fails says so.
    setStatus((held) => (held.kind === 'connected' ? held : { kind: 'waiting' }));
    setRun((n) => n + 1);
  }, []);
  return { status, agents, checkNow };
}
