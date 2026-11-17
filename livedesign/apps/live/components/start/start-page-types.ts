// The start's page types (docs/specs/007-editor/start-diagramming.md "Page type"): the options of the rail's page
// type switch, All Pages first, then one for each kind of page.
import { lucideGlyph } from '@livedesign/ui';
import {
  lucideAppWindow,
  lucideImage,
  lucideLayoutGrid,
  lucideShapes,
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
    id: 'logo',
    name: 'Logo',
    line: 'Logos, marks and brand boards on a square artboard.',
    icon: lucideGlyph(lucideShapes, 16),
  },
  {
    id: 'wireframe',
    name: 'Wireframe',
    line: 'Screens for apps and websites, framed in their device.',
    icon: lucideGlyph(lucideAppWindow, 16),
  },
  {
    id: 'photo',
    name: 'Photo',
    line: 'A picture to edit, with layers, brushes and filters.',
    icon: lucideGlyph(lucideImage, 16),
  },
];
