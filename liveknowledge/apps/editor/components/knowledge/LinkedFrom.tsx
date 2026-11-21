'use client';

// Linked From, at the foot of a page (docs/specs/030-knowledgebase/links-and-embeds.md "Backlinks"): the pages whose
// writing links here, as chips, in tree order. Absent when there are none: no heading, no empty state. Read when the
// page opens, and again once this editor has saved a change to the page's own links; never per keystroke.
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { KnowledgeBacklink } from '@liveknowledge/api-schema';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { sameTabsForBar } from '@/app/document/[id]/editor-view-bars';
import { selectPage } from '@/components/page-tree/select-page';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { LINKS_SETTLE_MS, backlinksStore, linkTargetsKey } from '@/lib/knowledge/backlinks-store';
import { track } from '@/lib/telemetry';

export function LinkedFromView({
  backlinks,
  onOpen,
}: {
  backlinks: readonly KnowledgeBacklink[];
  onOpen: (page: string) => void;
}) {
  if (backlinks.length === 0) return null;
  return (
    <nav
      aria-label="Linked From"
      data-linked-from=""
      className="border-b border-slate-200 pb-5 font-sans motion-safe:animate-fade-in dark:border-slate-800"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Linked From {backlinks.length} {backlinks.length === 1 ? 'Page' : 'Pages'}
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {backlinks.map((link) => (
          <li key={link.tab}>
            <a
              // The page's own address, so the chip opens in a new tab too; a plain press opens it here.
              href={`#t=${encodeURIComponent(link.tab)}`}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                onOpen(link.tab);
              }}
              className="inline-flex max-w-64 cursor-pointer items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[13px] font-medium leading-5 text-slate-700 no-underline motion-safe:transition-colors motion-safe:duration-micro hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-600 phone:min-h-11 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              title={link.title || 'Untitled Page'}
            >
              {/* The ellipsis is the text's own: a flex box does not draw one for its bare text. */}
              <span className="min-w-0 truncate">{link.title || 'Untitled Page'}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const NONE: readonly KnowledgeBacklink[] = [];

/** The current page's Linked From, from the editor's store. */
export function LinkedFrom() {
  const chrome = useEditorChromeStore();
  const documentId = useEditorChrome((s) => s.documentId);
  const pageId = useEditorChrome((s) => s.activeId);
  const offline = useIsOfflineDocument(documentId);
  // The pages this page links to, from its committed blocks: it moves on a commit that changed a link, no other.
  const links = useEditorChrome((s) =>
    linkTargetsKey(Object.values(s.activeTab.articles ?? {})[0]?.blocks),
  );
  const tabs = useEditorChrome((s) => s.tabs, sameTabsForBar);
  const backlinks = useSyncExternalStore(
    backlinksStore.subscribe,
    () => (documentId ? backlinksStore.of(documentId, pageId) : NONE),
    () => NONE,
  );
  // Read when the page opens.
  useEffect(() => {
    if (!documentId || offline) return;
    const editor = chrome.get();
    void backlinksStore.load(
      { ownerId: editor.selfParticipant.id, shareCode: editor.sessionShareCode },
      documentId,
      pageId,
    );
  }, [chrome, documentId, pageId, offline]);
  // Read again once a commit that changed this page's links has been saved (the link table moved with it). The
  // links a page opens with are no change.
  const seen = useRef({ pageId, links });
  useEffect(() => {
    const was = seen.current;
    seen.current = { pageId, links };
    if (!documentId || offline || was.pageId !== pageId || was.links === links) return;
    const timer = window.setTimeout(() => {
      const editor = chrome.get();
      void backlinksStore.load(
        { ownerId: editor.selfParticipant.id, shareCode: editor.sessionShareCode },
        documentId,
        pageId,
      );
    }, LINKS_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [chrome, documentId, pageId, offline, links]);
  // Each chip says its page's title as it is now; a page deleted since the read has no chip.
  const shown = useMemo(
    () =>
      backlinks.flatMap((link) => {
        const tab = tabs.find((t) => t.id === link.tab);
        return tab ? [{ tab: link.tab, title: tab.name }] : [];
      }),
    [backlinks, tabs],
  );
  return (
    <LinkedFromView
      backlinks={shown}
      onOpen={(page) => {
        track('UI', 'Used', 'Backlink');
        selectPage(chrome.get(), page);
      }}
    />
  );
}
