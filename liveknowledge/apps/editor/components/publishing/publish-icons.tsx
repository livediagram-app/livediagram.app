// Publish to the Web's icons (docs/specs/004-interface-design/iconography.md): vendored Lucide glyphs at the
// chrome's sizes.
import {
  lucideCopy,
  lucideExternalLink,
  lucideGlobe,
  lucideLock,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveknowledge/ui';

export const GlobeIcon = lucideGlyph(lucideGlobe, 16);
export const LockIcon = lucideGlyph(lucideLock, 14);
export const CopyIcon = lucideGlyph(lucideCopy, 14);
export const OpenIcon = lucideGlyph(lucideExternalLink, 16);
