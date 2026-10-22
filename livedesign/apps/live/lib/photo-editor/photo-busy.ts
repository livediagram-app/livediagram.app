// The photo's slow commands at work (docs/specs/031-photo/photo-pages.md "Working on a photo page"): Subject, Remove
// Background and Content-Aware Fill can take a few seconds, so each names itself in a small pill over the page while
// it runs (PhotoBusyPill), gone when its result lands. Several at once show the latest.
import { useSyncExternalStore } from 'react';

let running: { id: number; label: string }[] = [];
let next = 0;
const listeners = new Set<() => void>();
const changed = () => {
  for (const fn of listeners) fn();
};

export const photoBusy = {
  /** What is running now, the latest last; empty when nothing is. */
  get: (): readonly { id: number; label: string }[] => running,
  subscribe: (fn: () => void): (() => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /** `work` named `label` while it runs; its result passed on as it was. */
  run<T>(label: string, work: Promise<T>): Promise<T> {
    const id = ++next;
    running = [...running, { id, label }];
    changed();
    const done = () => {
      running = running.filter((r) => r.id !== id);
      changed();
    };
    return work.then(
      (v) => {
        done();
        return v;
      },
      (e: unknown) => {
        done();
        throw e;
      },
    );
  },
};

/** The label of the latest command at work, or null. */
export function usePhotoBusy(): string | null {
  const list = useSyncExternalStore(photoBusy.subscribe, photoBusy.get, () => running);
  return list.at(-1)?.label ?? null;
}
