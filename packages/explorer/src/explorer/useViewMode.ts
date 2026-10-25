'use client';

// List, card or details layout for the browse views: device-local, cards for someone who has never chosen. A
// choice made in an app's own Explorer (its older key) carries over. List and Details are for larger screens: a
// phone always shows cards (the toggle is hidden there), and the saved choice is kept for when the window widens.

import { useCallback, useState, useSyncExternalStore } from 'react';
import { readStored, writeStored } from '../ui/storage';
import type { ViewMode } from './PaneHeader';

export const VIEW_MODE_KEY = 'liveworkspace:explorer-view-mode';
export const LEGACY_VIEW_MODE_KEYS = [
  'liveplanner:explorer-view',
  'livediagram:explorer-view',
] as const;

// Tailwind's `sm` breakpoint: narrower is a phone.
const PHONE_QUERY = '(max-width: 639px)';

function parseMode(saved: string | null): ViewMode {
  return saved === 'list' || saved === 'details' ? saved : 'card';
}

function subscribePhone(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener?.('change', onChange);
  return () => query.removeEventListener?.('change', onChange);
}

function isPhoneNow(): boolean {
  try {
    return window.matchMedia?.(PHONE_QUERY).matches ?? false;
  } catch {
    return false;
  }
}

export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribePhone, isPhoneNow, () => false);
}

export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const [saved, setSaved] = useState<ViewMode>(() =>
    parseMode(readStored(VIEW_MODE_KEY, LEGACY_VIEW_MODE_KEYS)),
  );
  const phone = useIsPhone();
  const set = useCallback((next: ViewMode) => {
    setSaved(next);
    writeStored(VIEW_MODE_KEY, next);
  }, []);
  return [phone ? 'card' : saved, set];
}
