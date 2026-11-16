import {
  lucideArrowLeft,
  lucideArrowUpDown,
  lucideCircleAlert,
  lucideCircleCheck,
  lucideClock,
  lucideMessageSquare,
  lucideMessagesSquare,
  lucidePartyPopper,
  lucidePencil,
  lucidePlus,
  lucideThumbsUp,
  lucideTrash2,
  lucideEyeOff,
  lucideFlag,
  lucideHash,
  lucideLayoutGrid,
  lucideMaximize2,
  lucideSparkles,
  lucideTriangleAlert,
  lucideUser,
  lucideUsers,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveworkspace/ui';

// The Community pages' own chrome glyphs, all through lucideGlyph (docs/specs/004-interface-design/
// iconography.md).

// The heart is shared with the landing page.
export { HeartIcon } from '@liveworkspace/ui';
export const HashIcon = lucideGlyph(lucideHash, 15);
export const SortIcon = lucideGlyph(lucideArrowUpDown, 15);
export const CategoryIcon = lucideGlyph(lucideLayoutGrid, 15);
export const FlagIcon = lucideGlyph(lucideFlag, 14);
export const BackIcon = lucideGlyph(lucideArrowLeft, 16);
export const FullScreenIcon = lucideGlyph(lucideMaximize2, 14);
export const SparklesIcon = lucideGlyph(lucideSparkles, 16);
export const PeopleIcon = lucideGlyph(lucideUsers, 16);
export const AlertIcon = lucideGlyph(lucideTriangleAlert, 16);
export const MineIcon = lucideGlyph(lucideUser, 15);
export const HiddenIcon = lucideGlyph(lucideEyeOff, 12);

// The Forum's (liveworkspace/docs/specs/007-community/community.md "The Forum").
export const ForumIcon = lucideGlyph(lucideMessagesSquare, 16);
export const GalleryIcon = lucideGlyph(lucideLayoutGrid, 16);
export const ReplyIcon = lucideGlyph(lucideMessageSquare, 15);
export const HelpfulIcon = lucideGlyph(lucideThumbsUp, 14);
export const CelebrateIcon = lucideGlyph(lucidePartyPopper, 14);
export const AnswerIcon = lucideGlyph(lucideCircleCheck, 14);
export const PendingIcon = lucideGlyph(lucideClock, 14);
export const RefusedIcon = lucideGlyph(lucideCircleAlert, 14);
export const EditIcon = lucideGlyph(lucidePencil, 14);
export const DeleteIcon = lucideGlyph(lucideTrash2, 14);
export const AskIcon = lucideGlyph(lucidePlus, 16);
