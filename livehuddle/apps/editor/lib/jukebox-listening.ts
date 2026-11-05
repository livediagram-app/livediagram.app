// The Jukebox on this device (docs/specs/009-elements/social-pieces.md "Jukebox"): whether you listen ('off' until
// you press Play once, then 'on' or 'muted', remembered here), which jukebox's area you stand in, and the one audio
// element every jukebox plays through. Module stores read through useSyncExternalStore, so only the jukeboxes and the
// Avatar panel row re-render when they change. Nothing here is shared with anyone: what you hear is yours.

import { useSyncExternalStore } from 'react';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

export type JukeboxListening = 'off' | 'on' | 'muted';

const STORAGE_KEY = 'livehuddle.jukebox';
/** How loud a jukebox plays: low, under any call. */
export const JUKEBOX_VOLUME = 0.2;

function readStored(): JukeboxListening {
  try {
    const v = globalThis.localStorage?.getItem(STORAGE_KEY);
    return v === 'on' || v === 'muted' ? v : 'off';
  } catch {
    return 'off';
  }
}

let listening: JukeboxListening | null = null;
let playingId: string | null = null;
let failedSource: string | null = null;
const listeners = createListeners();

function current(): JukeboxListening {
  if (listening === null) listening = readStored();
  return listening;
}

export function setJukeboxListening(next: JukeboxListening): void {
  listening = next;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, next);
  } catch {
    // A private window: the choice lasts this visit.
  }
  listeners.notify();
  // Applied at once, inside the press that changed it: the gesture a browser asks for before a page makes sound.
  applyArea();
}

/** The face's button and the Avatar panel row: Play the first time, then Mute and Unmute. */
export function toggleJukeboxListening(): void {
  setJukeboxListening(current() === 'on' ? 'muted' : 'on');
}

export function useJukeboxListening(): JukeboxListening {
  return useSyncExternalStore(listeners.subscribe, current, () => 'off');
}

/** Which jukebox is playing for you right now, or null. */
export function useJukeboxPlaying(id: string): boolean {
  return useSyncExternalStore(
    listeners.subscribe,
    () => playingId === id,
    () => false,
  );
}

/** Whether this source failed to play for you. */
export function useJukeboxFailed(source: string | undefined): boolean {
  return useSyncExternalStore(
    listeners.subscribe,
    () => !!source && failedSource === source,
    () => false,
  );
}

let audio: HTMLAudioElement | null = null;
// The jukebox whose area your character stands in, and what it plays (useSocialPieces keeps it).
let area: { id: string; source: string } | null = null;

function applyArea(): void {
  playJukebox(area?.id ?? null, area?.source ?? null);
}

/** Where you stand: the jukebox whose area holds you and its source, or nulls. Plays or stops when it changes. */
export function setJukeboxArea(id: string | null, source: string | null): void {
  const next = id && source ? { id, source } : null;
  if (next?.id === area?.id && next?.source === area?.source) return;
  area = next;
  applyArea();
}

function audioElement(): HTMLAudioElement | null {
  if (audio) return audio;
  if (typeof Audio === 'undefined') return null;
  audio = new Audio();
  audio.loop = true;
  audio.preload = 'none';
  audio.volume = JUKEBOX_VOLUME;
  return audio;
}

function setPlaying(id: string | null): void {
  if (playingId === id) return;
  playingId = id;
  listeners.notify();
}

function fail(source: string): void {
  failedSource = source;
  setPlaying(null);
}

/**
 * Plays `source` for the jukebox `id`, or stops when either is null. Called with the jukebox whose area you stand in
 * and your choice folded in (useSocialPieces), and from a press of Play, which is the gesture a browser asks for
 * before it lets a page make sound.
 */
export function playJukebox(id: string | null, source: string | null): void {
  const el = audioElement();
  if (!el) return;
  if (!id || !source || current() !== 'on') {
    if (!el.paused) el.pause();
    setPlaying(null);
    return;
  }
  if (failedSource === source) return;
  if (el.src !== source) el.src = source;
  el.volume = JUKEBOX_VOLUME;
  const started = el.play();
  setPlaying(id);
  // Older browsers answer play() with nothing; Promise.resolve gives every one a promise to watch.
  Promise.resolve(started).catch((err: unknown) => {
    const name = (err as { name?: string } | null)?.name;
    // A pause or a new source cut it short: nothing failed.
    if (name === 'AbortError') return;
    // The browser wants a press first: it plays on the next Play, the address is not at fault.
    if (name === 'NotAllowedError') return setPlaying(null);
    fail(source);
  });
  el.onerror = () => fail(source);
}

/** Forgets everything (tests). */
export function resetJukebox(): void {
  listening = null;
  playingId = null;
  failedSource = null;
  audio = null;
  area = null;
  listeners.clear();
}
