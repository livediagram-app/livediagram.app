// One tab per browser runs the mirror (docs/specs/022-drive-mirror/drive-mirror.md,
// "Cadence"): the Web Locks API elects it, and a BroadcastChannel carries the
// elected tab's status to the others and their requests (an api write, a
// flush, Sync now, an adoption) back to it.

import type { DriveAccessToken, DriveItemKind } from '@livediagram/api-schema';
import type { DriveMirrorStatus } from './engine';

const LOCK_NAME = 'livediagram:drive-mirror';
const CHANNEL_NAME = 'livediagram:drive-mirror';

export type DriveTabMessage =
  | { type: 'status'; status: DriveMirrorStatus }
  | { type: 'hello' }
  | { type: 'write' }
  // The elected tab applied a change from Drive: every tab's views re-read.
  | { type: 'drive-applied' }
  | { type: 'flush' }
  | { type: 'sync-now' }
  | { type: 'adopt'; kind: DriveItemKind; ldId: string; folderFileId: string }
  // Browser-only mode: a token granted in this tab, for the elected one.
  | { type: 'token'; token: DriveAccessToken };

// Hold the lock for as long as this tab runs the engine. `onElected` runs
// once the lock is granted (at once, or when the tab holding it closes); the
// returned function gives the lock up. Without the Web Locks API every tab is
// elected; the D1 lease still keeps writes to one device (D2).
export function electDriveTab(onElected: () => void): () => void {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) {
    onElected();
    return () => {};
  }
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const abort = new AbortController();
  locks
    .request(LOCK_NAME, { signal: abort.signal }, () => {
      onElected();
      return held;
    })
    .catch(() => {
      // Aborted while waiting: this tab was never elected.
    });
  return () => {
    abort.abort();
    release();
  };
}

export type DriveTabChannel = {
  post(message: DriveTabMessage): void;
  close(): void;
};

export function openDriveTabChannel(
  onMessage: (message: DriveTabMessage) => void,
): DriveTabChannel {
  if (typeof BroadcastChannel === 'undefined') return { post: () => {}, close: () => {} };
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<DriveTabMessage>) => onMessage(event.data);
  return {
    post: (message) => channel.postMessage(message),
    close: () => channel.close(),
  };
}

// The editor asks for a flush when the user leaves a diagram; whichever tab
// runs the engine picks it up.
const flushListeners = new Set<() => void>();

export function requestDriveFlush(): void {
  for (const listener of flushListeners) listener();
}

export function onDriveFlushRequest(listener: () => void): () => void {
  flushListeners.add(listener);
  return () => flushListeners.delete(listener);
}
