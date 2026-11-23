// The page whose Required Reading was just asked for from the page menu (docs/specs/030-knowledgebase/required-reading.md
// "Where it shows"): a page that is not Required Reading shows nothing of it until then (owner 2026-11-23: "require
// reading should be in the page context menu until enabled, not always shown"), and its setup opens in a modal once
// asked. One page at a time, as the menu's Request Approval is (approval-asked.ts).
import { useSyncExternalStore } from 'react';
import type { PageReadingEntry } from './reading-store';

/** Whether a page's menu offers Require Reading: an Editor (`editor`), signed in where the knowledgebase has its room
 *  (`reachable`: not Offline, not an embed), on a page that is not Required Reading. A page not read yet this session
 *  is offered too (its modal shows it as it stands); one the api said this person may not manage is not. Pure. */
export function requireReadingOffered(
  editor: boolean,
  reachable: boolean,
  { status, reading }: PageReadingEntry,
): boolean {
  if (!editor || !reachable || reading.required) return false;
  return status !== 'ready' || reading.manages;
}

let asked: string | null = null;
const listeners = new Set<() => void>();

/** Set this page up as Required Reading: its setup opens in a modal. */
export function askReading(pageId: string): void {
  asked = pageId;
  listeners.forEach((l) => l());
}

/** The setup was saved or put away. */
export function clearReadingAsk(): void {
  if (asked === null) return;
  asked = null;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Whether this page's Required Reading was just asked for. */
export function useReadingAsked(pageId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => asked === pageId,
    () => false,
  );
}
