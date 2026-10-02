import { useSyncExternalStore } from 'react';

// PROTOTYPING SELECTOR: remove once the operator picks a mode switch variant.
// `?modeSwitch=a|b|c|d` chooses which of the four candidate controls the tab
// bar shows (A segmented pill, B icon toggle, C dropdown chip, D sliding
// switch); anything else shows A.
export type ModeSwitchVariant = 'a' | 'b' | 'c' | 'd';

const VARIANTS: readonly ModeSwitchVariant[] = ['a', 'b', 'c', 'd'];
const DEFAULT_VARIANT: ModeSwitchVariant = 'a';

export function parseModeSwitchVariant(search: string): ModeSwitchVariant {
  const value = new URLSearchParams(search).get('modeSwitch')?.toLowerCase();
  return VARIANTS.find((variant) => variant === value) ?? DEFAULT_VARIANT;
}

const noSubscription = () => () => {};

// Read once per render from the address bar; the static prerender has no
// address, so it (and hydration) see the default.
export function useModeSwitchVariant(): ModeSwitchVariant {
  return useSyncExternalStore(
    noSubscription,
    () => parseModeSwitchVariant(window.location.search),
    () => DEFAULT_VARIANT,
  );
}
