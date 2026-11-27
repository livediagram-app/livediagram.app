'use client';

// Whether the Slack and Teams dialog is open (docs/specs/030-knowledgebase/chat-apps.md "Connecting"), and what an
// install coming back from Slack said (`?chat=`), shown in it once.
import { useSyncExternalStore } from 'react';

export type ChatReturn = 'connected' | 'taken' | 'failed' | 'denied';

let open = false;
let back: ChatReturn | null = null;
const listeners = new Set<() => void>();

const say = () => listeners.forEach((listener) => listener());

export const openChatApps = (): void => {
  if (open) return;
  open = true;
  say();
};
export const closeChatApps = (): void => {
  if (!open && back === null) return;
  open = false;
  back = null;
  say();
};

/** The dialog opened on what Slack's install came back with. */
export function openChatAppsWith(outcome: ChatReturn): void {
  back = outcome;
  open = true;
  say();
}

/** What `?chat=` says, or null for anything else. */
export function chatReturnOf(search: string): ChatReturn | null {
  const value = new URLSearchParams(search).get('chat');
  return value === 'connected' || value === 'taken' || value === 'failed' || value === 'denied'
    ? value
    : null;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useChatAppsOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}

export function useChatReturn(): ChatReturn | null {
  return useSyncExternalStore(
    subscribe,
    () => back,
    () => null,
  );
}
