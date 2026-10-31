// Find and replace on the open tab (docs/specs/007-editor/find-and-replace.md; blueprint "The current match",
// "Replacing"): the bar's state, the search (150 ms after typing stops, over the tab's text gathered once per change
// of the tab), the match in hand and going to it, Replace and Replace All as one edit, the highlights published for the
// painters, and the two chords that open it. Composed into useEditorState; the bar (FindBar) only renders it.
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  articlesOf,
  elementBounds,
  layOutPages,
  pagesOf,
  rowPageAt,
  type Element,
  type LaidOutPage,
  type Tab,
} from '@livedocuments/document';
import { anyModalOpen } from '@liveworkspace/workbench/lib/modal-guard';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { EditorCapabilities } from '@/lib/editor-capabilities';
import { articleHandleOf } from '@/lib/article/article-editor-store';
import { pageInView } from '@/lib/page-contents';
import {
  DEFAULT_FIND_OPTIONS,
  findInText,
  FIND_QUERY_MAX,
  type FindOptions,
} from '@/lib/find/find-text';
import { findTargets, type FindHeld, type FindTarget } from '@/lib/find/find-targets';
import {
  findMatches,
  firstMatchFrom,
  sameMatchAgain,
  stepMatch,
  type FindMatch,
} from '@/lib/find/find-matches';
import { replaceInTab } from '@/lib/find/find-replace';
import {
  clearFindHighlights,
  publishFindHighlights,
  type FindBlockMark,
  type FindMark,
} from '@/lib/find/find-highlight-store';
import { hugsText, hugTextSize } from '@/lib/text-hug';
import { measureDrawnText } from '@/components/canvas/text-hug-measure';
import { track } from '@/lib/telemetry';
import { findChordOf, seedFromSelection } from './find-shortcut';

// How long typing pauses before the search runs.
export const FIND_DEBOUNCE_MS = 150;
// The longest writing selection taken as the query on opening.
export const FIND_SEED_MAX = 200;

export type FindView = {
  open: boolean;
  replaceOpen: boolean;
  // Whether this person may replace at all (an Editor or a Participant).
  canReplace: boolean;
  query: string;
  setQuery: (q: string) => void;
  by: string;
  setBy: (by: string) => void;
  opts: FindOptions;
  toggleOption: (key: keyof FindOptions) => void;
  setReplaceOpen: (open: boolean) => void;
  // The search as typed has run (the count describes the query in the field).
  searched: boolean;
  count: number;
  capped: boolean;
  index: number | null;
  // Matches this person may not replace, and why the one in hand is held (null when it is not).
  heldCount: number;
  currentHeld: FindHeld;
  // Bumped to put the caret in the Find field (an open, or Cmd/Ctrl+F with the bar open).
  focusSeq: number;
  // Opens the bar (with the Replace row for someone who may replace), as the chords do: the search panel's commands.
  openBar: (withReplace: boolean) => void;
  next: () => void;
  previous: () => void;
  replace: () => void;
  replaceAll: () => void;
  close: () => void;
};

type Deps = {
  activeTab: Tab;
  // The tab's pages in the row (Pages mode's laid out pages).
  pages: readonly LaidOutPage[] | null;
  can: EditorCapabilities;
  // A deck presents or the editor is an embed: the bar does not show, and the chords stay the browser's.
  standsAside: boolean;
  canvasMainRef: RefObject<HTMLElement | null>;
  getView: () => { zoom: number; offset: { x: number; y: number } };
  focusPage: (pageId: string) => void;
  scrollIntoView: (x: number, y: number, w: number, h: number) => void;
  commitActiveTab: (map: (t: Tab) => Tab) => void;
  notify: (message: string) => void;
};

type Search = { query: string; opts: FindOptions; seq: number; from: string | undefined };
type Hand = { key: string; start: number; order: number; seq: number };

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

