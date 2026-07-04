import type { ReactNode } from 'react';
import type { QuickConnectKind } from '@/lib/canvas';

// The quick-connect ring's option catalogue + glyphs (spec/09 / 51),
// split out of QuickConnectRing the same way the other per-surface
// icon files are: the ring keeps its geometry + unfold render, this
// file owns what the menu offers and how each action looks.

const OPTION_ICON_SIZE = 16;

export type Option = {
  kind: QuickConnectKind | 'arrow' | 'pencil' | 'add-point' | 'add-row' | 'add-column';
  label: string;
  description: string;
  icon: ReactNode;
};

// Rail-only action appended to the menu when onAddRailPoint is set (spec/51).
export const ADD_POINT_OPTION: Option = {
  kind: 'add-point',
  label: 'Add point',
  description: 'Add another point to the timeline rail.',
  icon: <AddPointIcon />,
};

// Table structural adds (spec/09): offered on the matching side's ring.
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

// --- Option glyphs (16x16 viewBox, stroked like the floating controls) ---

function iconProps() {
  return {
    width: OPTION_ICON_SIZE,
    height: OPTION_ICON_SIZE,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    'aria-hidden': true,
  };
}

function DuplicateIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="2.5" y="2.5" width="8" height="8" rx="1.5" />
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3 13 13 3" />
      <path d="M7 3h6v6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M11.5 2.5 13.5 4.5 5.5 12.5 3 13 3.5 10.5z" />
      <path d="M10 4 12 6" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4 4h8M8 4v9M6.5 13h3" />
    </svg>
  );
}

// A rail line with a dot + a small plus — "add a point to the timeline rail".
function AddPointIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M2 11h12" />
      <circle cx="5.5" cy="7" r="1.6" fill="currentColor" stroke="none" />
      <path d="M11 4v4M9 6h4" />
    </svg>
  );
}

// A grid gaining a row along the bottom — "append a row".
function AddRowIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="2.5" width="10" height="7" rx="1" />
      <path d="M8 2.5v7M3 6h10" />
      <path d="M8 11v3M6.5 12.5h3" />
    </svg>
  );
}

// A grid gaining a column on the right — "append a column".
function AddColumnIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="2.5" y="3" width="7" height="10" rx="1" />
      <path d="M2.5 8h7M6 3v10" />
      <path d="M11 8h3M12.5 6.5v3" />
    </svg>
  );
}
