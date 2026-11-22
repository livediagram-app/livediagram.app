'use client';

// The current page's Health Score (docs/specs/030-knowledgebase/verification.md "In Page Health"), worked out by
// the knowledge package's `pageHealth`, the function the api runs for agents, from what the editor already holds:
// the page's trust, the saved writing's shape (read as primitives, so a typing commit inside a band renders
// nothing) and Page Health's read. No request of its own. The fixes are the ones this person may make.
import { useCallback, useMemo } from 'react';
import { savedArticleOf } from '@liveknowledge/document';
import { pageHealth, type PageHealthScore } from '@liveknowledge/knowledge';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { articleHandleOf } from '@/lib/article/article-editor-store';
import { pageHealthFacts, pageShapeOf, sameShape } from '@/lib/knowledge/page-health-facts';
import { track } from '@/lib/telemetry';
import type { PageHealthFixes } from './PageHealthScore';
import type { PageKnowledgeView } from './usePageKnowledge';

/** How many frames Add a Heading waits for the writing to open for editing. */
const HANDLE_FRAMES = 30;

/** The Owner picker in this Page Health: focused, and opened where the browser can. */
function openOwnerPicker(from: HTMLElement | null): void {
  const select = (from?.closest('[data-page-health]') ?? document).querySelector<HTMLSelectElement>(
    'select[aria-label="Owner"]',
  );
  if (!select) return;
  select.focus();
  try {
    select.showPicker?.();
  } catch {
    // A browser that cannot open it from here leaves it focused.
  }
}

export function usePageHealthScore(page: PageKnowledgeView): {
  health: PageHealthScore;
  fixes: PageHealthFixes;
  offline: boolean;
} {
  const chrome = useEditorChromeStore();
  const documentId = useEditorChrome((s) => s.documentId);
  const offline = useIsOfflineDocument(documentId);
  const shape = useEditorChrome(
    (s) => pageShapeOf(savedArticleOf(s.pageTab)?.blocks, s.tabs),
    sameShape,
  );
  const mayWrite = useEditorChrome((s) => s.pageEditing.mayEdit);
  const { trust, reviewEvery, health: read, now, rights, verify, pageId } = page;
  const health = useMemo(
    () => pageHealth(pageHealthFacts(trust, reviewEvery, shape, read), now),
    [trust, reviewEvery, shape, read, now],
  );
  const addHeading = useCallback(() => {
    track('UI', 'Used', 'HealthAddHeading');
    const editing = chrome.get().pageEditing;
    if (!editing.editing) editing.start();
    let frames = 0;
    // The schema loads with the writing's editor, never on the page's first load (document-lazy-load.test.ts).
    void import('@/lib/article/article-schema').then(({ articleSchema }) => {
      const tryInsert = () => {
        const flow = Object.keys(chrome.get().activeTab.articles ?? {})[0];
        const handle = flow ? articleHandleOf(flow) : undefined;
        if (handle) {
          handle.focus();
          handle.insert([articleSchema.nodes.paragraph.create({ style: 'h2' })]);
          return;
        }
        if (++frames < HANDLE_FRAMES) requestAnimationFrame(tryInsert);
      };
      requestAnimationFrame(tryInsert);
    });
  }, [chrome]);
  const fixes = useMemo<PageHealthFixes>(
    () => ({
      ...(rights.verify ? { verify: () => verify(pageId) } : {}),
      ...(rights.editFields
        ? {
            owner: () =>
              openOwnerPicker(
                document.activeElement instanceof HTMLElement ? document.activeElement : null,
              ),
          }
        : {}),
      ...(mayWrite ? { heading: addHeading } : {}),
    }),
    [rights.verify, rights.editFields, verify, pageId, mayWrite, addHeading],
  );
  return { health, fixes, offline };
}
