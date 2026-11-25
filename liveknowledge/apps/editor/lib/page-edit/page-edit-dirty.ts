// Whether leaving edit mode loses anything (docs/specs/030-knowledgebase/editing.md "Cancel"; blueprint
// blueprints/editing.md "Errors and edge cases"): the writing the article editor holds, taken through the same lenses
// every commit passes, and the draft that would leave asked whether it says anything the saved page does not. The
// editor hands its writing back as it draws it, so in the narrow view a picture fitted to the narrow column comes back
// at the narrow size: compared with the saved writing directly it would read as a change on every page with a wide
// picture (Work Tracker 1432). Lowered, a zone within a px of its drawn size is its stored size again. Pure.
import {
  articlesOf,
  draftDiffers,
  sameArticleValue,
  withArticleFlow,
  type ArticleBlock,
  type Tab,
} from '@liveknowledge/document';

type MapTabs = (ts: Tab[]) => Tab[];

/** The map a flush commits: the page's writing as the editor holds it, the same tabs when it is already that. */
export function withTypedWriting(tabId: string, flow: string, typed: ArticleBlock[]): MapTabs {
  return (ts) => {
    let changed = false;
    const out = ts.map((t) => {
      if (t.id !== tabId) return t;
      const doc = articlesOf(t)[flow];
      if (!doc || sameArticleValue(doc.blocks, typed)) return t;
      changed = true;
      return withArticleFlow(t, flow, { ...doc, blocks: typed });
    });
    return changed ? out : ts;
  };
}

/**
 * Whether the page `tabId` holds unsaved changes once the writing the editor holds (`typed`, null when it holds none)
 * lands: the flush's map run through `through` (the commit's lenses, through-lens.ts) over the stored tabs, and the
 * draft that comes back compared with the saved page.
 */
export function pageEditDirty(
  tabs: Tab[],
  tabId: string,
  flow: string | null | undefined,
  typed: ArticleBlock[] | null,
  through: (map: MapTabs) => MapTabs,
): boolean {
  const after = flow && typed ? through(withTypedWriting(tabId, flow, typed))(tabs) : tabs;
  const tab = after.find((t) => t.id === tabId);
  return tab !== undefined && draftDiffers(tab);
}
