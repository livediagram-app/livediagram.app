import type { ReactNode } from 'react';
import type { QuickConnectKind } from '@/lib/canvas';
import { DuplicateIcon as SharedDuplicateIcon, Glyph, Prims } from '@liveplanner/ui';
import {
  lucideArrowUpRight,
  lucideBetweenHorizontalEnd,
  lucideBetweenVerticalEnd,
  lucideType,
} from '@liveworkspace/icons/lucide';

// The quick-connect ring's option catalogue + glyphs (docs/specs/008-canvas/canvas-and-palette.md / 51),
// split out of QuickConnectRing the same way the other per-surface
// icon files are: the ring keeps its geometry + unfold render, this
// file owns what the menu offers and how each action looks.

const OPTION_ICON_SIZE = 16;

export type Option = {
  kind: QuickConnectKind | 'arrow' | 'add-web-row' | 'add-row' | 'add-column';
  label: string;
  description: string;
  icon: ReactNode;
};

// Web component rows (docs/specs/009-elements/web-components-and-no-groups.md): a stat row / process / header gains one
// more stat, step or link. The label names the thing, so the ring says what
// it will add rather than a generic "Add".
export function webRowOption(label: string, description: string): Option {
  return { kind: 'add-web-row', label, description, icon: <AddPointIcon /> };
}

// Table structural adds (docs/specs/008-canvas/canvas-and-palette.md): offered on the matching side's ring.
export const ADD_ROW_OPTION: Option = {
  kind: 'add-row',
  label: 'Add Row',
  description: 'Append a row at the bottom of the table.',
  icon: <AddRowIcon />,
};
export const ADD_COLUMN_OPTION: Option = {
  kind: 'add-column',
  label: 'Add Column',
  description: 'Append a column on the right of the table.',
  icon: <AddColumnIcon />,
};

// Listed order matches the spec; they fan across the arc in this order.
export const OPTIONS: Option[] = [
  {
    kind: 'duplicate',
    label: 'Duplicate',
    description: 'Copy this element to the side.',
    icon: <DuplicateIcon />,
  },
  {
    kind: 'arrow',
    label: 'Arrow',
    description: 'Drag out an arrow from this side.',
    icon: <ArrowIcon />,
  },
  {
    kind: 'text',
    label: 'Text',
    description: 'Add a text label to the side (no connector).',
    icon: <TextIcon />,
  },
];

// --- Option glyphs (stroked like the floating controls) ---

function DuplicateIcon() {
  return <SharedDuplicateIcon size={OPTION_ICON_SIZE} />;
}
function ArrowIcon() {
  return (
    <Glyph size={OPTION_ICON_SIZE} units={24}>
      <Prims prims={lucideArrowUpRight} />
    </Glyph>
  );
}
function TextIcon() {
  return (
    <Glyph size={OPTION_ICON_SIZE} units={24}>
      <Prims prims={lucideType} />
    </Glyph>
  );
}

// A rail line with a dot + a small plus — "add a point to the timeline rail".
function AddPointIcon() {
  return (
    <Glyph size={OPTION_ICON_SIZE} units={16}>
      <path d="M2 11h12" />
      <circle cx="5.5" cy="7" r="1.6" fill="currentColor" stroke="none" />
      <path d="M11 4v4M9 6h4" />
    </Glyph>
  );
}

// A grid gaining a row along the bottom / a column on the right.
function AddRowIcon() {
  return (
    <Glyph size={OPTION_ICON_SIZE} units={24}>
      <Prims prims={lucideBetweenHorizontalEnd} />
    </Glyph>
  );
}
function AddColumnIcon() {
  return (
    <Glyph size={OPTION_ICON_SIZE} units={24}>
      <Prims prims={lucideBetweenVerticalEnd} />
    </Glyph>
  );
}
