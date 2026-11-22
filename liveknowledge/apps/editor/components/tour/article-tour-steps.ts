// The Article track of the Pages tour (docs/specs/007-editor/pages-tour.md "Article track"): on the person's
// own article page, where to write, its page toolbar, and its Style and Text beside the cog (PageArticleButtons), on a
// phone under Appearance.
import { pinPageToolbar } from '@/components/canvas/article/page-toolbar-presence';
import type { PageTourApi, PageTourStep } from './page-tour-api';
import { firstBlockOnPage, pageSheet } from './page-tour-dom';
import { lookStep, type TrackOptions } from './page-tour-parts';

const ARTICLE_TOOLBAR = '[role="toolbar"][aria-label="Article Formatting"]';

const TOOLBAR_BODY =
  'Headings, bold, colours, lists and alignment. Insert adds images, tables and charts.';

export function articleTourSteps({ phone = false }: TrackOptions = {}): PageTourStep[] {
  return [
    {
      id: 'write',
      title: 'Write on the Page',
      body: 'Click and type. Type / to add a heading, list, table, image or chart. Full pages flow onto new ones.',
      // A card on its own, no ring: one round the whole page would light most of the screen. On a phone a centred
      // card covers the very text it asks to tap, so it rings the page's first block and sits clear of it (#667).
      ...(phone
        ? {
            selector: (api: PageTourApi) => firstBlockOnPage(api.pageId),
            requires: (api: PageTourApi) => pageSheet(api.pageId),
          }
        : {}),
    },
    {
      id: 'toolbar',
      title: 'The Page Toolbar',
      body: `${TOOLBAR_BODY} It acts on what you have selected.`,
      // The article's own formatting toolbar, by its name, so no other toolbar on screen is taken for it.
      selector: () => ARTICLE_TOOLBAR,
      // The toolbar shows only once the step holds it up: the step needs only its page on screen (spec "Filtering").
      requires: (api) => pageSheet(api.pageId),
      // Held up on the tour page through the step: it otherwise shows only while the page is hovered or written on.
      prepare: (api) => pinPageToolbar(api.pageId),
      cleanup: () => pinPageToolbar(null),
    },
    lookStep(
      {
        id: 'style',
        title: 'Article Style',
        body: 'Pick a look, an accent colour, margins and page numbers. Every page follows.',
      },
      'Style',
    ),
    lookStep(
      {
        id: 'text',
        title: 'Fonts and Spacing',
        body: 'Fonts for headings and body, text size, and spacing.',
      },
      'Text',
    ),
    {
      id: 'outro',
      card: 'outro',
      title: "You're ready to write",
      body: 'Start typing. Export saves it as a PDF.',
    },
  ];
}
