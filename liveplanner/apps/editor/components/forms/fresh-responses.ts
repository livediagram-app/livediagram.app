'use client';

// A response's card is New (docs/specs/030-forms/forms.md "Hearing about responses"): made by a form less than a week
// ago and not yet opened in this browser. What has been opened is kept per browser (local storage, the newest
// FRESH_OPENED_MAX ids), and read through a small store so every card drawing the mark updates when one is opened.
import { useSyncExternalStore } from 'react';
import { useToday } from '@/hooks/ui/useToday';
import { FROM_FORM_FIELD, readFromForm } from '@liveplanner/forms';
import type { Item } from '@liveplanner/items';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

// How long a response's card shows New when nobody opens it. Safe range 1..30 days.
export const FRESH_RESPONSE_MS = 7 * 24 * 60 * 60 * 1000;
// The most opened ids kept; past it the oldest go (they are older than a week by then on any busy board).
export const FRESH_OPENED_MAX = 500;
const KEY = 'liveplanner:form-responses-opened';

let opened: string[] | null = null;
// The same ids as a set, so each card's check is one lookup however many were opened.
let openedSet: ReadonlySet<string> = new Set();
let version = 0;
const listeners = createListeners();

function load(): string[] {
  if (opened) return opened;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    opened = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    opened = [];
  }
  openedSet = new Set(opened);
  return opened;
}

export function markResponseOpened(item: Pick<Item, 'id' | 'fields'>): void {
  if (!readFromForm(item.fields[FROM_FORM_FIELD])) return;
  const list = load();
  if (openedSet.has(item.id)) return;
  opened = [...list, item.id].slice(-FRESH_OPENED_MAX);
  openedSet = new Set(opened);
  version += 1;
  try {
    localStorage.setItem(KEY, JSON.stringify(opened));
  } catch {
    // Blocked storage: the mark goes for this visit only.
  }
  listeners.notify();
}

export function isFreshResponse(
  item: Pick<Item, 'id' | 'fields' | 'createdAt'>,
  now: number,
): boolean {
  if (!readFromForm(item.fields[FROM_FORM_FIELD])) return false;
  if (now - item.createdAt > FRESH_RESPONSE_MS) return false;
  load();
  return !openedSet.has(item.id);
}

// Whether `item` shows New now; it re-renders when any response is opened.
export function useFreshResponse(item: Pick<Item, 'id' | 'fields' | 'createdAt'>): boolean {
  useSyncExternalStore(
    listeners.subscribe,
    () => version,
    () => 0,
  );
  // The week is coarse, so it is measured from today (useToday, which moves on at midnight), never the clock read
  // while drawing: a card stops showing New at the first midnight after it turns a week old.
  const today = useToday();
  return isFreshResponse(item, today.getTime());
}

// For tests: forget what this browser opened.
export function resetFreshResponses(): void {
  opened = null;
  openedSet = new Set();
  version += 1;
}
