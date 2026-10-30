// The Flashcards track of the Pages tour (docs/specs/007-editor/flashcards.md, pages-tour.md "The
// steps"): on the person's own card, where to write, its page toolbar, another card, and its Style.
import { pinPageToolbar } from '@/components/canvas/article/page-toolbar-presence';
import type { PageTourStep } from './page-tour-api';
import {
  closeTitlePopover,
  openTitlePopover,
  pageButton,
  pageOrPopover,
  pageSheet,
} from './page-tour-dom';

const ARTICLE_TOOLBAR = '[role="toolbar"][aria-label="Article Formatting"]';
const ADD_CARD = '[data-tour-id="add-page"]';

export function flashcardTourSteps(): PageTourStep[] {
  return [
    {
      id: 'write',
      title: 'Write on the Card',
      body: 'A title and a few lines: what you want to say, in your own words. The corner says how long it takes to say.',
    },
    {
      id: 'toolbar',
      title: 'The Page Toolbar',
      body: 'Headings, bold, colours, lists and alignment. A card holds text only.',
      selector: () => ARTICLE_TOOLBAR,
      requires: (api) => pageSheet(api.pageId),
      prepare: (api) => pinPageToolbar(api.pageId),
      cleanup: () => pinPageToolbar(null),
    },
    {
      id: 'add-card',
      title: 'Another Card',
      body: 'Adds a card to the stack. The arrows under the card, or Contents, flip between them.',
      selector: () => ADD_CARD,
    },
    {
      id: 'style',
      title: 'Card Style',
      body: 'Pick a look, an accent colour and margins. Every card follows.',
      selector: (api) => pageOrPopover(api.pageId, 'Style'),
      requires: (api) => pageButton(api.pageId, 'Style'),
      prepare: (api) => openTitlePopover(api.pageId, 'Style'),
      cleanup: (api) => closeTitlePopover(api.pageId, 'Style'),
    },
    {
      id: 'outro',
      card: 'outro',
      title: "You're ready to speak",
      body: 'Write a card for each point. Too much for one card? Split it onto a new one.',
    },
  ];
}
