import {
  lucideClipboardCheck,
  lucideLink,
  lucideListTree,
  lucideMessageSquare,
  lucideStickyNote,
  lucideWandSparkles,
} from '@livediagram/icons/lucide';

import { lucideGlyph } from './lucide-glyph';

// Element badges: link, note, action, comment, and a mind map's outline. Lucide geometry.
export const LinkIcon = lucideGlyph(lucideLink, 14);
export const NoteIcon = lucideGlyph(lucideStickyNote, 12);
export const ActionIcon = lucideGlyph(lucideClipboardCheck, 12);
export const CommentIcon = lucideGlyph(lucideMessageSquare, 16);
// A mind map edited as an outline (docs/specs/009-elements/mind-node.md "Edit Outline").
export const MindOutlineIcon = lucideGlyph(lucideListTree, 13);
// Tidy Map: a mind map laid out tidily again.
export const TidyMapIcon = lucideGlyph(lucideWandSparkles, 13);
