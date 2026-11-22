// Approval's and a page's comments' icons (docs/specs/004-interface-design/iconography.md): vendored Lucide glyphs
// at the chrome's sizes, as knowledge-icons.tsx's are.
import {
  lucideCircleX,
  lucideHourglass,
  lucideMessagesSquare,
  lucidePencil,
  lucideRotateCcw,
  lucideSend,
  lucideTrash2,
  lucideCircleCheck,
  lucideEllipsis,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveknowledge/ui';

export const PendingIcon = lucideGlyph(lucideHourglass, 14);
export const RejectedIcon = lucideGlyph(lucideCircleX, 14);
export const RequestIcon = lucideGlyph(lucideSend, 14);
// Page Health's panel: the state's glyph in its ring.
export const PendingPanelIcon = lucideGlyph(lucideHourglass, 18);
export const RejectedPanelIcon = lucideGlyph(lucideCircleX, 18);
export const ApprovedPanelIcon = lucideGlyph(lucideCircleCheck, 18);
// The comments at the foot.
export const CommentsIcon = lucideGlyph(lucideMessagesSquare, 16);
export const EditIcon = lucideGlyph(lucidePencil, 14);
export const DeleteIcon = lucideGlyph(lucideTrash2, 14);
export const ReopenIcon = lucideGlyph(lucideRotateCcw, 14);
export const ResolveIcon = lucideGlyph(lucideCircleCheck, 14);
export const MoreIcon = lucideGlyph(lucideEllipsis, 16);
