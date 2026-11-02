// The preview's icons (docs/specs/026-plan/tracker-import.md "The preview"): each section's, and where it goes.
import {
  lucideColumns3,
  lucideFilePlus,
  lucideInfo,
  lucideListChecks,
  lucideMessagesSquare,
  lucideSquareKanban,
  lucideUsers,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveplanner/ui';

export const ColumnsIcon = lucideGlyph(lucideColumns3, 14);
export const FieldsIcon = lucideGlyph(lucideListChecks, 14);
export const PeopleIcon = lucideGlyph(lucideUsers, 14);
export const CommentsIcon = lucideGlyph(lucideMessagesSquare, 14);
export const LeftOutIcon = lucideGlyph(lucideInfo, 14);
export const BoardTabIcon = lucideGlyph(lucideSquareKanban, 16);
export const NewPlanIcon = lucideGlyph(lucideFilePlus, 16);
