// The knowledge chrome's icons (docs/specs/004-interface-design/iconography.md): vendored Lucide glyphs at the
// chrome's size, as the page tree's are.
import {
  lucideCheck,
  lucideCircleCheck,
  lucideExternalLink,
  lucideFilePlus,
  lucideFileText,
  lucideLayers,
  lucidePanelRight,
  lucideSearch,
  lucideX,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveknowledge/ui';

export const TickIcon = lucideGlyph(lucideCircleCheck, 16);
export const CheckIcon = lucideGlyph(lucideCheck, 16);
export const ContextIcon = lucideGlyph(lucideLayers, 16);
export const PageInfoIcon = lucideGlyph(lucidePanelRight, 16);
export const CloseIcon = lucideGlyph(lucideX, 16);
export const SearchIcon = lucideGlyph(lucideSearch, 16);
export const PageIcon = lucideGlyph(lucideFileText, 16);
export const NewPageIcon = lucideGlyph(lucideFilePlus, 16);
export const OpenIcon = lucideGlyph(lucideExternalLink, 14);
