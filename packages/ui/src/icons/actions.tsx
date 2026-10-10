import type { IconPrim } from '@livediagram/icons';
import {
  lucideArrowDown,
  lucideArrowUp,
  lucideColumns2,
  lucideCopy,
  lucideCopyPlus,
  lucideIndentDecrease,
  lucideIndentIncrease,
  lucideLayoutGrid,
  lucideLock,
  lucideLockOpen,
  lucidePaintRoller,
  lucidePencil,
  lucidePlus,
  lucideRefreshCw,
  lucideScan,
  lucideTrash2,
  lucideX,
} from '@livediagram/icons/lucide';

import { Glyph, type IconProps } from './Glyph';
import { lucideGlyph } from './lucide-glyph';
import { Prims } from './Prims';

// Edit-action glyphs: the delete / duplicate / copy / edit / lock / refresh / add / close / confirm
// buttons that recur across the editor's toolbars, popovers and dialogs. Lucide geometry.

// Delete.
export const TrashIcon = lucideGlyph(lucideTrash2, 16);
// Duplicate an element (a copy with a plus), distinct from copying a value.
export const DuplicateIcon = lucideGlyph(lucideCopyPlus, 16);
// One page split into several (an Illustrate page's Split Into Pages).
export const SplitPagesIcon = lucideGlyph(lucideLayoutGrid, 16);
// Copy a value or a theme.
export const CopyIcon = lucideGlyph(lucideCopy, 14);
export const PencilIcon = lucideGlyph(lucidePencil, 14);
export const RefreshIcon = lucideGlyph(lucideRefreshCw, 14);
export const PlusIcon = lucideGlyph(lucidePlus, 14);
export const CloseIcon = lucideGlyph(lucideX, 14);
// Lucide's check sits half a unit above its box's centre line; drawn here half a unit lower, on it
// (docs/specs/004-interface-design/iconography.md, "Guarding").
const CENTRED_CHECK: readonly IconPrim[] = [{ t: 'path', d: 'M20 6.5 9 17.5l-5-5' }];
export const CheckIcon = lucideGlyph(CENTRED_CHECK, 12);
// A paint roller: the format painter (copy one element's style onto others).
export const FormatPainterIcon = lucideGlyph(lucidePaintRoller, 14);
// Indent / outdent a line of a list, and move a line up or down (the outline editor).
export const IndentIcon = lucideGlyph(lucideIndentIncrease, 14);
export const OutdentIcon = lucideGlyph(lucideIndentDecrease, 14);
export const ArrowUpIcon = lucideGlyph(lucideArrowUp, 14);
export const ArrowDownIcon = lucideGlyph(lucideArrowDown, 14);
// Two panes side by side: open a tab beside the one you are on (docs/specs/007-editor/split-view.md).
export const SideBySideIcon = lucideGlyph(lucideColumns2, 16);
// Corner brackets: fit the view to its content.
export const FitViewIcon = lucideGlyph(lucideScan, 14);

// Padlock, closed by default; `closed={false}` swings the shackle open.
export function LockIcon({ closed = true, size = 16, ...rest }: IconProps & { closed?: boolean }) {
  return (
    <Glyph size={size} units={24} {...rest}>
      <Prims prims={closed ? lucideLock : lucideLockOpen} />
    </Glyph>
  );
}
