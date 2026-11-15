'use client';

// The tab's pages, for the link markers (docs/specs/007-editor/wireframe-pages.md "Setting a link"). Held in a store
// rather than a context value: a marker subscribes with its own description line as the snapshot, so a page edit (a
// rename, a delete, the pages laid out again on every editor render) re-renders only the elements whose line changed,
// never every element on the canvas.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  describeScreenLink,
  isScreenLink,
  resolveScreenLink,
  type Element,
  type Page,
} from '@livedesign/design';

type PagesStoreFields = {
  pages: readonly Page[];
  focusPage: ((pageId: string) => void) | undefined;
  // Opens Link Element on its Screen mode, for whoever may link the element (a broken marker's press).
  pick: ((elementId: string) => void) | undefined;
  canLink: ((el: Element) => boolean) | undefined;
};

type PagesStore = PagesStoreFields & {
  listeners: Set<() => void>;
  // Takes the provider's latest props; the markers read them when they next render or are told.
  take: (fields: PagesStoreFields) => void;
  tell: () => void;
};

function createPagesStore(): PagesStore {
  const store: PagesStore = {
    pages: [],
    focusPage: undefined,
    pick: undefined,
    canLink: undefined,
    listeners: new Set(),
    take: (fields) => void Object.assign(store, fields),
    tell: () => {
      for (const listener of store.listeners) listener();
    },
  };
  return store;
}

const ScreenLinkPagesContext = createContext<PagesStore | null>(null);

export function ScreenLinkPagesProvider({
  pages,
  focusPage,
  pick,
  canLink,
  children,
}: {
  pages: readonly Page[] | undefined;
  focusPage: ((pageId: string) => void) | undefined;
  pick?: (elementId: string) => void;
  canLink?: (el: Element) => boolean;
  children: ReactNode;
}) {
  // One store for the provider's life: its fields move with each render, its identity never does.
  const [store] = useState(createPagesStore);
  // Read during this render by the markers below it, so their first paint is already right; the effect tells the
  // markers that rendered before it (a page renamed while nothing else changed).
  store.take({ pages: pages ?? [], focusPage, pick, canLink });
  useEffect(() => store.tell(), [store, pages]);
  return (
    <ScreenLinkPagesContext.Provider value={store}>{children}</ScreenLinkPagesContext.Provider>
  );
}

const noSubscribe = () => () => {};

// What a marker says and does: the line its hover card reads, the link's state, and its press: a linked marker
// brings its screen into view, a broken one opens the Screen mode for whoever may link the element, a back link's
// does nothing (its hover card says where it goes).
export type ScreenLinkMarker = {
  description: string;
  state: 'page' | 'back' | 'broken';
  press: () => void;
};

/** An element's link marker, or null when its link is not a screen link (or no pages are on hand). */
export function useScreenLinkMarker(element: Element): ScreenLinkMarker | null {
  const store = useContext(ScreenLinkPagesContext);
  const link = element.link;
  const screen = isScreenLink(link) ? link : null;
  const listens = !!store && !!screen;
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!store) return () => {};
      store.listeners.add(listener);
      return () => void store.listeners.delete(listener);
    },
    [store],
  );
  // A string snapshot (stable by value), so an unchanged line renders nothing.
  const description = useSyncExternalStore(
    listens ? subscribe : noSubscribe,
    () => (store && screen ? describeScreenLink(screen, store.pages) : null),
    () => null,
  );
  if (!store || !screen || description === null) return null;
  const state = resolveScreenLink(screen, store.pages).state;
  return {
    description,
    state,
    press: () => {
      const now = resolveScreenLink(screen, store.pages);
      if (now.state === 'page') store.focusPage?.(now.page.id);
      else if (now.state === 'broken' && store.canLink?.(element)) store.pick?.(element.id);
    },
  };
}
