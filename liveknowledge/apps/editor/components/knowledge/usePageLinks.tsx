'use client';

// Page links in one article's writing (docs/specs/030-knowledgebase/links-and-embeds.md "Page links"): the plugin
// that opens the picker on `[[` and follows a press, the picker itself (the slash menu's popover over the
// knowledgebase's pages, Create Page at its foot), the rules that make every link read as its page's current title,
// and the hover card. Inserting is an Editor's; following a link and its hover card are everyone's.
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react';
import type { Plugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { EditorChromeContext, type EditorChromeStore } from '@/app/document/[id]/EditorContext';
import { SlashMenu } from '@/components/canvas/article/SlashMenu';
import { selectPage } from '@/components/page-tree/select-page';
import type { SlashItem } from '@/lib/article/article-slash-items';
import { modelOf, sectionsOfItems } from '@/lib/article/slash-menu-model';
import { pageOfPastedUrl, pagePickItems } from '@/lib/knowledge/page-link-pick';
import {
  openPageLinkPicker,
  pageLinkPlugin,
  pickPageLink,
  type PageLinkBridge,
  type PageLinkQuery,
} from '@/lib/knowledge/page-link-plugin';
import {
  installPageLinkTitles,
  linkedPagesKey,
  pageLinkCss,
  trashedLinkCss,
} from '@/lib/knowledge/page-link-titles';
import {
  openPageTrash,
  pageTrashStore,
  trashedIds,
  usePageTrashState,
} from '@/lib/knowledge/page-trash-store';
import { track } from '@/lib/telemetry';
import { PageLinkHoverCard } from './PageLinkHoverCard';

const noSubscribe = () => () => {};
const NO_ITEMS: SlashItem[] = [];

type Picker = {
  query: string;
  at: { left: number; top: number; bottom: number };
  // What the picker lists for the query, read from the page list when the query changed.
  items: SlashItem[];
};

export type PageLinks = {
  /** The writing's plugin, made by the writing's mount (never in render). */
  makePlugin: () => Plugin;
  /** The picker and the hover card. */
  element: ReactNode;
  /** The slash menu's Link to Page. */
  openPicker: (view: EditorView) => void;
};

// Every link reads as its page's current title: one set of rules for the page list, written again only when a
// page's id or name changed (a typing commit changes neither).
// A page in the Trash reads "In the Trash" (knowledgebases-and-pages.md "The page Trash"), its ids from the Trash as
// this session last read it.
function usePageLinkTitles(store: EditorChromeStore | null): void {
  const key = useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => (store ? linkedPagesKey(store.get().tabs) : ''),
    () => '',
  );
  const trashed = usePageTrashState().pages;
  useEffect(() => {
    if (store)
      installPageLinkTitles(pageLinkCss(store.get().tabs) + trashedLinkCss(trashedIds(trashed)));
  }, [store, key, trashed]);
}

export function usePageLinks(
  viewRef: RefObject<EditorView | null>,
  // Whether this session may put a link in: an Editor writing.
  canInsert: boolean,
): PageLinks {
  // A page drawn outside the editor (a test, a preview) has no store: links still draw, the picker lists nothing.
  const store = useContext(EditorChromeContext);
  usePageLinkTitles(store);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [index, setIndex] = useState(0);
  const items = picker?.items ?? NO_ITEMS;
  const pick = (item: SlashItem) => {
    const view = viewRef.current;
    const now = store?.get();
    if (!view || !now) return;
    const a = item.action;
    if (a.kind === 'page') {
      track('Element', 'Added', 'PageLink');
      pickPageLink(view, a.page, a.title);
    } else if (a.kind === 'create-page') {
      // A subpage of the page being written, named as typed, and linked; the writer stays where they are.
      const made = now.addNamedSubpage(now.activeId, a.title);
      if (made) {
        track('Element', 'Added', 'PageLinkNewPage');
        pickPageLink(view, made, a.title);
      }
    }
    view.focus();
  };
  // The plugin is made once; what it calls reads the newest render through this.
  const live = useRef({ items, index, pick, canInsert, store });
  useLayoutEffect(() => {
    live.current = { items, index, pick, canInsert, store };
  });
  const makePlugin = useCallback((): Plugin => {
    const bridge: PageLinkBridge = {
      onChange: (state: PageLinkQuery, view) => {
        const now = live.current.store?.get();
        if (!state.active || !now) return setPicker(null);
        try {
          const c = view.coordsAtPos(state.from);
          const listed = pagePickItems(now.tabs, state.query, {
            exclude: now.activeId,
            canCreate: now.can.editPages && !now.isStructureReadOnly,
          });
          setPicker((was) => {
            if (was?.query !== state.query) setIndex(0);
            return {
              query: state.query,
              at: { left: c.left, top: c.top, bottom: c.bottom },
              items: listed,
            };
          });
        } catch {
          setPicker(null);
        }
      },
      onKey: (key) => {
        const { items: now, index: at, pick: choose } = live.current;
        if (now.length === 0) return false;
        if (key === 'down') setIndex((at + 1) % now.length);
        else if (key === 'up') setIndex((at - 1 + now.length) % now.length);
        else choose(now[at] ?? now[0]!);
        return true;
      },
      onOpen: (page) => {
        const now = live.current.store?.get();
        if (!now) return;
        if (!now.tabs.some((t) => t.id === page)) {
          // A link to a page in the Trash opens the Trash at it, for a session that may restore it; a link to a page
          // that is gone goes nowhere.
          if (pageTrashStore.holds(page)) {
            track('UI', 'Opened', 'PageTrash');
            openPageTrash(page);
          }
          return;
        }
        track('UI', 'Used', 'PageLink');
        selectPage(now, page);
      },
      pageOfUrl: (text) => {
        const now = live.current.store?.get();
        if (!now?.documentId) return undefined;
        return pageOfPastedUrl(text, {
          origin: window.location.origin,
          documentId: now.documentId,
          pages: now.tabs,
        });
      },
      canInsert: () => live.current.canInsert,
    };
    return pageLinkPlugin(bridge);
  }, []);
  const shown = Math.min(index, Math.max(0, items.length - 1));
  // The pages as the menu's sections (a run of Pages, then New): worked out only when the list changes.
  const model = useMemo(() => modelOf(sectionsOfItems(items)), [items]);
  return {
    makePlugin,
    openPicker: openPageLinkPicker,
    element: (
      <>
        {picker && canInsert ? (
          <SlashMenu
            at={picker.at}
            model={model}
            preview={false}
            query={picker.query}
            index={shown}
            onPick={pick}
            onHover={setIndex}
            label="Link to a page"
            things="pages"
          />
        ) : null}
        {store ? <PageLinkHoverCard viewRef={viewRef} store={store} /> : null}
      </>
    ),
  };
}
