import { useEffect } from 'react';
import { workbench } from '../../bindings';
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
    const event = workbench.openSettingsEvent;
    window.addEventListener(event, onRequest);
    return () => window.removeEventListener(event, onRequest);
  }, [latest]);
}
