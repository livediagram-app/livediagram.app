import {
  Fragment,
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { QuickConnectDirection, QuickConnectKind } from '@/lib/canvas';
import { Tooltip } from './Tooltip';
import { FLOATING_CONTROL_GAP, FLOATING_CONTROL_SIZE } from './floating-controls';

// Quick add + connect (spec/09). One of these floats on each edge of the
// selected element. The plus is a click *trigger*: clicking it unfolds a
// single connected menu strip of five quick actions out of the plus —
// Duplicate / Arrow / Square / Pencil / Text — each acting on this edge.
// Clicking the plus again (now an ×) or anywhere outside closes it. Open
// state is owned by the parent (Canvas) so only one ring opens at a time
// and the selection toolbar can hide while it's open.

type Props = {
  // Edge midpoint in canvas coords (same anchor the resize handles use).
  x: number;
  y: number;
  placement: QuickConnectDirection;
  zoom: number;
  // Controlled open state + intent callbacks (owned by Canvas).
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  // Spawn a connected element of the given kind to this side.
  onSpawn: (kind: QuickConnectKind) => void;
  // Start the Arrow action from this side. The parent decides drag
  // (desktop) vs tap-target (mobile) from the pointer type.
  onArrowPointerDown: (e: ReactPointerEvent) => void;
  // Enter freehand (pencil) draw mode.
  onPencil: () => void;
};

// The plus trigger stays in the shared floating-control family (matching
// the resize / rotate handles). The options form ONE horizontal segmented
// control (flush sub-buttons, dividers) that unfolds out of the plus.
const SIZE = FLOATING_CONTROL_SIZE;
const GAP = FLOATING_CONTROL_GAP;
// Match the selection toolbar's buttons (h-8 = 32px) + icons (16px).
const OPTION_SIZE = 32;
const OPTION_ICON_SIZE = 16;
// Gap (screen px) between the plus and the near edge of the control.
const MENU_GAP = 8;
// How long the exit transition runs before the control unmounts.
const EXIT_MS = 200;
// Distance from the plus centre to the control's near edge.
const NEAR = SIZE / 2 + MENU_GAP;

// Unit outward vector (which way the control sits from the plus).
const OUTWARD: Record<QuickConnectDirection, { x: number; y: number }> = {
  right: { x: 1, y: 0 },
  below: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  above: { x: 0, y: -1 },
};

// Per-side placement of the control: top / bottom run HORIZONTAL (a row
// centred over the plus), left / right run VERTICAL (a column centred
// beside it). `pos` is relative to the plus centre (0,0); `base` carries the
// centring translate, folded into both the collapsed + open transforms; the
// control unfolds out of the plus from `origin`.
const MENU: Record<
  QuickConnectDirection,
  { col: boolean; pos: React.CSSProperties; origin: string; base: string; collapsed: string }
> = {
  right: {
    col: true,
    pos: { left: NEAR, top: 0 },
    origin: 'left center',
    base: 'translateY(-50%)',
    collapsed: 'scaleX(0)',
  },
  left: {
    col: true,
    pos: { right: NEAR, top: 0 },
    origin: 'right center',
    base: 'translateY(-50%)',
    collapsed: 'scaleX(0)',
  },
  below: {
    col: false,
    pos: { top: NEAR, left: 0 },
    origin: 'center top',
    base: 'translateX(-50%)',
    collapsed: 'scaleY(0)',
  },
  above: {
    col: false,
    pos: { bottom: NEAR, left: 0 },
    origin: 'center bottom',
    base: 'translateX(-50%)',
    collapsed: 'scaleY(0)',
  },
};

type Option = {
  kind: QuickConnectKind | 'arrow' | 'pencil';
  label: string;
  description: string;
  icon: ReactNode;
};

// Listed order matches the spec; they fan across the arc in this order.
const OPTIONS: Option[] = [
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
    kind: 'square',
    label: 'Square',
    description: 'Add a connected square.',
    icon: <SquareIcon />,
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

export function QuickConnectRing({
  x,
  y,
  placement,
  zoom,
  open,
  onToggle,
  onClose,
  onSpawn,
  onArrowPointerDown,
  onPencil,
}: Props) {
  // `rendered` keeps the options mounted through the exit transition;
  // `active` drives the per-option fade/scale (off → on for enter, on →
  // off for exit).
  const [rendered, setRendered] = useState(false);
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (open) {
      setRendered(true);
      // Flip to active on the next frame so the enter transition runs
      // from the hidden start state rather than snapping to shown.
      const r = requestAnimationFrame(() => setActive(true));
      return () => cancelAnimationFrame(r);
    }
    setActive(false);
    const t = setTimeout(() => setRendered(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [open]);

  const out = OUTWARD[placement];
  // Plus centre in canvas coords: out beyond the edge by GAP + half the
  // control, divided by zoom so the screen gap is constant at any zoom.
  const reach = (GAP + SIZE / 2) / zoom;
  const cx = x + out.x * reach;
  const cy = y + out.y * reach;

  const menu = MENU[placement];

  return (
    <div
      data-quick-ring=""
      className="pointer-events-none absolute z-20"
      style={{ left: cx, top: cy, transform: `translate(-50%, -50%) scale(${1 / zoom})` }}
    >
      {/* The plus trigger, centred at (cx, cy). Click toggles the ring.
          Styled to match the selection toolbar (white, slate, soft shadow). */}
      <button
        type="button"
        aria-label="Quick add and connect"
        aria-expanded={open}
        className="pointer-events-auto absolute flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-lg shadow-slate-900/10 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:shadow-slate-950/40 dark:hover:bg-slate-800 dark:hover:text-white"
        style={{
          left: 0,
          top: 0,
          width: SIZE,
          height: SIZE,
          transform: 'translate(-50%, -50%)',
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onToggle}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          style={{ transform: open ? 'rotate(45deg)' : 'none', transition: 'transform 150ms' }}
        >
          <path d="M8 3v10M3 8h10" />
        </svg>
      </button>

      {/* One control of sub-buttons, styled like the selection toolbar
          (white, slate, soft shadow, thin inset dividers). Horizontal row on
          top / bottom, vertical column on the sides. Unfolds out of the
          plus (scales from the plus-side edge) on open. */}
      {rendered ? (
        <div
          className={`pointer-events-auto absolute flex items-center rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40 ${
            menu.col ? 'flex-col' : 'flex-row'
          }`}
          style={{
            ...menu.pos,
            transformOrigin: menu.origin,
            transform: active ? `${menu.base} scale(1)` : `${menu.base} ${menu.collapsed}`,
            opacity: active ? 1 : 0,
            transition: 'transform 220ms cubic-bezier(0.34, 1.4, 0.64, 1), opacity 140ms ease',
          }}
        >
          {OPTIONS.map((option, i) => {
            const isArrow = option.kind === 'arrow';
            return (
              <Fragment key={option.kind}>
                {i > 0 ? (
                  <div
                    aria-hidden
                    className={`shrink-0 bg-slate-200 dark:bg-slate-700 ${
                      menu.col ? 'my-0.5 h-px w-6' : 'mx-0.5 h-6 w-px'
                    }`}
                  />
                ) : null}
                <Tooltip title={option.label} description={option.description}>
                  <button
                    type="button"
                    aria-label={option.label}
                    className="flex shrink-0 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    style={{ width: OPTION_SIZE, height: OPTION_SIZE }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      // Arrow starts on pointer-down so it's a single press-drag
                      // gesture: a desktop drag from this anchor, or (on touch)
                      // arming the tap-target connect.
                      if (isArrow) {
                        onArrowPointerDown(e);
                        onClose();
                      }
                    }}
                    onClick={() => {
                      if (isArrow) return;
                      if (option.kind === 'pencil') onPencil();
                      else onSpawn(option.kind as QuickConnectKind);
                      onClose();
                    }}
                  >
                    {option.icon}
                  </button>
                </Tooltip>
              </Fragment>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

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

function SquareIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="3" width="10" height="10" rx="1.5" />
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
