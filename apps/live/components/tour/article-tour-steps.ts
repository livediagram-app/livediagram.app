// The Article track of the Illustrate tour (docs/specs/007-editor/illustrate-tour.md "Article track"): on the person's
// own article page, where to write, its page toolbar, and its style and type in the page's panel.
import { pinPageToolbar } from '@/components/canvas/article/page-toolbar-presence';
import type { PageTourStep } from './page-tour-api';
import { pageCog } from './page-tour-dom';

export const ARTICLE_WELCOME: PageTourStep = {
  id: 'welcome',
  card: 'welcome',
  title: 'Getting started with articles?',
  body: 'Want a quick look at writing an article? We will show you the page, its toolbar, and how to give it a look of its own.',
};

const TOOLBAR_BODY =
  'Styles and headings, bold and italic, colours, lists, alignment, and Insert for images, tables and charts.';

export function articleTourSteps(): PageTourStep[] {
  return [
    {
      id: 'write',
      title: 'Write on the Page',
      body: 'Click to write. Type / for headings, lists, tables, images and charts. When a page fills, the writing flows onto a new one.',
      // A card on its own, no ring: one round the whole page would light most of the screen.
    },
    {
      id: 'toolbar',
      title: 'The Page Toolbar',
      body: `${TOOLBAR_BODY} It acts on what you have selected.`,
      selector: () => '[data-page-toolbar]',
      // Held up on the tour page through the step: it otherwise shows only while the page is hovered or written on.
      prepare: (api) => pinPageToolbar(api.pageId),
      cleanup: () => pinPageToolbar(null),
    },
    {
      id: 'style',
      title: 'Article Style',
      body: 'Pick a look (Clean, Classic, Report, Notebook or Bold), an accent colour, margins and page numbers. Every page of the article follows.',
      selector: () => '[data-page-panel]',
      requires: (api) => pageCog(api.pageId),
      prepare: (api) => api.openPanel(api.pageId, 'style'),
      cleanup: (api) => api.closePanel(),
    },
    {
      id: 'text',
      title: 'Fonts and Spacing',
      body: 'Choose the heading and body fonts, the text size, and the space between lines and paragraphs.',
      selector: () => '[data-page-panel]',
      requires: (api) => pageCog(api.pageId),
      prepare: (api) => api.openPanel(api.pageId, 'text'),
      cleanup: (api) => api.closePanel(),
    },
    {
      id: 'outro',
      card: 'outro',
      title: "You're ready to write",
      body: 'Start typing. Export saves your article as a PDF, and the help centre has more on articles.',
    },
  ];
}
