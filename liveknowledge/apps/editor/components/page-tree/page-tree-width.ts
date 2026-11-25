'use client';

// The page tree's width (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page tree"): the shared sidebar
// rule (liveworkspace/docs/specs/011-workbench/sidebar-width.md) over the tree's 264 px base, kept in this browser.
// The sidebar, its handle and the chrome beside it (usePageTreeChrome) read the same store.
import {
  useSidebarWidth,
  type SidebarWidth,
} from '@liveworkspace/workbench/hooks/ui/useSidebarWidth';
import { PAGE_TREE_WIDTH } from './page-tree-view';

/** Where this browser keeps the width the person dragged the tree to. */
export const PAGE_TREE_WIDTH_KEY = 'liveknowledge:v2:page-tree-width';

export function usePageTreeWidth(): SidebarWidth {
  return useSidebarWidth(PAGE_TREE_WIDTH_KEY, PAGE_TREE_WIDTH);
}
