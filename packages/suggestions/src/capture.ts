// Suggesting on a canvas, in the editor (liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md
// "Suggesting"): while a person suggests, every change their gestures make to the active tab's elements is gathered
// (one gesture, a drag landing or a burst of nudges, is one suggestion) and sent as a suggestion instead of landing
// on the canvas. It wraps the editor's one history commit and tick, as the replay freeze does, so every path that
// edits (draw, drag, paste, type, delete, the menus) is caught at one choke point. Framework-free; the hook drives it.
import { suggestionOpsBetween } from './plan';
import { SUGGEST_GATHER_MS, type SuggestionElement, type SuggestionOp } from './suggestion';

export type CaptureTab<E extends SuggestionElement> = { id: string; elements: E[] };
type MapTabs<T> = (tabs: T[]) => T[];

/** The change being gathered: the active tab's elements as they were, and as the gesture leaves them. */
export type SuggestDraft<E extends SuggestionElement> = { tabId: string; before: E[]; after: E[] };

export type SuggestCaptureDeps<T extends CaptureTab<E>, E extends SuggestionElement> = {
  // The active tab's id while this session's changes are suggestions; null while it edits directly.
  suggestingOn: () => string | null;
  // The tabs as they are now.
  tabs: () => T[];
  // Send one gathered change as a suggestion.
  propose: (tabId: string, ops: SuggestionOp<E>[]) => void;
  // A change a suggestion can't hold (another tab, the tab's settings, adding or removing tabs): dropped, and said.
  refuse: () => void;
  // Whether a pointer is held down (a gesture still in flight): the gathered change waits for its release.
  pointerDown?: () => boolean;
  schedule?: (fn: () => void, ms: number) => () => void;
  // The product's fingerprint (the element without its live multi-writer fields): a change that alters only those
  // (a comment, a reaction, a vote) is never a suggestion, so it lands as it always does.
  fingerprint?: (element: E) => string;
  // A change to the tab's own fields alone (not its elements) that goes straight through rather than being refused:
  // livedocuments' article writing, which has a suggesting mode of its own.
  passThrough?: (before: T, after: T) => boolean;
};

export type SuggestCapture<T extends CaptureTab<E>, E extends SuggestionElement> = {
  // The editor's commit or tick, wrapped: while suggesting, the change is gathered instead of applied.
  wrap: (apply: (mapTabs: MapTabs<T>) => void) => (mapTabs: MapTabs<T>) => void;
  draft: () => SuggestDraft<E> | null;
  // Send what is gathered now (a pointer released, the mode turned off).
  flush: () => void;
  subscribe: (listener: () => void) => () => void;
};

const defaultSchedule = (fn: () => void, ms: number) => {
  const t = setTimeout(fn, ms);
  return () => clearTimeout(t);
};

const sameTabFields = (a: object, b: object): boolean => {
  const { elements: _a, ...ra } = a as { elements?: unknown };
  const { elements: _b, ...rb } = b as { elements?: unknown };
  return JSON.stringify(ra) === JSON.stringify(rb);
};

export function createSuggestCapture<T extends CaptureTab<E>, E extends SuggestionElement>(
  deps: SuggestCaptureDeps<T, E>,
): SuggestCapture<T, E> {
  const schedule = deps.schedule ?? defaultSchedule;
  let draft: SuggestDraft<E> | null = null;
  let cancel: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const l of listeners) l();
  };

  const send = (d: SuggestDraft<E>) => {
    const ops = suggestionOpsBetween(d.before, d.after);
    if (ops.length > 0) deps.propose(d.tabId, ops);
  };

  const flush = () => {
    cancel?.();
    cancel = null;
    const d = draft;
    if (!d) return;
    if (deps.pointerDown?.()) {
      cancel = schedule(flush, SUGGEST_GATHER_MS);
      return;
    }
    draft = null;
    send(d);
    emit();
  };

  // Whether `next` differs from `prev` only in live fields: changes to elements that are there either side.
  const liveOnly = (prev: readonly E[], next: readonly E[]): boolean => {
    const fp = deps.fingerprint;
    if (!fp) return false;
    const byId = new Map(prev.map((e) => [e.id, e] as const));
    const ops = suggestionOpsBetween(prev, next);
    return (
      ops.length > 0 &&
      ops.every((op) => {
        if (op.kind !== 'update') return false;
        return fp(byId.get(op.element.id)!) === fp(op.element);
      })
    );
  };

  const gather = (mapTabs: MapTabs<T>, tabId: string, apply: (mapTabs: MapTabs<T>) => void) => {
    const tabs = deps.tabs();
    const live = tabs.find((t) => t.id === tabId);
    if (!live) return deps.refuse();
    // A gesture builds on what it gathered so far, so two nudges are one change, never the second alone.
    const carried = draft?.tabId === tabId ? draft : null;
    const seen = carried ? carried.after : live.elements;
    const view = tabs.map((t) => (t.id === tabId ? { ...t, elements: seen } : t));
    const next = mapTabs(view);
    const byId = new Map(view.map((t) => [t.id, t] as const));
    const nextTab = next.find((t) => t.id === tabId);
    const othersChanged =
      next.length !== view.length || next.some((t) => t.id !== tabId && byId.get(t.id) !== t);
    if (!nextTab || othersChanged) return deps.refuse();
    const viewTab = byId.get(tabId)!;
    if (nextTab === viewTab || nextTab.elements === seen) {
      if (nextTab === viewTab || sameTabFields(nextTab, viewTab)) return;
      if (deps.passThrough?.(viewTab, nextTab)) apply(mapTabs);
      else deps.refuse();
      return;
    }
    if (liveOnly(seen, nextTab.elements)) {
      apply(mapTabs);
      return;
    }
    // What was gathered on another tab (the person switched tabs mid-gesture) goes as it is.
    if (draft && !carried) send(draft);
    draft = { tabId, before: carried?.before ?? live.elements, after: nextTab.elements };
    cancel?.();
    cancel = schedule(flush, SUGGEST_GATHER_MS);
    emit();
  };

  return {
    wrap: (apply) => (mapTabs) => {
      const tabId = deps.suggestingOn();
      if (tabId === null) {
        apply(mapTabs);
        return;
      }
      gather(mapTabs, tabId, apply);
    },
    draft: () => draft,
    flush,
    subscribe: (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
  };
}
