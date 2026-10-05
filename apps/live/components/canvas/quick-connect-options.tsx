import type { ReactNode } from 'react';
import type { QuickConnectKind } from '@/lib/canvas';
import {
  DuplicateIcon as SharedDuplicateIcon,
  Glyph,
  PencilIcon as SharedPencilIcon,
  Prims,
} from '@livediagram/ui';
import {
  lucideArrowUpRight,
  lucideBetweenHorizontalEnd,
  lucideBetweenVerticalEnd,
  lucideType,
} from '@livediagram/icons/lucide';

// The quick-connect ring's option catalogue + glyphs (docs/specs/008-canvas/canvas-and-palette.md / 51),
// split out of QuickConnectRing the same way the other per-surface
// icon files are: the ring keeps its geometry + unfold render, this
// file owns what the menu offers and how each action looks.

const OPTION_ICON_SIZE = 16;

export type Option = {
  kind:
    | QuickConnectKind
    | 'arrow'
    | 'pencil'
    | 'add-point'
    | 'add-web-row'
    | 'add-row'
    | 'add-column'
    | 'mind-child'
    | 'mind-sibling';
  label: string;
  description: string;
  icon: ReactNode;
};

// Rail-only action appended to the menu when onAddRailPoint is set (docs/specs/009-elements/timeline-rail.md).
export const ADD_POINT_OPTION: Option = {
  kind: 'add-point',
  label: 'Add point',
  description: 'Add another point to the timeline rail.',
  icon: <AddPointIcon />,
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
  label: 'Add row',
  description: 'Append a row at the bottom of the table.',
  icon: <AddRowIcon />,
};
export const ADD_COLUMN_OPTION: Option = {
  kind: 'add-column',
  label: 'Add column',
  description: 'Append a column on the right of the table.',
  icon: <AddColumnIcon />,
};

// Mind-map growth (docs/specs/009-elements/mind-node.md), offered on a mind node's ring. Tab-for-child
// and Enter-for-sibling ARE the feature, so they need to be discoverable
// without already knowing them: the shortcut rides in the hover card, which is
// where every other shortcut in the ring would be found.
//
// They replaced a hint chip pinned under the selected node. It announced the
// two shortcuts to everyone forever, was dark enough to read as an error in
// light mode, and hung off the node's left edge because a centred one landed
// underneath the very "+" these options now live in.
export const MIND_CHILD_OPTION: Option = {
  kind: 'mind-child',
  label: 'Add child',
  description: 'Branch a new node off this one. Shortcut: Tab.',
  icon: <MindChildIcon />,
};
export const MIND_SIBLING_OPTION: Option = {
  kind: 'mind-sibling',
  label: 'Add sibling',
  description: 'Add a node beside this one, under the same parent. Shortcut: Enter.',
  icon: <MindSiblingIcon />,
};

// Listed order matches the spec; they fan across the arc in this order.
export const OPTIONS: Option[] = [
  {
    kind: 'duplicate',
    label: 'Duplicate',
    description: 'Copy this element to the side and connect it.',
    icon: <DuplicateIcon />,
  },
  {
    kind: 'arrow',
    label: 'Arrow',
    description: 'Drag out an arrow from this side.',
    icon: <ArrowIcon />,
  },
  {
    kind: 'pencil',
    label: 'Pencil',
    description: 'Draw a freehand sketch.',
    icon: <PencilIcon />,
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
function PencilIcon() {
  return <SharedPencilIcon size={OPTION_ICON_SIZE} />;
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

// Both glyphs draw the SAME two roles so the pair reads as a contrast: the
// selected node is solid, the node about to be added is an outline with a
// "+". Direction carries the meaning, matching the default tree flow
// (docs/specs/009-elements/mind-node.md): a child goes one level deeper, off
// to the right; a sibling lands below, at the same level under the same parent.

// This node (solid) with a new node branching off to its right.
function MindChildIcon() {
  return (
    <Glyph size={OPTION_ICON_SIZE} units={16}>
      <rect x="1" y="5.5" width="5" height="5" rx="1" fill="currentColor" />
      <path d="M6 8h2.5" />
      <rect x="8.5" y="4.5" width="6.5" height="7" rx="1.5" />
      <path d="M11.75 6.5v3M10.25 8h3" />
    </Glyph>
  );
}

// This node (solid) with a new node stacked under it, both hanging off the
// same parent bracket.
function MindSiblingIcon() {
  return (
    <Glyph size={OPTION_ICON_SIZE} units={16}>
      <path d="M1.5 4h3M4.5 4v8.25h2" />
      <rect x="6.5" y="1.5" width="8.5" height="5" rx="1" fill="currentColor" />
      <rect x="6.5" y="9" width="8.5" height="6.5" rx="1.5" />
      <path d="M10.75 10.75v3M9.25 12.25h3" />
    </Glyph>
  );
}

// A root line with two indented bullet lines under it: the map as an outline.
