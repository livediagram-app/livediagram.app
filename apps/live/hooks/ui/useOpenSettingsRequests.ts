import { useEffect } from 'react';
import { OPEN_SETTINGS_EVENT } from '@/lib/open-settings';
import { useLatest } from './useLatest';

// The host side of `requestOpenSettings` (lib/open-settings.ts): whichever
// surface owns the Settings dialog (the Explorer, the editor) calls `open`
// with the category each request names.
export function useOpenSettingsRequests(open: (categoryId: string) => void) {
  const latest = useLatest(open);
  useEffect(() => {
    const onRequest = (e: Event) => {
      const categoryId = (e as CustomEvent<unknown>).detail;
      if (typeof categoryId === 'string' && categoryId) latest.current(categoryId);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, onRequest);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onRequest);
  }, [latest]);
}
