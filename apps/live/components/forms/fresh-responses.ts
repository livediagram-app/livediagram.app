'use client';

// A response's card is New (docs/specs/030-forms/forms.md "Hearing about responses"): made by a form less than a week
// ago and not yet opened in this browser. What has been opened is kept per browser (local storage, the newest
// FRESH_OPENED_MAX ids), and read through a small store so every card drawing the mark updates when one is opened.
import { useSyncExternalStore } from 'react';
import { FROM_FORM_FIELD, readFromForm } from '@livediagram/forms';
import type { Item } from '@livediagram/items';

// How long a response's card shows New when nobody opens it. Safe range 1..30 days.
export const FRESH_RESPONSE_MS = 7 * 24 * 60 * 60 * 1000;
// The most opened ids kept; past it the oldest go (they are older than a week by then on any busy board).
export const FRESH_OPENED_MAX = 500;
const KEY = 'livediagram:form-responses-opened';

let opened: string[] | null = null;
let version = 0;
const listeners = new Set<() => void>();

function load(): string[] {
  if (opened) return opened;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    opened = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    opened = [];
  }
  return opened;
}

export function markResponseOpened(item: Pick<Item, 'id' | 'fields'>): void {
  if (!readFromForm(item.fields[FROM_FORM_FIELD])) return;
  const list = load();
  if (list.includes(item.id)) return;
  opened = [...list, item.id].slice(-FRESH_OPENED_MAX);
  version += 1;
  try {
    localStorage.setItem(KEY, JSON.stringify(opened));
  } catch {
    // Blocked storage: the mark goes for this visit only.
  }
  for (const l of listeners) l();
}

export function isFreshResponse(
  item: Pick<Item, 'id' | 'fields' | 'createdAt'>,
  now: number,
  openedIds: readonly string[] = load(),
): boolean {
  if (!readFromForm(item.fields[FROM_FORM_FIELD])) return false;
  if (now - item.createdAt > FRESH_RESPONSE_MS) return false;
  return !openedIds.includes(item.id);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Whether `item` shows New now; it re-renders when any response is opened.
export function useFreshResponse(item: Pick<Item, 'id' | 'fields' | 'createdAt'>): boolean {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  // Read at draw: a card older than the week stops showing New at its next draw.
  // eslint-disable-next-line react-hooks/purity -- the week is coarse; a draw's own clock is enough
  return isFreshResponse(item, Date.now());
}

// For tests: forget what this browser opened.
export function resetFreshResponses(): void {
  opened = null;
  version += 1;
}