// The page each block of the tab's mounted articles starts on, as laid out now (one layout read per article).
function laidOutBlockPages(tab: Tab, pages: readonly LaidOutPage[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const flow of Object.keys(articlesOf(tab))) {
    const handle = articleHandleOf(flow);
    if (!handle) continue;
    const own = pages.filter((p) => p.flow === flow);
    handle.blocksByPage().forEach((ids, i) => {
      const page = own[i];
      if (page) for (const id of ids) out.set(id, page.id);
    });
  }
  return out;
}

// Everything typed into the tab's writing written to it now, so a replace finds it and never swaps it blind.
function flushWriting(tab: Tab): void {
  for (const flow of Object.keys(articlesOf(tab))) articleHandleOf(flow)?.flush();
}

export function useFindReplace(deps: Deps): FindView {
  const { activeTab, can, standsAside } = deps;
  const latest = useRef(deps);
  useEffect(() => {
    latest.current = deps;
  });
  const scope = can.replace;
  const canReplace = scope !== false;
  const [open, setOpen] = useState(false);
  const [replaceOpen, setReplaceOpenState] = useState(false);
  const [query, setQueryState] = useState('');
  const [by, setBy] = useState('');
  const [opts, setOpts] = useState<FindOptions>(DEFAULT_FIND_OPTIONS);
  const [focusSeq, setFocusSeq] = useState(0);
  // The search as last run: the query (after the pause) and the options; `seq` counts new searches, and `from` is
  // the page in view as each began (its first match is the first on or after that page).
  const [search, setSearch] = useState<Search>({
    query: '',
    opts: DEFAULT_FIND_OPTIONS,
    seq: 0,
    from: undefined,
  });
  // The match in hand, by its text's key and place (so an edit does not lose it), for the search `seq`.
  const [hand, setHand] = useState<Hand | null>(null);
  const shown = open && !standsAside;

  const pageNow = () => {
    const d = latest.current;
    const main = d.canvasMainRef.current;
    if (!d.pages || !main) return undefined;
    return pageInView(d.pages, d.getView(), { width: main.clientWidth, height: main.clientHeight });
  };
  // A new search of `q` with `o`, from the page in view now.
  const searchNow = (q: string, o: FindOptions) => {
    const from = pageNow();
    setSearch((s) => ({ query: q, opts: o, seq: s.seq + 1, from }));
  };

  // The search runs once typing pauses (options run it at once).
  useEffect(() => {
    if (query === search.query && opts === search.opts) return;
    const timer = window.setTimeout(
      () => searchNow(query, opts),
      opts === search.opts ? FIND_DEBOUNCE_MS : 0,
    );
    return () => window.clearTimeout(timer);
  }, [query, opts, search]);

  const pages = deps.pages;
  // The tab's searched texts, gathered once per change of the tab (never per query), only while the bar shows.
  const targets = useMemo(() => {
    if (!shown || !pages) return null;
    const blockPages = laidOutBlockPages(activeTab, pages);
    return findTargets(activeTab, pages, {
      scope,
      blockPage: (_flow, blockId) => blockPages.get(blockId),
    });
  }, [shown, pages, activeTab, scope]);
  // The matches, found again as the search or the tab changes.
  const found = useMemo(() => {
    if (!targets || search.query === '') return null;
    const { matches, capped } = findMatches(targets, search.query, search.opts);
    debugLog('[find] searched', { targets: targets.length, matches: matches.length });
    return { targets, matches, capped, seq: search.seq };
  }, [targets, search]);

  // The match in hand: on a new search, the first on or after the page it began on; after an edit (or a step), the
  // one held by key and place, else the next.
  const index = useMemo(() => {
    if (!found) return null;
    if (!hand || hand.seq !== found.seq) {
      const order = (pages ?? []).map((p) => p.id);
      return firstMatchFrom(found.matches, found.targets, order, search.from);
    }
    return sameMatchAgain(hand, found.matches, found.targets);
  }, [found, hand, pages, search.from]);

  // Brings a match into view: its page framed when it is another page (a flashcard turned), else the least pan.
  const goTo = (match: FindMatch, targets: readonly FindTarget[]) => {
    const d = latest.current;
    const target = targets[match.target];
    if (!target || !d.pages) return;
    let rect: { x: number; y: number; w: number; h: number } | null = null;
    if (target.ref.kind === 'block') {
      rect =
        articleHandleOf(target.ref.flow)?.rangeRect(target.ref.blockId, match.start, match.end) ??
        null;
    } else {
      const id = target.ref.id;
      const el = d.activeTab.elements.find((e) => e.id === id);
      if (el) {
        const b = elementBounds(el, d.activeTab.elements);
        rect = { x: b.x, y: b.y, w: b.width, h: b.height };
      }
    }
    const pageId =
      (rect && rowPageAt(d.pages, { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 })?.id) ??
      target.pageId;
    if (pageId !== pageNow()) d.focusPage(pageId);
    else if (rect) d.scrollIntoView(rect.x, rect.y, rect.w, rect.h);
  };

  const hold = (i: number | null) => {
    const m = found && i !== null ? found.matches[i] : undefined;
    setHand(
      m && found
        ? { key: found.targets[m.target]!.key, start: m.start, order: m.target, seq: found.seq }
        : null,
    );
  };

  // A new search goes to its first match (once: an edit after keeps the view where it is).
  const wentTo = useRef(-1);
  useEffect(() => {
    if (!found || found.seq === wentTo.current) return;
    wentTo.current = found.seq;
    if (index !== null) goTo(found.matches[index]!, found.targets);
  }, [found, index]);

  // What the painters draw: every match, the one in hand, and (while replacing) the held ones.
  useEffect(() => {
    if (!found || !shown) {
      clearFindHighlights();
      return;
    }
    const flows = new Map<string, FindBlockMark[]>();
    const elements = new Map<string, FindMark>();
    const rank: Record<FindMark, number> = { held: 0, match: 1, current: 2 };
    found.matches.forEach((m, i) => {
      const target = found.targets[m.target]!;
      const mark: FindMark =
        i === index ? 'current' : replaceOpen && target.held !== null ? 'held' : 'match';
      const ref = target.ref;
      if (ref.kind === 'block') {
        let list = flows.get(ref.flow);
        if (!list) flows.set(ref.flow, (list = []));
        list.push({ blockId: ref.blockId, from: m.start, to: m.end, mark });
      } else {
        const was = elements.get(ref.id);
        if (!was || rank[mark] > rank[was]) elements.set(ref.id, mark);
      }
    });
    publishFindHighlights({ flows, elements });
  }, [found, index, replaceOpen, shown]);
  useEffect(() => () => clearFindHighlights(), []);

  const openBar = (withReplace: boolean) => {
    const seed = seedFromSelection(FIND_SEED_MAX);
    if (!open) {
      track('UI', 'Opened', 'FindBar');
      // Searched again as it opens: a new search, from the page in view.
      searchNow(search.query, search.opts);
    }
    setOpen(true);
    if (withReplace && canReplace) setReplaceOpenState(true);
    if (seed) setQueryState(seed.slice(0, FIND_QUERY_MAX));
    setFocusSeq((n) => n + 1);
  };
  const openRef = useRef(openBar);
  useEffect(() => {
    openRef.current = openBar;
  });

  // The chords, while the document has the keyboard; everywhere else they stay the browser's.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const chord = findChordOf(e, {
        standsAside: latest.current.standsAside || anyModalOpen(),
      });
      if (!chord) return;
      e.preventDefault();
      e.stopPropagation();
      openRef.current(chord === 'replace');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const step = (by: 1 | -1) => {
    // Enter before the pause runs the search at once (it goes to its first match itself).
    if (query !== search.query || opts !== search.opts) {
      searchNow(query, opts);
      return;
    }
    if (!found) return;
    const i = stepMatch(index, found.matches.length, by);
    hold(i);
    if (i !== null) goTo(found.matches[i]!, found.targets);
  };

  // The tab's texts as they are inside a commit, and this person's text-box refit.
  const targetsOf = (t: Tab) => findTargets(t, layOutPages(pagesOf(t)), { scope });
  const refit = () => {
    const measure = measureDrawnText(activeTab.font, activeTab.finish);
    return (el: Element) => (hugsText(el) ? { ...el, ...hugTextSize(el, measure(el)) } : el);
  };

  // One match swapped in `t`, when its words are still where they were found (an edit since may have moved them).
  const replaceOneIn = (t: Tab, key: string, match: FindMatch, fit: (el: Element) => Element) => {
    const { query: q, opts: o } = search;
    const targets = targetsOf(t);
    const at = targets.findIndex((x) => x.key === key);
    if (at < 0 || !findInText(targets[at]!.text, q, o).includes(match.start)) return null;
    return replaceInTab(t, targets, [{ target: at, start: match.start, end: match.end }], by, fit);
  };
  // Every match in `t`, found again from it as it is, uncapped.
  const replaceAllIn = (t: Tab, fit: (el: Element) => Element) => {
    const targets = targetsOf(t);
    const { matches } = findMatches(targets, search.query, search.opts, Number.POSITIVE_INFINITY);
    return replaceInTab(t, targets, matches, by, fit);
  };

  // Each replace decides from the tab as this handler sees it, then commits that result (or works it out again on a
  // tab changed since, as by the writing just flushed): docs/specs/003-system-architecture/react-state-and-effects.md.
  const replace = () => {
    if (!found || index === null || !canReplace) return;
    const match = found.matches[index]!;
    const target = found.targets[match.target]!;
    if (target.held !== null) return;
    flushWriting(activeTab);
    const fit = refit();
    const seen = activeTab;
    const out = replaceOneIn(seen, target.key, match, fit);
    if (!out || out.count === 0) return;
    deps.commitActiveTab((t) =>
      t === seen ? out.tab : (replaceOneIn(t, target.key, match, fit)?.tab ?? t),
    );
    track('UI', 'Used', 'FindReplace');
    debugLog('[find] replaced', { count: 1, held: 0 });
    // On to the next match: the one after the new words.
    setHand({
      key: target.key,
      start: match.start + by.length,
      order: match.target,
      seq: found.seq,
    });
  };

  const replaceAll = () => {
    if (!found || !canReplace) return;
    flushWriting(activeTab);
    const fit = refit();
    const seen = activeTab;
    const out = replaceAllIn(seen, fit);
    deps.commitActiveTab((t) => (t === seen ? out.tab : replaceAllIn(t, fit).tab));
    debugLog('[find] replaced', { count: out.count, held: out.held });
    if (out.count > 0) track('UI', 'Used', 'FindReplaceAll');
    const done = `Replaced ${plural(out.count, 'match', 'matches')}`;
    deps.notify(
      out.held > 0
        ? `${done}. ${plural(out.held, 'match', 'matches')} in text you can't edit ${out.held === 1 ? 'was' : 'were'} left as ${out.held === 1 ? 'it is' : 'they are'}.`
        : `${done}.`,
    );
  };

  const close = () => {
    setOpen(false);
    clearFindHighlights();
    const main = latest.current.canvasMainRef.current;
    if (main && main.tabIndex >= 0) main.focus({ preventScroll: true });
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };

  const count = found?.matches.length ?? 0;
  const heldCount = found
    ? found.matches.filter((m) => found.targets[m.target]!.held !== null).length
    : 0;
  const current = found && index !== null ? found.matches[index] : undefined;
  return {
    open: shown,
    replaceOpen: replaceOpen && canReplace,
    canReplace,
    query,
    setQuery: (q) => setQueryState(q.slice(0, FIND_QUERY_MAX)),
    by,
    setBy,
    opts,
    toggleOption: (key) => setOpts((o) => ({ ...o, [key]: !o[key] })),
    setReplaceOpen: (v) => setReplaceOpenState(v && canReplace),
    searched: query === search.query && opts === search.opts,
    count,
    capped: found?.capped ?? false,
    index,
    heldCount,
    currentHeld: current ? found!.targets[current.target]!.held : null,
    focusSeq,
    openBar,
    next: () => step(1),
    previous: () => step(-1),
    replace,
    replaceAll,
    close,
  };
}
