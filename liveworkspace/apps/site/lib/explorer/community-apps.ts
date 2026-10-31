'use client';

// Whether each app's Community is on, for the Explorer's Share dialog (liveworkspace/docs/specs/007-community/
// community.md "The Share dialog's Community tab"): asked of an app's own `GET /api/capabilities` the first time one
// of its items is shared here, never before, so a page load costs nothing and only the apps whose items are shared
// are asked (once each, shared with every other asker on the page, @liveworkspace/community-ui fetchCommunityEnabled).
// Until an app answers its Community is assumed on, as everywhere else.

import { useCallback, useRef, useState } from 'react';
import { fetchCommunityEnabled } from '@liveworkspace/community-ui';
import type { AppName } from '@liveworkspace/sites';
import { appOrigin } from './page-app';

/** `(app) => on` for the apps in `apps` while `ask` holds; false for any other app, and for every app without `ask`. */
export function useCommunityAppsOn(
  apps: readonly AppName[],
  ask: boolean,
  fetchEnabled: (apiBase: string) => Promise<boolean> = fetchCommunityEnabled,
): (app: AppName) => boolean {
  const [off, setOff] = useState<ReadonlySet<AppName>>(() => new Set());
  const asked = useRef(new Set<AppName>());
  return useCallback(
    (app: AppName) => {
      if (!ask || !apps.includes(app)) return false;
      if (!asked.current.has(app)) {
        asked.current.add(app);
        void fetchEnabled(`${appOrigin(app)}/api`).then((on) => {
          if (!on) setOff((prev) => new Set(prev).add(app));
        });
      }
      return !off.has(app);
    },
    [apps, ask, off, fetchEnabled],
  );
}
