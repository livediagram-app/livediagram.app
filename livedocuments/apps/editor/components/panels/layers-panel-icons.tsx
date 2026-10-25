import {
  EllipsisIcon as SharedEllipsisIcon,
  lucideGlyph,
  PlusIcon as SharedPlusIcon,
} from '@livedocuments/ui';
import {
  lucideArrowDownToLine,
  lucideArrowUpToLine,
  lucideBringToFront,
  lucideEraser,
  lucideEye,
  lucideEyeOff,
  lucideGripVertical,
  lucideLock,
  lucideLockOpen,
  lucidePencil,
  lucideScanEye,
  lucideSendToBack,
  lucideTrash2,
} from '@liveworkspace/icons/lucide';

// Glyphs for the Layers panel (docs/specs/006-document/layers.md): the row controls (grip, eye,
// lock, ellipsis), the header's New Layer, the footer's merge + delete, the row menu's verbs, and
// the LayersStackIcon the CanvasChrome cluster button wears. Row controls draw at 16px inside
// 32px targets; the footer and menu draw at 14-16px.

export { LayersStackIcon } from '@livedocuments/ui';
export const GripIcon = lucideGlyph(lucideGripVertical, 14);
// 13px: shared with the slide deck rows, the page deck button and the role indicator.
export const EyeIcon = lucideGlyph(lucideEye, 13);
export const EyeOffIcon = lucideGlyph(lucideEyeOff, 13);
export const RowEyeIcon = lucideGlyph(lucideEye, 16);
export const RowEyeOffIcon = lucideGlyph(lucideEyeOff, 16);
export const LockIcon = lucideGlyph(lucideLock, 15);
export const UnlockIcon = lucideGlyph(lucideLockOpen, 15);
export const SoloIcon = lucideGlyph(lucideScanEye, 16);
export const BringToTopIcon = lucideGlyph(lucideBringToFront, 16);
export const SendToBottomIcon = lucideGlyph(lucideSendToBack, 16);
export const RenameIcon = lucideGlyph(lucidePencil, 16);
export const ClearIcon = lucideGlyph(lucideEraser, 16);
export const DeleteIcon = lucideGlyph(lucideTrash2, 16);

// Merge into the layer above / below: an arrow meeting a line.
export const MergeUpIcon = lucideGlyph(lucideArrowUpToLine, 14);
export const MergeDownIcon = lucideGlyph(lucideArrowDownToLine, 14);
export const FooterDeleteIcon = lucideGlyph(lucideTrash2, 14);

export function EllipsisIcon() {
  return <SharedEllipsisIcon size={16} />;
}

export function PlusIcon() {
  return <SharedPlusIcon size={14} />;
}
