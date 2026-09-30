// Handoff signal for /new?blank=1&quickstart=1 (docs/specs/007-editor/new-document-route.md): the
// marketing hero's launch window grows into a blank document with Quick Start
// already open. /new marks the intent just before the in-place handoff; the
// editor consumes it once the document has loaded. sessionStorage, like the
// tour flag (lib/tour-pending.ts): tab-scoped, and never in a copyable URL.
//
// Consumed, not peeked: a reload afterwards lands on the canvas like any
// blank document, and dismissing Quick Start is final.
const QUICK_START_PENDING_KEY = 'livediagram:v2:quick-start-pending';

export function markQuickStartPending() {
  try {
    sessionStorage.setItem(QUICK_START_PENDING_KEY, '1');
  } catch {
    // Storage unavailable: the document still opens, just without the picker.
  }
}

// True once per mark: reading it clears it.
export function consumeQuickStartPending(): boolean {
  try {
    const pending = sessionStorage.getItem(QUICK_START_PENDING_KEY) === '1';
    if (pending) sessionStorage.removeItem(QUICK_START_PENDING_KEY);
    return pending;
  } catch {
    return false;
  }
}
