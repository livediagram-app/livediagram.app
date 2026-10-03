import { useSyncExternalStore } from 'react';

// False while React hydrates the static export's HTML (and on the server),
// true from the first client render after. A surface whose markup depends on
// device-only state (localStorage preferences) reads it only once this is
// true, so the render it hydrates matches the prerendered HTML.
const subscribe = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
