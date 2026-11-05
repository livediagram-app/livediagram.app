// The bubbles' streams and the one maximised (docs/specs/012-collaboration/video-and-screen-bubbles.md "The bubble",
// "Maximised"): what each person's camera and screen bubble draws, your own under SELF_MEDIA_ID, and the bubble this
// viewer opened large. Part of the calls store (calls-store.ts), which re-exports it; memory only.
import { useSyncExternalStore } from 'react';
import { parseCallStopShare } from '@livehuddle/api-schema';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

/** What a bubble shows. */
export type CallMedia = 'video' | 'screen';
/** Your own bubbles are keyed by this in the media store; everyone else's by presence id. */
export const SELF_MEDIA_ID = 'self';
/** The one bubble this viewer has opened large. */
export type CallMaximised = { id: string; media: CallMedia };
export type CallMediaStreams = { readonly video?: MediaStream; readonly screen?: MediaStream };

const mediaListeners = createListeners();
const stopShareListeners = new Set<(from: string) => void>();
const maximisedListeners = createListeners();
let media: ReadonlyMap<string, CallMediaStreams> = new Map();
let maximised: CallMaximised | null = null;

// --- The bubbles' streams and the maximised one (docs/specs/012-collaboration/video-and-screen-bubbles.md) ---------

/** Show (or with null, stop showing) a stream in someone's bubble; `SELF_MEDIA_ID` for your own. */
export function setCallMedia(id: string, kind: CallMedia, stream: MediaStream | null): void {
  const prev = media.get(id) ?? {};
  if ((prev[kind] ?? null) === stream) return;
  const next = new Map(media);
  const streams: CallMediaStreams = { ...prev, [kind]: stream ?? undefined };
  if (!streams.video && !streams.screen) next.delete(id);
  else next.set(id, streams);
  media = next;
  mediaListeners.notify();
  // A bubble that is no longer received cannot stay maximised.
  if (!stream && maximised?.id === id && maximised.media === kind) setCallMaximised(null);
}

/** Every bubble's streams, by presence id. */
export function callMedia(): ReadonlyMap<string, CallMediaStreams> {
  return media;
}

export function useCallMedia(): ReadonlyMap<string, CallMediaStreams> {
  return useSyncExternalStore(mediaListeners.subscribe, callMedia, callMedia);
}

/** Open a bubble large, or with null restore it. Only one at a time. */
export function setCallMaximised(next: CallMaximised | null): void {
  if (maximised?.id === next?.id && maximised?.media === next?.media) return;
  maximised = next;
  maximisedListeners.notify();
}

export function callMaximised(): CallMaximised | null {
  return maximised;
}

export function useCallMaximised(): CallMaximised | null {
  return useSyncExternalStore(maximisedListeners.subscribe, callMaximised, callMaximised);
}

/** Subscribe to a maximise or a restore (the running call switches that camera's layer). */
export function onCallMaximised(listener: () => void): () => void {
  return maximisedListeners.subscribe(listener);
}

/** Every bubble goes: the call ended. */
export function resetCallMedia(): void {
  maximised = null;
  maximisedListeners.notify();
  if (media.size === 0) return;
  media = new Map();
  mediaListeners.notify();
}

/**
 * An addressed `call-stop-share` reached this browser: an Editor asked you to stop sharing (video-and-screen-bubbles.md
 * "Share roles"). Handed to the running call, which checks the sender is an Editor; malformed, it is ignored.
 */
export function receiveStopShare(from: string, op: unknown): void {
  if (!parseCallStopShare(op)) return;
  for (const listener of stopShareListeners) listener(from);
}

/** Subscribe to stop-shares addressed to you (the running call). */
export function onStopShare(listener: (from: string) => void): () => void {
  stopShareListeners.add(listener);
  return () => stopShareListeners.delete(listener);
}
