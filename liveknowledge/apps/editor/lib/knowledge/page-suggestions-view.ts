// What the open page shows of its suggested edits (docs/specs/030-knowledgebase/ai-knowledge.md "On the page";
// blueprint suggested-edits-ui.md "The view store"): the suggestions its writing marks, which of them the writing found,
// the one open in a popover, the one shown in the page (Show in Page), and a suggestion an address asked to open.
// Outside React, as the Find bar's highlights are: the writing's plugin (lib/article/article-suggestion-plugin.ts)
// reads it and reports what it found, the page's chrome draws from it. Nothing here is stored.
import type { KnowledgeSuggestion } from '@liveknowledge/api-schema';

export type SuggestionMark = Pick<
  KnowledgeSuggestion,
  'id' | 'kind' | 'before' | 'after' | 'agent'
>;

export type SuggestionsViewState = {
  /** The open page, and the articles whose writing the marks are on (its saved writing and a draft's). */
  tab: string | null;
  flows: readonly string[];
  marks: readonly SuggestionMark[];
  /** Each mark the writing has looked for: found once (true) or not (false); absent until it has looked. */
  found: ReadonlyMap<string, boolean>;
  /** The popover's suggestion and what it is anchored to (a marker, a rail row, the pill); null anchor is centred. */
  open: { id: string; anchor: HTMLElement | null } | null;
  /** Show in Page's suggestion. */
  showing: string | null;
  /** A suggestion the address asked to open (`#suggestion=<id>`), until the page's suggestions arrive. */
  asked: string | null;
  /** Counts the room's word that suggestions changed (a `page-suggestions` op), so the page reads its health again. */
  pushed: number;
  /** Suggestions being accepted (`accept:<id>`) or dismissed (`dismiss:<id>`) here. */
  busy: ReadonlySet<string>;
};

const EMPTY: SuggestionsViewState = {
  tab: null,
  flows: [],
  marks: [],
  found: new Map(),
  open: null,
  showing: null,
  asked: null,
  pushed: 0,
  busy: new Set(),
};

let state: SuggestionsViewState = EMPTY;
const listeners = new Set<() => void>();
// The margin markers' hosts, one element a suggestion, made once and reused, so the writing keeps its widgets and
// React draws into them through portals.
const hosts = new Map<string, HTMLElement>();

function set(next: Partial<SuggestionsViewState>): void {
  state = { ...state, ...next };
  for (const listener of [...listeners]) listener();
}

const sameMarks = (a: readonly SuggestionMark[], b: readonly SuggestionMark[]) =>
  a.length === b.length &&
  a.every(
    (m, i) =>
      m.id === b[i]!.id &&
      m.before === b[i]!.before &&
      m.after === b[i]!.after &&
      m.kind === b[i]!.kind,
  );

export const suggestionsView = {
  get: (): SuggestionsViewState => state,
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** The open page's suggestions, from its Page Health read. Unchanged marks change nothing, so the writing does
   *  not look again. A popover or review of a suggestion no longer waiting closes. */
  setMarks(tab: string | null, flows: readonly string[], marks: readonly SuggestionMark[]): void {
    const sameFlows =
      flows.length === state.flows.length && flows.every((f, i) => f === state.flows[i]);
    if (tab === state.tab && sameFlows && sameMarks(marks, state.marks)) return;
    const ids = new Set(marks.map((m) => m.id));
    for (const id of [...hosts.keys()]) if (!ids.has(id)) hosts.delete(id);
    const samePage = tab === state.tab;
    set({
      tab,
      flows: sameFlows ? state.flows : flows,
      marks,
      found: samePage ? state.found : new Map(),
      open: samePage && state.open && ids.has(state.open.id) ? state.open : null,
      showing: samePage && state.showing && ids.has(state.showing) ? state.showing : null,
    });
  },
  /** The writing's answer for its marks (the plugin, after it looked). */
  reportFound(flow: string, found: ReadonlyMap<string, boolean>): void {
    if (!state.flows.includes(flow)) return;
    const same =
      found.size === state.found.size && [...found].every(([id, f]) => state.found.get(id) === f);
    if (!same) set({ found });
  },
  open(id: string, anchor: HTMLElement | null): void {
    set({ open: { id, anchor } });
  },
  close(): void {
    if (state.open) set({ open: null });
  },
  /** Show in Page, or back to reading (null). Opening it closes the popover. */
  show(id: string | null): void {
    set({ showing: id, open: null });
  },
  /** The room said suggestions changed: one more read of the open page's health, never a poll. */
  notePushed(): void {
    set({ pushed: state.pushed + 1 });
  },
  setBusy(key: string, on: boolean): void {
    if (state.busy.has(key) === on) return;
    const busy = new Set(state.busy);
    if (on) busy.add(key);
    else busy.delete(key);
    set({ busy });
  },
  ask(id: string | null): void {
    set({ asked: id });
  },
  /** The element a suggestion's margin marker is drawn into. */
  hostOf(id: string): HTMLElement {
    let el = hosts.get(id);
    if (!el) {
      el = document.createElement('div');
      el.contentEditable = 'false';
      el.className = 'suggestion-marker-host';
      el.dataset.suggestionMarker = id;
      hosts.set(id, el);
    }
    return el;
  },
  /** The hosts made so far, for the markers' portals. */
  hosts: (): ReadonlyMap<string, HTMLElement> => hosts,
  /** For tests. */
  reset(): void {
    hosts.clear();
    state = EMPTY;
  },
};
