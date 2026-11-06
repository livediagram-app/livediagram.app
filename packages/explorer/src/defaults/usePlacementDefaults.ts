'use client';

// The page's one copy of the reader's default folders: loaded once per client (one bounded request, at most 200
// rows), and changed in place by every surface that sets or clears one, so the markers, the Use as Default for…
// dialog, the delete confirmation and Default Folders agree without asking again. Writes are optimistic and
// roll back, with a toast, when the index refuses. A key an app retired reads as the app's own while that holds none,
// and clearing the app's entry clears its retired keys too (foldRetiredDefaults, RETIRED_PLACEMENT_KEYS).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IndexClient } from '@liveworkspace/index-client';
import { isAbort } from '../data/errors';
import { placementDefaultTelemetry, type OrganiseTelemetry } from '../types';
import { foldRetiredDefaults, isApp, retiredKeysClearedWith } from '@liveworkspace/index-client';

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
  // Folder·Changed / Cleared, once the index took the change, for the entry's app.
  onOrganise?: OrganiseTelemetry,
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
          setDefaults(foldRetiredDefaults(res.defaults));
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
      const before = latest.current;
      const previous = before.get(key) ?? null;
      if (previous === folderId) return true;
      // Clearing an app's entry clears the retired keys it reads, else one would answer for it again.
      const retired = folderId ? [] : retiredKeysClearedWith(key).filter((k) => before.has(k));
      setDefaults((now) => {
        const next = new Map(now);
        if (folderId === null) next.delete(key);
        else next.set(key, folderId);
        for (const k of retired) next.delete(k);
        return next;
      });
      try {
        if (folderId) await client.setPlacementDefault(key, folderId);
        else await Promise.all([key, ...retired].map((k) => client.clearPlacementDefault(k)));
        const app = key.split(':')[0];
        onOrganise?.(
          folderId ? 'Folder·Changed' : 'Folder·Cleared',
          placementDefaultTelemetry(key),
          isApp(app) ? app : undefined,
        );
        return true;
      } catch {
        setDefaults((now) => {
          const next = new Map(now);
          for (const k of [key, ...retired]) {
            const id = before.get(k);
            if (id === undefined) next.delete(k);
            else next.set(k, id);
          }
          return next;
        });
        onError('Couldn’t change your default folder. Try again.');
        return false;
      }
    },
    [client, onError, onOrganise],
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
