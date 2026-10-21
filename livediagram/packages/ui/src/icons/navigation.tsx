import {
  lucideChevronDown,
  lucideChevronLeft,
  lucideChevronRight,
  lucideEllipsis,
  lucideMaximize2,
  lucideMenu,
  lucideMinimize2,
  lucideSearch,
} from '@livediagram/icons/lucide';

import { lucideGlyph } from './lucide-glyph';

// Navigation glyphs: chevrons, menus, search, overflow, expand / collapse. Lucide geometry.
export const ChevronDownIcon = lucideGlyph(lucideChevronDown, 10);
export const ChevronLeftIcon = lucideGlyph(lucideChevronLeft, 14);
export const ChevronRightIcon = lucideGlyph(lucideChevronRight, 14);
export const MenuIcon = lucideGlyph(lucideMenu, 12);
export const SearchIcon = lucideGlyph(lucideSearch, 16);
export const EllipsisIcon = lucideGlyph(lucideEllipsis, 16);
export const MaximizeIcon = lucideGlyph(lucideMaximize2, 16);
export const MinimizeIcon = lucideGlyph(lucideMinimize2, 16);
