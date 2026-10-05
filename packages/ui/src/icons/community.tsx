import type { IconPrim } from '@livediagram/icons';
import { lucideGlyph } from './lucide-glyph';

// The Community's heart (docs/specs/025-community/community.md "Likes"), shared by the Community app and the
// landing page. Lucide's heart (ISC), written as prims because the vendored set has no heart yet.
const HEART: readonly IconPrim[] = [
  {
    t: 'path',
    d: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
  },
];

export const HeartIcon = lucideGlyph(HEART, 16);
