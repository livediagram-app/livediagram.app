'use client';

// What a step's target offers its pickers (blueprint cross-app.md "Picking the target"): a plan's boards and their
// columns, a knowledgebase's pages, a Space's tabs, a document's templates, read once per item through the index as
// the person (IndexClient.automationTarget) and kept for the screen's life, so moving between steps reads nothing
// again. The cache holds the last few items only. An item gone or out of reach reads as failed, and Try Again reads
// it afresh.
import { useCallback, useEffect, useState } from 'react';
import type { AutomationTargetDescription, IndexClient } from '@liveworkspace/index-client';

// Enough for every target a rule's five steps may name, twice over.
export const TARGET_CACHE_MAX = 10;

export type CrossTarget =
  | { state: 'none' }
  | { state: 'loading' }
  | { state: 'ready'; target: AutomationTargetDescription }
  | { state: 'failed' };

const cache = new Map<string, Promise<AutomationTargetDescription>>();

/** The item's description, read once: the cache keeps the newest TARGET_CACHE_MAX, a failed read never. */
export function readTarget(
  client: Pick<IndexClient, 'automationTarget'>,
  itemId: string,
): Promise<AutomationTargetDescription> {
  const kept = cache.get(itemId);
  if (kept) return kept;
  const read = client.automationTarget(itemId);
  cache.set(itemId, read);
  if (cache.size > TARGET_CACHE_MAX) cache.delete(cache.keys().next().value!);
  read.catch(() => {
    if (cache.get(itemId) === read) cache.delete(itemId);
  });
  return read;
}

export const forgetTargets = (): void => cache.clear();

export function useCrossTarget(
  client: Pick<IndexClient, 'automationTarget'>,
  itemId: string,
): CrossTarget & { retry: () => void } {
  const [answer, setAnswer] = useState<{ key: string; target: CrossTarget } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${itemId}\n${attempt}`;
  useEffect(() => {
    if (!itemId) return;
    let live = true;
    readTarget(client, itemId).then(
      (target) => {
        if (live) setAnswer({ key, target: { state: 'ready', target } });
      },
      () => {
        if (live) setAnswer({ key, target: { state: 'failed' } });
      },
    );
    return () => {
      live = false;
    };
  }, [client, itemId, key]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const target: CrossTarget = !itemId
    ? { state: 'none' }
    : answer?.key === key
      ? answer.target
      : { state: 'loading' };
  return { ...target, retry };
}
