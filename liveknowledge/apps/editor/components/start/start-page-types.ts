// The start's page types (docs/specs/007-editor/start-diagramming.md "Page type"): the options of the rail's page
// type switch, All Pages first, then one for each kind of page.
import { lucideGlyph } from '@liveknowledge/ui';
import {
  lucideChartColumn,
  lucideFileText,
  lucideLayers,
  lucideLayoutGrid,
  lucidePresentation,
} from '@liveworkspace/icons/lucide';
import type { StartKindOption } from '@liveworkspace/workbench/components/start/StartKindFilter';
import type { StartPageType } from './start-template-items';

export const START_PAGE_TYPES: readonly StartKindOption<StartPageType>[] = [
  {
    id: 'all',
    name: 'All Pages',
    line: 'Every template, whatever kind of page it opens on.',
    icon: lucideGlyph(lucideLayoutGrid, 16),
  },
  {
    id: 'slide',
    name: 'Slide Deck',
    line: 'Decks to present: widescreen slides, ready to show.',
    icon: lucideGlyph(lucidePresentation, 16),
  },
  {
    id: 'article',
    name: 'Article',
    line: 'Writing that flows onto new pages as it grows.',
    icon: lucideGlyph(lucideFileText, 16),
  },
  {
    id: 'infographic',
    name: 'Infographic',
    line: 'Pages to lay out with charts, icons and pictures.',
    icon: lucideGlyph(lucideChartColumn, 16),
  },
  {
    id: 'flashcard',
    name: 'Flashcards',
    line: 'Cards to speak from, flipped one at a time.',
    icon: lucideGlyph(lucideLayers, 16),
  },
];
