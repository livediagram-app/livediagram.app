// What the Receptionist's canvas layer and his footer host share (docs/specs/008-canvas/receptionist.md): whether his bubble is
// open, why, on which topic or page, and the person's answers that shape it. The canvas draws the Receptionist and knows where
// everyone stands; the host reads and writes the person's preferences and offers Ask Receptionist. Neither imports the
// other: they meet here.

import { useSyncExternalStore } from 'react';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

export type ReceptionistChat =
  | { open: false }
  | {
      open: true;
      // The welcome, a returning person's hello, Ask Receptionist (a press on him or the footer), or his farewell
      // once an Editor asked him to leave, or his answer at a reception bell you rang.
      reason: 'welcome' | 'back' | 'ask' | 'farewell' | 'bell';
      // The topic whose answer shows, or null for the list.
      topicId: string | null;
    };

export type ReceptionistState = {
  chat: ReceptionistChat;
  // Counts each Ask Receptionist, so the canvas sends him over once per ask.
  asks: number;
  // Counts each time he reached the pad to greet you, so the host opens your welcome (or hello) once per arrival.
  greets: number;
  // The Receptionist is on this tab and you are walking: Ask Receptionist can be offered.
  here: boolean;
  // What the person may do and has heard: set by the host from the share role and the synced preferences.
  can: { speak: boolean; edit: boolean };
  heard: readonly string[];
  // The person's first name, for "Welcome back, <name>!", or null when they have none.
  name: string | null;
};

const listeners = createListeners();
let state: ReceptionistState = {
  chat: { open: false },
  asks: 0,
  greets: 0,
  here: false,
  can: { speak: false, edit: false },
  heard: [],
  name: null,
};

function set(next: Partial<ReceptionistState>): void {
  state = { ...state, ...next };
  listeners.notify();
}

export function getReceptionistState(): ReceptionistState {
  return state;
}

export function useReceptionistState(): ReceptionistState {
  return useSyncExternalStore(listeners.subscribe, getReceptionistState, getReceptionistState);
}

/** Ask Receptionist: he comes over to you and opens his topics (as his welcome, when Settings asked for it again). */
export function askReceptionist(reason: 'ask' | 'welcome' = 'ask'): void {
  set({ asks: state.asks + 1, chat: { open: true, reason, topicId: null } });
}

/** Open his bubble where he stands: the welcome, a returning person's hello, or at the bell you rang. */
export function openReceptionist(reason: 'welcome' | 'back' | 'bell'): void {
  set({ chat: { open: true, reason, topicId: null } });
}

/** Show a topic's answer, or the list (null). */
export function showReceptionistTopic(topicId: string | null): void {
  if (!state.chat.open) return;
  set({ chat: { ...state.chat, topicId } });
}

/** An Editor asked him to leave: his farewell shows, then his canvas layer stores it on his pad. */
export function sayReceptionistFarewell(): void {
  set({ chat: { open: true, reason: 'farewell', topicId: null } });
}

export function closeReceptionist(): void {
  if (state.chat.open) set({ chat: { open: false } });
}

/** He has reached the pad to greet you. */
export function noteReceptionistGreetedYou(): void {
  set({ greets: state.greets + 1 });
}

export function setReceptionistHere(here: boolean): void {
  if (state.here !== here) set({ here });
}

export function setReceptionistPerson(
  can: ReceptionistState['can'],
  heard: readonly string[],
  name: string | null = null,
): void {
  if (
    state.can.speak === can.speak &&
    state.can.edit === can.edit &&
    state.name === name &&
    state.heard.length === heard.length &&
    state.heard.every((id, i) => heard[i] === id)
  )
    return;
  set({ can, heard, name });
}

/** Back to the start: for the tests, and when the editor unmounts. */
export function resetReceptionistState(): void {
  state = {
    chat: { open: false },
    asks: 0,
    greets: 0,
    here: false,
    can: { speak: false, edit: false },
    heard: [],
    name: null,
  };
  listeners.notify();
}
