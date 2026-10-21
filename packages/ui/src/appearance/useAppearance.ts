'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  applyAppearance,
  getAppearanceSetting,
  getResolvedAppearance,
  getServerAppearance,
  getServerAppearanceSetting,
  setAppearance,
  subscribeAppearance,
  type Appearance,
  type AppearanceSetting,
} from './appearance-store';
import { nextAppearanceSetting } from './appearance-cycle';

// Appearance, the reader's light / dark chrome for every app on the origin
// (docs/specs/004-interface-design/appearance.md). The value, its storage, the OS
// watch and the DOM class live in appearance-store, which has no React in it; this
// is the subscription and the cycle.
//
// Two values come back, because the pick and the paint differ: `setting` is what
// the reader chose (including System) and is what a control renders, `appearance`
// is what the page is painted as and is what a colour decision reads. Both come
// from one module-level store, so every subscriber re-renders on a change.
//
// `onSet` lets a host observe an explicit pick (the editor tracks it; the public
// sites, which report page views only, pass nothing).
export function useAppearance(onSet?: (next: AppearanceSetting) => void): {
  setting: AppearanceSetting;
  appearance: Appearance;
  set: (next: AppearanceSetting) => void;
  cycle: () => void;
} {
  const setting = useSyncExternalStore(
    subscribeAppearance,
    getAppearanceSetting,
    getServerAppearanceSetting,
  );
  const appearance = useSyncExternalStore(
    subscribeAppearance,
    getResolvedAppearance,
    getServerAppearance,
  );

  // Reconcile the DOM class with the stored value once on mount. The pre-paint
  // script normally handles this, but embeds and tests that render without the
  // root layout still get the right chrome.
  useEffect(() => {
    applyAppearance(getResolvedAppearance());
  }, []);

  const set = (next: AppearanceSetting) => {
    setAppearance(next);
    onSet?.(next);
  };

  return {
    setting,
    appearance,
    set,
    cycle: () => set(nextAppearanceSetting(getAppearanceSetting())),
  };
}
