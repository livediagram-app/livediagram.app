// The browser's own online / offline answer (docs/specs/007-editor/load-recovery.md "Offline"), as an
// external store: `navigator.onLine` plus its `online` / `offline` events. Trusted only one way: offline
// means offline, while online may still not reach the server.

export function getOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

/** The static export renders online, so a server snapshot never shows the offline copy. */
export function getOnlineServer(): boolean {
  return true;
}

export function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}
