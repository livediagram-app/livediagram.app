import type { IconPrim } from '@livediagram/icons';
import {
  lucideArrowLeft,
  lucideExternalLink,
  lucideEyeOff,
  lucideLayoutGrid,
  lucideMaximize2,
  lucideSparkles,
  lucideTriangleAlert,
  lucideUser,
  lucideUsers,
} from '@livediagram/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';

// The Community app's own chrome glyphs, all through lucideGlyph (docs/specs/004-interface-design/
// iconography.md). Heart, flag, hash and arrow-up-down are not in the vendored set yet, so their Lucide
// geometry (ISC) is written here as prims.

const HEART: readonly IconPrim[] = [
  {
    t: 'path',
    d: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
  },
];

const HASH: readonly IconPrim[] = [
  { t: 'line', x1: 4, y1: 9, x2: 20, y2: 9 },
  { t: 'line', x1: 4, y1: 15, x2: 20, y2: 15 },
  { t: 'line', x1: 10, y1: 3, x2: 8, y2: 21 },
  { t: 'line', x1: 16, y1: 3, x2: 14, y2: 21 },
];

const ARROW_UP_DOWN: readonly IconPrim[] = [
  { t: 'path', d: 'm21 16-4 4-4-4' },
  { t: 'path', d: 'M17 20V4' },
  { t: 'path', d: 'm3 8 4-4 4 4' },
  { t: 'path', d: 'M7 4v16' },
];

const FLAG: readonly IconPrim[] = [
  { t: 'path', d: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z' },
  { t: 'line', x1: 4, y1: 22, x2: 4, y2: 15 },
];

export const HeartIcon = lucideGlyph(HEART, 16);
export const HashIcon = lucideGlyph(HASH, 15);
export const SortIcon = lucideGlyph(ARROW_UP_DOWN, 15);
export const CategoryIcon = lucideGlyph(lucideLayoutGrid, 15);
export const FlagIcon = lucideGlyph(FLAG, 14);
export const BackIcon = lucideGlyph(lucideArrowLeft, 16);
export const OpenIcon = lucideGlyph(lucideExternalLink, 14);
export const FullScreenIcon = lucideGlyph(lucideMaximize2, 14);
export const SparklesIcon = lucideGlyph(lucideSparkles, 16);
export const PeopleIcon = lucideGlyph(lucideUsers, 16);
export const AlertIcon = lucideGlyph(lucideTriangleAlert, 16);
export const MineIcon = lucideGlyph(lucideUser, 15);
export const HiddenIcon = lucideGlyph(lucideEyeOff, 12);
