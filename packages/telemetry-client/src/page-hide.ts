// Run a callback when the page is being hidden or unloaded (docs/specs/017-telemetry/telemetry.md), BEFORE
// the telemetry engine's own page-hide flush sends its last batch.
//
// For an emit a host deliberately holds back (a debounced slider change, a
// helpful vote that can still be changed), the engine's flush on
// `visibilitychange`/`pagehide` is the last chance to get it on the wire. The
// held emit has to land in the buffer first, and the engine's listeners are
// ordinary bubble-phase listeners attached on its first track() call, which is
// usually long before the host's. Both events are dispatched AT their target
// (window / document), where capture-phase listeners run before bubble-phase
// ones regardless of registration order, so listening in the capture phase is
// what guarantees "emit, then flush" rather than "flush, then emit into a
// buffer nobody will send".
//
// Returns the unsubscribe. A no-op outside the browser.
export function onPageHide(callback: () => void): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') callback();
  };
  document.addEventListener('visibilitychange', onVisibility, { capture: true });
  window.addEventListener('pagehide', callback, { capture: true });
  return () => {
    document.removeEventListener('visibilitychange', onVisibility, { capture: true });
    window.removeEventListener('pagehide', callback, { capture: true });
  };
}
