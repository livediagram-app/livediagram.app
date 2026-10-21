import { Glyph, Prims, TrashIcon as SharedTrashIcon } from '@livediagram/ui';
import {
  lucideArrowDown,
  lucideArrowLeft,
  lucideArrowRight,
  lucideArrowUp,
  lucideTextAlignCenter,
  lucideTextAlignEnd,
  lucideTextAlignStart,
} from '@livediagram/icons/lucide';

// Icons of the table editor (TableView) and the text-align controls that borrow its align glyph:
// row / column move arrows, cell text-align, delete row / column, and the cell-link glyph.

const ARROWS = {
  left: lucideArrowLeft,
  right: lucideArrowRight,
  up: lucideArrowUp,
  down: lucideArrowDown,
};

export function ArrowIcon({ dir }: { dir: keyof typeof ARROWS }) {
  return (
    <Glyph size={14} units={24}>
      <Prims prims={ARROWS[dir]} />
    </Glyph>
  );
}

const ALIGNS = {
  left: lucideTextAlignStart,
  center: lucideTextAlignCenter,
  right: lucideTextAlignEnd,
};

export function AlignIcon({ dir }: { dir: keyof typeof ALIGNS }) {
  return (
    <Glyph size={14} units={24}>
      <Prims prims={ALIGNS[dir]} />
    </Glyph>
  );
}

export function TrashIcon() {
  return <SharedTrashIcon size={14} />;
}

// The element-link chain glyph (docs/specs/008-canvas/canvas-and-palette.md links), shared with the
// context menu's Link tile so the two linking surfaces can't drift.
export { LinkMenuIcon as CellLinkIcon } from '@/components/palette/context-menu-icons';
