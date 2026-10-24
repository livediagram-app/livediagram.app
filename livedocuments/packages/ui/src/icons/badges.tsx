import {
  lucideClipboardCheck,
  lucideLink,
  lucideMessageSquare,
  lucideStickyNote,
} from '@liveworkspace/icons/lucide';

import { lucideGlyph } from '@liveworkspace/ui';

// Element badges: link, note, action and comment. Lucide geometry.
export const LinkIcon = lucideGlyph(lucideLink, 14);
export const NoteIcon = lucideGlyph(lucideStickyNote, 12);
export const ActionIcon = lucideGlyph(lucideClipboardCheck, 12);
export const CommentIcon = lucideGlyph(lucideMessageSquare, 16);
