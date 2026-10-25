import { useMemo } from 'react';
import { useStableHandlers } from '@liveworkspace/workbench/hooks/ui/useStableHandlers';
import type { CollabApi } from './collab/CollabFaceRouter';

// Identity-stable per-element props for the element layer (docs/specs/008-canvas/canvas-performance.md):
// an element view re-renders only for its own changes, so what the layer builds per element must keep
// its identity across editor renders.

// One object per id, built on first ask and handed back after. The builder closes over stable
// handlers (useStableHandlers), so an entry never goes stale; a new cache is made only when the
// handlers' presence changes.
export function idBound<T>(make: (id: string) => T): (id: string) => T {
  const cache = new Map<string, T>();
  return (id) => {
    let hit = cache.get(id);
    if (hit === undefined) {
      hit = make(id);
      cache.set(id, hit);
    }
    return hit;
  };
}

// Every handler the collaboration faces call. Checked against CollabApi below, so a new handler on
// the API that is missing here fails the build rather than slipping past the wrappers.
const COLLAB_HANDLERS = [
  'respond',
  'clearResponses',
] as const satisfies readonly CollabHandlerKey[];

type CollabHandlerKey = {
  [K in keyof CollabApi]-?: NonNullable<CollabApi[K]> extends (...args: never[]) => unknown
    ? K
    : never;
}[keyof CollabApi];
type CollabHandlers = Pick<CollabApi, CollabHandlerKey>;
// Fails to compile when CollabApi gains a handler COLLAB_HANDLERS does not list.
const ALL_HANDLERS_LISTED: Exclude<CollabHandlerKey, (typeof COLLAB_HANDLERS)[number]> extends never
  ? true
  : never = true;
void ALL_HANDLERS_LISTED;

// The collab bag the editor mints per render, held while nothing a face shows changes: handlers
// through stable wrappers (presence kept), the rest by value.
export function useStableCollab(collab: CollabApi): CollabApi {
  const handlers = useStableHandlers(
    Object.fromEntries(COLLAB_HANDLERS.map((k) => [k, collab[k]])) as CollabHandlers,
  );
  const { selfKey } = collab;
  return useMemo(() => ({ ...handlers, selfKey }), [handlers, selfKey]);
}
