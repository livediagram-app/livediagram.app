'use client';

// The host, from what every canvas editor already has (liveworkspace/docs/specs/006-media/walkthroughs.md "One package,
// four apps"): its api funnel, its viewport store, its tabs, the tab selector, its selection and, in livediagram and
// livedocuments, its slide deck. Each editor calls this once with its own values; nothing here knows an app.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { WalkthroughApiDeps } from './api';
import { CONTENT_SELECTOR } from './bridge';
import type {
  WalkthroughHideable,
  WalkthroughHost,
  WalkthroughSlides,
  WalkthroughViewport,
} from './host';
import { fingerprintOf } from './timeline';

export type EditorTab = { id: string; name: string; elements?: readonly unknown[] };

/** The slide deck as livediagram's and livedocuments' useSlideDeck give it. */
export type SlideDeckLike = {
  runnable: readonly { slide: { id: string; name?: string | undefined }; index: number }[];
  presentingAt: number | null;
  setPresentingAt: (at: number | null) => void;
  start: (fromSlideId?: string) => unknown;
  exitPresentation: () => void;
};

/** A deck as the walkthroughs drive it: the slide showing, and showing one (starting the deck) or leaving it. */
export function slidesOfDeck(deck: SlideDeckLike): WalkthroughSlides {
  const at = deck.presentingAt === null ? null : (deck.runnable[deck.presentingAt] ?? null);
  return {
    current: at?.slide.id ?? null,
    label: at ? (at.slide.name ?? `Slide ${at.index + 1}`) : null,
    show: (slide) => {
      if (slide === null) return deck.exitPresentation();
      const index = deck.runnable.findIndex((r) => r.slide.id === slide);
      if (index < 0) return;
      if (deck.presentingAt === null) void deck.start(slide);
      else deck.setPresentingAt(index);
    },
  };
}

export type WalkthroughHostInput = {
  // The open item; null wherever walkthroughs don't fit (the editor says where).
  itemId: string | null;
  apiBase: string;
  // The app's api funnel (it adds the item's grant; `uploadProgress` sends by XMLHttpRequest to report bytes sent),
  // and the caller's identity headers.
  apiFetch: WalkthroughApiDeps['fetch'];
  apiHeaders: () => Promise<HeadersInit>;
  viewport: WalkthroughViewport;
  tabs: readonly EditorTab[];
  activeTab: string;
  selectTab: (tab: string) => void;
  slides?: WalkthroughSlides | undefined;
  selection: () => Iterable<string>;
  author: string | null;
  // What the app can hide besides canvas elements (host.ts); absent in the apps that hide canvas elements alone.
  hideable?: WalkthroughHideable | undefined;
};

// The element around the canvas content: where the pointer moves and the viewer pans.
const canvasRoot = () => document.querySelector(CONTENT_SELECTOR)?.parentElement ?? null;

export function useWalkthroughHost(input: WalkthroughHostInput): WalkthroughHost {
  const latest = useRef(input);
  useEffect(() => {
    latest.current = input;
  });
  const { apiBase } = input;
  // Stable for the item's life, so the list isn't fetched again on every render; each call reads the latest funnel.
  const api = useMemo<WalkthroughApiDeps>(
    () => ({
      base: apiBase,
      fetch: async (url, init, opts) => {
        const headers = new Headers(await latest.current.apiHeaders());
        new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
        return latest.current.apiFetch(url, { ...init, headers }, opts);
      },
    }),
    [apiBase],
  );
  const tabName = useCallback(
    (tab: string) => latest.current.tabs.find((t) => t.id === tab)?.name ?? 'this tab',
    [],
  );
  const showTab = useCallback((tab: string) => {
    if (!latest.current.tabs.some((t) => t.id === tab)) return false;
    if (latest.current.activeTab !== tab) latest.current.selectTab(tab);
    return true;
  }, []);
  // A tab not loaded yet has no elements to read: unknown, not changed.
  const fingerprint = useCallback((tab: string) => {
    const found = latest.current.tabs.find((t) => t.id === tab);
    if (!found) return null;
    return found.elements && found.elements.length > 0 ? fingerprintOf(found.elements) : undefined;
  }, []);
  const selection = useCallback(() => [...latest.current.selection()], []);
  const elements = useCallback(
    () => latest.current.tabs.find((t) => t.id === latest.current.activeTab)?.elements ?? [],
    [],
  );
  return {
    itemId: input.itemId,
    api,
    viewport: input.viewport,
    canvasRoot,
    tab: input.activeTab,
    tabName,
    showTab,
    slides: input.slides,
    fingerprint,
    selection,
    author: input.author,
    hideable: input.hideable,
    elements,
  };
}
