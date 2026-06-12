import { useEffect, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { QuickConnectDirection, QuickConnectKind } from '@/lib/canvas';
import { Tooltip } from './Tooltip';
import {
  FLOATING_CONTROL_CLASS,
  FLOATING_CONTROL_GAP,
  FLOATING_CONTROL_HOVER_CLASS,
  FLOATING_CONTROL_SIZE,
} from './floating-controls';

// Quick add + connect (spec/09). One of these floats on each edge of the
// selected element. The plus is a click *trigger*: clicking it opens a
// radial ring of five quick actions fanning outward from it — Duplicate /
// Arrow / Square / Diamond / Circle — each acting on this edge. Clicking
// the plus again (now an ×) or anywhere outside closes it. Open state is
// owned by the parent (Canvas) so only one ring opens at a time and the
// selection toolbar can dodge the top ring.

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
// the resize / rotate handles); the ring options are deliberately larger
// so they're easy to see and tap.
const SIZE = FLOATING_CONTROL_SIZE;
const GAP = FLOATING_CONTROL_GAP;
const OPTION_SIZE = 36;
const OPTION_ICON_SIZE = 20;
// Distance (screen px) from the plus centre out to each ring option.
const RING_RADIUS = 70;
// Angular spread of the five options, centred on the outward direction.
const RING_SPREAD = 126;
// How long the exit transition runs before the options unmount.
const EXIT_MS = 200;

// Unit outward vector + the screen-space angle (y-down) the arc centres on.
const OUTWARD: Record<QuickConnectDirection, { x: number; y: number; angle: number }> = {
  right: { x: 1, y: 0, angle: 0 },
  below: { x: 0, y: 1, angle: 90 },
  left: { x: -1, y: 0, angle: 180 },
  above: { x: 0, y: -1, angle: -90 },
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
    kind: 'circle',
    label: 'Circle',
    description: 'Add a connected circle.',
    icon: <CircleIcon />,
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

  const step = OPTIONS.length > 1 ? RING_SPREAD / (OPTIONS.length - 1) : 0;

  return (
    <div
      data-quick-ring=""
      className="pointer-events-none absolute z-20"
      style={{ left: cx, top: cy, transform: `translate(-50%, -50%) scale(${1 / zoom})` }}
    >
      {/* The plus trigger, centred at (cx, cy). Click toggles the ring. */}
      <button
        type="button"
        aria-label="Quick add and connect"
        aria-expanded={open}
        className={`pointer-events-auto absolute flex items-center justify-center ${FLOATING_CONTROL_CLASS} ${FLOATING_CONTROL_HOVER_CLASS}`}
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

      {rendered
        ? OPTIONS.map((option, i) => {
            const angle = ((out.angle - RING_SPREAD / 2 + i * step) * Math.PI) / 180;
            const ox = Math.cos(angle) * RING_RADIUS;
            const oy = Math.sin(angle) * RING_RADIUS;
            const isArrow = option.kind === 'arrow';
            // Reverse the stagger on exit so the ring retracts in order.
            const delay = (active ? i : OPTIONS.length - 1 - i) * 24;
            return (
              <div
                key={option.kind}
                className="pointer-events-auto absolute"
                style={{ left: ox, top: oy, transform: 'translate(-50%, -50%)' }}
              >
                <Tooltip title={option.label} description={option.description}>
                  <button
                    type="button"
                    aria-label={option.label}
                    className={`flex items-center justify-center ${FLOATING_CONTROL_CLASS} ${FLOATING_CONTROL_HOVER_CLASS}`}
                    style={{
                      width: OPTION_SIZE,
                      height: OPTION_SIZE,
                      opacity: active ? 1 : 0,
                      transform: `scale(${active ? 1 : 0.3})`,
                      transition:
                        'opacity 150ms ease, transform 190ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                      transitionDelay: `${delay}ms`,
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      // Arrow starts on pointer-down so it's a single
                      // press-drag gesture: a desktop drag from this anchor,
                      // or (on touch) arming the tap-target connect.
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
              </div>
            );
          })
        : null}
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
    strokeWidth: 1.7,
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

function CircleIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="8" cy="8" r="5" />
    </svg>
  );
}
