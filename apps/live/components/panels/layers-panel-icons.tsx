import {
  EllipsisIcon as SharedEllipsisIcon,
  LockIcon as SharedLockIcon,
  lucideGlyph,
  PlusIcon as SharedPlusIcon,
  TrashIcon as SharedTrashIcon,
} from '@livediagram/ui';
import {
  lucideArrowDownToLine,
  lucideArrowUpToLine,
  lucideEye,
  lucideEyeOff,
} from '@livediagram/icons/lucide';

// Glyphs for the Layers panel (docs/specs/006-document/layers.md): the row controls (eye / eye-off,
// lock, ellipsis, merge up / down), the footer add / delete, and the LayersStackIcon the
// CanvasChrome cluster button wears.

export { LayersStackIcon } from '@livediagram/ui';
export const EyeIcon = lucideGlyph(lucideEye, 13);
export const EyeOffIcon = lucideGlyph(lucideEyeOff, 13);

// `size` defaults to the row control's 12px; the row menu's Lock item draws it at 14.
export function LockIcon({ size = 12 }: { size?: number } = {}) {
  return <SharedLockIcon size={size} />;
}

export function EllipsisIcon() {
  return <SharedEllipsisIcon size={13} />;
}

// Merge into the layer above / below: an arrow meeting a line.
export const MergeUpIcon = lucideGlyph(lucideArrowUpToLine, 12);
export const MergeDownIcon = lucideGlyph(lucideArrowDownToLine, 12);

export function PlusIcon() {
  return <SharedPlusIcon size={11} />;
}

export function TrashIcon() {
  return <SharedTrashIcon size={12} />;
}
