// This browser's own Explorer choices, where the host does not control them: Home's hero hidden, and the
// This App / Every App filter, each kept per app in localStorage (a convenience only).

import { useCallback, useEffect, useState } from 'react';
import type { App } from '@liveworkspace/index-client';
import type { AppFilter } from '../words';

const FILTER_KEY = (app: App) => `liveworkspace:explorer-filter:${app}`;
const HERO_KEY = (app: App) => `liveworkspace:explorer-hero-hidden:${app}`;

/** Whether Home's hero is hidden: the host's setting, or this browser's own choice. */
export function useHeroHidden(app: App, controlled?: boolean, onHide?: () => void) {
  const [own, setOwn] = useState(false);
  useEffect(() => {
    if (controlled !== undefined) return;
    try {
      setOwn(localStorage.getItem(HERO_KEY(app)) === '1');
    } catch {
      // No storage: the hero shows.
    }
  }, [app, controlled]);
  const hide = useCallback(() => {
    if (controlled === undefined) {
      setOwn(true);
      try {
        localStorage.setItem(HERO_KEY(app), '1');
      } catch {
        // A convenience only.
      }
    }
    onHide?.();
  }, [app, controlled, onHide]);
  return [controlled ?? own, hide] as const;
}

export function useFilter(app: App, controlled?: AppFilter, onChange?: (f: AppFilter) => void) {
  const [own, setOwn] = useState<AppFilter>('app');
  useEffect(() => {
    if (controlled) return;
    try {
      const saved = localStorage.getItem(FILTER_KEY(app));
      if (saved === 'all' || saved === 'app') setOwn(saved);
    } catch {
      // No storage: this app's items.
    }
  }, [app, controlled]);
  const set = useCallback(
    (next: AppFilter) => {
      if (!controlled) {
        setOwn(next);
        try {
          localStorage.setItem(FILTER_KEY(app), next);
        } catch {
          // A convenience only.
        }
      }
      onChange?.(next);
    },
    [app, controlled, onChange],
  );
  return [controlled ?? own, set] as const;
}
