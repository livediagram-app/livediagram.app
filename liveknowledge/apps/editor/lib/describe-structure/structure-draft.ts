// A drafted structure put into the page's draft (docs/specs/030-knowledgebase/describe-to-set-up.md "Describe
// Structure on a page", "What it writes"): at the top, under the Title, through the same commit the writing's own
// edits take, so it lands in the draft (the edit lens) and is one undo step. Never saved here: Save or Cancel on the
// bar decide, as for any edit.
import {
  articlesOf,
  nextArticleBlockId,
  savedFlowOf,
  withArticleFlow,
  type ArticleBlock,
} from '@liveknowledge/document';
import { pageStructureArticleBlocks, type PageStructureBlock } from '@liveknowledge/knowledge';
import type { EditorChromeStore } from '@/app/document/[id]/EditorContext';
import { articleHandleOf } from '@/lib/article/article-editor-store';

const isEmptyLine = (block: ArticleBlock): boolean =>
  block.type === 'paragraph' &&
  block.style !== 'title' &&
  block.style !== 'subtitle' &&
  block.runs.every((run) => !run.text.trim());

/**
 * The page's blocks with `structure` at the top: after its Title (and subtitle) and before anything else. Empty lines
 * are dropped when nothing else is there (the page was empty); writing someone typed meanwhile is kept under it. An
 * empty line ends the page, for the caret.
 */
export function withStructureAtTop(
  blocks: readonly ArticleBlock[],
  structure: readonly ArticleBlock[],
  newId: () => string,
): ArticleBlock[] {
  const head = blocks.filter(
    (b) => b.type === 'paragraph' && (b.style === 'title' || b.style === 'subtitle'),
  );
  const rest = blocks.filter((b) => !head.includes(b));
  const kept = rest.every(isEmptyLine) ? [] : rest;
  return [...head, ...structure, ...kept, { id: newId(), type: 'paragraph', runs: [] }];
}

/** Puts the structure into the open page's draft, entering edit mode first if it has ended meanwhile. False when the
 *  page is no longer the one open, or has no writing to put it in. */
export function putStructureInDraft(
  chrome: EditorChromeStore,
  tabId: string,
  structure: readonly PageStructureBlock[],
): boolean {
  const now = chrome.get();
  if (now.pageTab.id !== tabId || !now.pageEditing.mayEdit) return false;
  if (!now.pageEditing.editing) now.pageEditing.start();
  const flow = savedFlowOf(chrome.get().pageTab);
  if (!flow || !articlesOf(chrome.get().pageTab)[flow]) return false;
  // What is typed lands first, so the structure goes in over the writing as it is now.
  const handle = articleHandleOf(flow);
  handle?.flush();
  const typed = handle?.takeBlocks();
  chrome.get().commitTabs((tabs) =>
    tabs.map((tab) => {
      if (tab.id !== tabId) return tab;
      const doc = articlesOf(tab)[flow];
      if (!doc) return tab;
      const base = typed ?? doc.blocks;
      const taken = new Set(base.map((b) => b.id));
      const newId = () => {
        const id = nextArticleBlockId(taken);
        taken.add(id);
        return id;
      };
      const blocks = withStructureAtTop(base, pageStructureArticleBlocks(structure, newId), newId);
      return withArticleFlow(tab, flow, { ...doc, blocks });
    }),
  );
  return true;
}
