// A tab as the knowledgebase's style draws it, for everything that draws a tab away from the editor's own canvas
// (the exports, the print, a preview): the tab with the knowledgebase's theme and typeface, each article's writing
// in the knowledgebase's article style, and each colour an element leaves unset in the theme's
// (docs/specs/030-knowledgebase/page-surface.md "Exports (PDF, Word, Markdown) use the knowledgebase's style"). A view
// only: nothing here is stored or saved. The same tab back for the same tab and style.
import {
  articlesOf,
  knowledgeArticleStyle,
  themedForTab,
  type KnowledgeStyle,
  type Tab,
} from '@liveknowledge/document';

const styled = new WeakMap<Tab, { style: KnowledgeStyle; out: Tab }>();

export function tabInKnowledgeStyle(tab: Tab, style: KnowledgeStyle): Tab {
  const hit = styled.get(tab);
  if (hit && hit.style === style) return hit.out;
  const article = knowledgeArticleStyle(style);
  const flows = Object.entries(articlesOf(tab));
  const out: Tab = {
    ...tab,
    theme: style.theme,
    font: style.bodyFont,
    elements: themedForTab(tab.elements, style.theme),
    ...(flows.length
      ? {
          articles: Object.fromEntries(
            flows.map(([flow, doc]) => [flow, { ...doc, style: article }]),
          ),
        }
      : {}),
  };
  styled.set(tab, { style, out });
  return out;
}
