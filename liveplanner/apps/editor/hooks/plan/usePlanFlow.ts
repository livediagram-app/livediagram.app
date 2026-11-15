'use client';

// A flow chart's read of its range (docs/specs/026-plan/plan-views.md "Flow charts"), through the shared store
// (plan-flow-store.ts): its state, and Try Again. Outside a plan (an export, a share view without cards) there is
// nothing to read: 'none'.

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { ItemsScope } from '@/lib/api/items';
import { flowKey, flowStore, type FlowState, type FlowStore } from './plan-flow-store';

export type PlanFlow = (FlowState | { status: 'none'; data: null }) & { retry: () => void };

const NONE = { status: 'none', data: null } as const;
const noop = () => {};
const noSubscribe = () => noop;

export function usePlanFlow(
  scope: ItemsScope | null | undefined,
  days: number,
  version: unknown,
  store: FlowStore = flowStore,
): PlanFlow {
  const key = scope ? flowKey(scope, days) : null;
  const subscribe = useCallback(
    (fn: () => void) => (key ? store.subscribe(key, fn) : noSubscribe()),
    [key, store],
  );
  const state = useSyncExternalStore(
    subscribe,
    () => (key ? store.get(key) : NONE),
    () => NONE,
  );
  useEffect(() => {
    if (key && scope) store.want(key, scope, days, version);
  }, [key, scope, days, version, store]);
  const retry = useCallback(() => {
    if (key && scope) store.retry(key, scope, days);
  }, [key, scope, days, store]);
  return { ...state, retry };
}
