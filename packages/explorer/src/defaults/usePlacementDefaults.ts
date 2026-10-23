'use client';

// The page's one copy of the reader's default folders: loaded once per client (one bounded request, at most 200
// rows), and changed in place by every surface that sets or clears one, so the markers, the Use as Default for…
// dialog, the delete confirmation and Default Folders agree without asking again. Writes are optimistic and
// roll back, with a toast, when the index refuses.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IndexClient } from '@liveworkspace/index-client';
import { isAbort } from '../data/errors';

export type PlacementDefaultsStatus = 'loading' | 'ready' | 'failed';

export type PlacementDefaultsStore = {
  status: PlacementDefaultsStatus;
  // Key to folder id.
  defaults: ReadonlyMap<string, string>;
  // Resolves whether the change held.
  set: (key: string, folderId: string) => Promise<boolean>;
  clear: (key: string) => Promise<boolean>;
  // A folder is gone (the index drops its defaults with it): forget them here too.
  forgetFolder: (folderId: string) => void;
};

const EMPTY: ReadonlyMap<string, string> = new Map();

export function usePlacementDefaults(
  client: IndexClient,
  onError: (text: string) => void,
): PlacementDefaultsStore {
  const [status, setStatus] = useState<PlacementDefaultsStatus>('loading');
  const [defaults, setDefaults] = useState<ReadonlyMap<string, string>>(EMPTY);
  const latest = useRef(defaults);
  latest.current = defaults;

  useEffect(() => {
    let live = true;
    setStatus('loading');
    Promise.resolve()
      .then(() => client.listPlacementDefaults())
      .then(
        (res) => {
          if (!live) return;
          setDefaults(new Map(res.defaults.map((d) => [d.key, d.folderId])));
          setStatus('ready');
        },
        (e: unknown) => {
          if (!live || isAbort(e)) return;
          setStatus('failed');
        },
      );
    return () => {
      live = false;
    };
  }, [client]);

  const write = useCallback(
    async (key: string, folderId: string | null): Promise<boolean> => {
      const previous = latest.current.get(key) ?? null;
      if (previous === folderId) return true;
      const apply = (value: string | null) =>
        setDefaults((now) => {
          const next = new Map(now);
          if (value === null) next.delete(key);
          else next.set(key, value);
          return next;
        });
      apply(folderId);
      try {
        if (folderId) await client.setPlacementDefault(key, folderId);
        else await client.clearPlacementDefault(key);
        return true;
      } catch {
        apply(previous);
        onError('Couldn’t change your default folder. Try again.');
        return false;
      }
    },
    [client, onError],
  );
  const set = useCallback((key: string, folderId: string) => write(key, folderId), [write]);
  const clear = useCallback((key: string) => write(key, null), [write]);
  const forgetFolder = useCallback((folderId: string) => {
    setDefaults((now) => {
      if (![...now.values()].includes(folderId)) return now;
      return new Map([...now].filter(([, id]) => id !== folderId));
    });
  }, []);

  return useMemo(
    () => ({ status, defaults, set, clear, forgetFolder }),
    [status, defaults, set, clear, forgetFolder],
  );
}
