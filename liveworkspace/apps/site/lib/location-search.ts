import { useSyncExternalStore } from 'react';

// The page's query string, as an external store: the pages are a static export, so the server
// render reads none, and the browser reads the real one. The account pages never change it.
const noChange = () => () => {};

export function useLocationSearch(): string {
  return useSyncExternalStore(
    noChange,
    () => window.location.search,
    () => '',
  );
}
