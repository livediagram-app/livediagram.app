'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  LENS_DIMENSIONS,
  normaliseInput,
  parseLens,
  readLensQuery,
  type LensContext,
  type LensTeam,
  type LensView,
  type ParsedLens,
} from '@livediagram/explorer-lens';
import { debugLog } from '@/lib/debug-log';
import type { SelectedNode } from '../views';
import { lensHref, lensViewOf, SEARCH_RESULTS_PATH } from './lens-views';
import { trackLensChange } from './lens-telemetry';

// The Explorer's one lens (docs/specs/013-workspace/explorer-filters.md, blueprint "The Explorer
// page"): the string, the caret while the field is focused, and the URL kept in step. The string
// is the state; `q` in the address bar follows it, and a `q` that changes from outside (a link,
// Back, Forward) is adopted. Writes this hook made itself are remembered until the address bar
// shows them, so a fast typist is never overwritten by an echo of an older keystroke.

type Sync = { seen: string; pending: string[] };

export type ExplorerLens = {
  /** The current view's lens, or null on a view that lists no documents. */
  view: LensView | null;
  context: LensContext;
  input: string;
  /** Where the caret stands while the field is focused; null otherwise. */
  caret: number | null;
  parsed: ParsedLens;
  /** When the lens last changed: the clock Edited reads. */
  now: number;
  /** A write from the field, with the caret it leaves. */
  setField: (input: string, caret: number) => void;
  /** A write from elsewhere (a chip, Clear): the caret stays as it was. */
  setInput: (input: string) => void;
  /** The field lost focus: the word under the caret is read for good. */
  blur: () => void;
};

/** A few facts for the trace line; never a word of the lens or an id. */
function describe(parsed: ParsedLens): string {
  const applied = LENS_DIMENSIONS.filter((d) => parsed.lens.filters[d].length > 0);
  const issues = parsed.issues.map((issue) => issue.reason);
  return `terms=${parsed.terms.length} applied=${applied.join(',') || 'none'} issues=${issues.join(',') || 'none'}`;
}

export function useExplorerLens({
  selected,
  teams,
  search,
  router,
}: {
  selected: SelectedNode;
  teams: readonly LensTeam[];
  /** The location's search string (`?…`), as the router reports it. */
  search: string;
  /** Opening Search results from a view with no lens: one history entry (push), then replaces
   *  while the navigation is still under way. */
  router: { push: (url: string) => void; replace: (url: string) => void };
}): ExplorerLens {
  const view = lensViewOf(selected.kind);
  const context = useMemo<LensContext>(
    () => ({ view: view ?? 'aggregate', teams: teams.map((t) => ({ id: t.id, name: t.name })) }),
    [view, teams],
  );
  const urlLens = readLensQuery(search);
  const [input, setInputState] = useState(urlLens);
  const [caret, setCaret] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [sync, setSync] = useState<Sync>({ seen: urlLens, pending: [] });
  // Search results is being opened from a view with no lens: later keystrokes replace that entry.
  const [openingSearch, setOpeningSearch] = useState(false);
  if (openingSearch && view !== null) setOpeningSearch(false);

  // The address bar moved. Our own write arriving is only bookkeeping; anything else is adopted.
  if (urlLens !== sync.seen) {
    const at = sync.pending.indexOf(urlLens);
    if (at !== -1) {
      setSync({ seen: urlLens, pending: sync.pending.slice(at + 1) });
    } else {
      setSync({ seen: urlLens, pending: [] });
      if (urlLens !== normaliseInput(input)) {
        setInputState(urlLens);
        setCaret(null);
        debugLog(`[explorer-lens] url adopted empty=${urlLens === ''}`);
      }
    }
  }

  const parsed = useMemo(
    () => parseLens(input, context, caret ?? undefined),
    [input, context, caret],
  );

  const commit = useCallback(
    (next: string, nextCaret: number | null) => {
      const nextParsed = parseLens(next, context, nextCaret ?? undefined);
      trackLensChange(parsed.lens, nextParsed.lens);
      setInputState(next);
      setCaret(nextCaret);
      setNow(Date.now());
      const written = normaliseInput(next);
      const latest = sync.pending.at(-1) ?? sync.seen;
      if (written === latest) return;
      if (view === null) {
        if (written === '') return;
        setSync((s) => ({ ...s, pending: [...s.pending, written] }));
        const href = lensHref(SEARCH_RESULTS_PATH, written);
        if (openingSearch) {
          router.replace(href);
          return;
        }
        setOpeningSearch(true);
        debugLog(`[explorer-lens] search opened from=${selected.kind}`);
        router.push(href);
        return;
      }
      setSync((s) => ({ ...s, pending: [...s.pending, written] }));
      const url = new URL(window.location.href);
      window.history.replaceState(
        window.history.state,
        '',
        lensHref(`${url.pathname}${url.search}`, written) + url.hash,
      );
      debugLog(`[explorer-lens] url replaced view=${view} empty=${written === ''}`);
      debugLog(`[explorer-lens] parsed ${describe(nextParsed)}`);
    },
    [context, parsed.lens, sync, view, selected.kind, router, openingSearch],
  );

  const setField = useCallback((next: string, at: number) => commit(next, at), [commit]);
  const setInput = useCallback((next: string) => commit(next, caret), [commit, caret]);
  const blur = useCallback(() => commit(input, null), [commit, input]);

  return { view, context, input, caret, parsed, now, setField, setInput, blur };
}
