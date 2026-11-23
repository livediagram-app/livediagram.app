// Required Reading's glyphs (docs/specs/030-knowledgebase/required-reading.md "Where it shows"): the open book of the
// banner and the rail, a tick for a confirmation, the bell of Remind and the people asked.
import {
  lucideBell,
  lucideBookOpen,
  lucideBookOpenText,
  lucideCheck,
  lucideUsers,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveknowledge/ui';

export const ReadingBookIcon = lucideGlyph(lucideBookOpenText, 18);
export const SmallBookIcon = lucideGlyph(lucideBookOpen, 16);
export const ReadTickIcon = lucideGlyph(lucideCheck, 14);
export const RemindIcon = lucideGlyph(lucideBell, 14);
export const AudienceIcon = lucideGlyph(lucideUsers, 16);
// The page menu's Require Reading row, the menu's 14 px.
export const RequireReadingIcon = lucideGlyph(lucideBookOpenText, 14);
