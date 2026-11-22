'use client';

import { useBrowserTabTitle } from '@liveworkspace/workbench/hooks/editor/useBrowserTabTitle';
import { useLivePageTitle } from '@/lib/article/live-page-title';

// The browser tab's title on a knowledgebase (owner, 2026-11-21): "<page> | <knowledgebase> | liveknowledge", the page
// left out while it has no name (still loading).
export function knowledgeTabTitle(page: string | null | undefined, knowledgebase: string): string {
  const named = page?.trim();
  return named ? `${named} | ${knowledgebase} | liveknowledge` : `${knowledgebase} | liveknowledge`;
}

/** While the open page's Title is being typed, the tab names the page from it, as the tree does (editing.md "The
 *  page's name while editing"); it holds nothing otherwise, leaving the editor page's own title. A component of its
 *  own, so a keystroke in the Title renders it alone, never the editor page. */
export function LivePageTabTitle({ knowledgebase }: { knowledgebase: string }): null {
  const live = useLivePageTitle(true);
  useBrowserTabTitle(live === null ? null : knowledgeTabTitle(live, knowledgebase));
  return null;
}
