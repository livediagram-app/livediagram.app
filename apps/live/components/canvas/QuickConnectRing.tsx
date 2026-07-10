import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { QuickConnectDirection, QuickConnectKind } from '@/lib/canvas';
import { Tooltip } from '@/components/primitives/Tooltip';
import { FLOATING_CONTROL_GAP, FLOATING_CONTROL_SIZE } from '@/components/chrome/floating-controls';
import {
  ADD_COLUMN_OPTION,
  ADD_POINT_OPTION,
  ADD_ROW_OPTION,
  OPTIONS,
} from './quick-connect-options';

// Quick add + connect (spec/09). One of these floats on each edge of the
// selected element. The plus is a click *trigger*: clicking it unfolds a
// single connected menu strip of five quick actions out of the plus —
// Duplicate / Arrow / Square / Pencil / Text — each acting on this edge.
// Clicking the plus again (now an ×) or anywhere outside closes it. Open
// state is owned by the parent (Canvas) so only one ring opens at a time
// and the selection toolbar can hide while it's open.
//
// DRAGGING the plus skips the menu entirely and starts the Arrow action
// straight away (the most common quick-connect), so "select, grab the +,
// pull to the target" is one gesture. A small movement threshold keeps
// plain clicks toggling the menu as before.

type QuickConnectRingProps = {
  // Edge midpoint in canvas coords (same anchor the resize handles use).
  x: number;
  y: number;
  placement: QuickConnectDirection;
  zoom: number;
  // Controlled open state + intent callbacks (owned by Canvas).
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  // Quick-add-on-hover preference (spec/09). When true, the menu opens on
  // hover of the + and closes when the pointer leaves both the + and the
  // menu, instead of needing a click. Click still toggles in either mode.
  openOnHover?: boolean;
  // Open this side's menu (the hover-open path; distinct from onToggle so
  // re-entering an already-open ring doesn't toggle it shut).
  onOpen: () => void;
  // Spawn a connected element of the given kind to this side.
  onSpawn: (kind: QuickConnectKind) => void;
  // Start the Arrow action from this side. The parent decides drag
  // (desktop) vs tap-target (mobile) from the pointer type.
  onArrowPointerDown: (e: ReactPointerEvent) => void;
  // Enter freehand (pencil) draw mode.
  onPencil: () => void;
  // Timeline rail (spec/51): when set (the selected element is a rail), the
  // ring gains an "Add point" action that appends a point to the rail.
  onAddRailPoint?: () => void;
  // Table variant (spec/09): the ring slims down to Arrow plus the
  // structural add for this side — Add Row on the bottom plus, Add Column
  // on the right one. Duplicate / Pencil / Text don't apply to a grid.
  variant?: 'default' | 'table';
  onAddTableRow?: () => void;
  onAddTableColumn?: () => void;
};

// The plus trigger stays in the shared floating-control family (matching
// the resize handles). The options form ONE horizontal segmented
// control (flush sub-buttons, dividers) that unfolds out of the plus.
const SIZE = FLOATING_CONTROL_SIZE;
const GAP = FLOATING_CONTROL_GAP;
// Match the selection toolbar's buttons (h-8 = 32px); icon size lives
// with the glyphs in quick-connect-options.
const OPTION_SIZE = 32;
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

export function QuickConnectRing({
  x,
  y,
  placement,
  zoom,
  open,
  onToggle,
  onClose,
  openOnHover,
  onOpen,
  onSpawn,
  onArrowPointerDown,
  onPencil,
  onAddRailPoint,
  variant = 'default',
  onAddTableRow,
  onAddTableColumn,
}: QuickConnectRingProps) {
  // The rail "Add point" action only appears when the selected element is a
  // timeline rail (onAddRailPoint set), appended after the standard actions.
  // The table variant slims to Arrow + this side's structural add (Add Row
  // below, Add Column on the right — spec/09): Duplicate / Pencil / Text
  // don't apply to a grid.
  const options =
    variant === 'table'
      ? [
          ...(onAddTableRow ? [ADD_ROW_OPTION] : []),
          ...(onAddTableColumn ? [ADD_COLUMN_OPTION] : []),
          OPTIONS.find((o) => o.kind === 'arrow')!,
        ]
      : onAddRailPoint
        ? [...OPTIONS, ADD_POINT_OPTION]
        : OPTIONS;
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

  // Hover-open (quick-add-on-hover, spec/09): open on pointer-enter of the +
  // or its menu, and close on a short delay after leaving both, so crossing
  // the gap between the + and the menu doesn't close it. No-op unless the
  // preference is on; click still toggles in either mode.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );
  const handleHoverEnter = () => {
    if (!openOnHover) return;
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (!open) onOpen();
  };
  const handleHoverLeave = () => {
    if (!openOnHover) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      onClose();
    }, 160);
  };

  // Drag-to-arrow from the plus itself: pointer-down arms a watcher; once
  // the pointer travels past a small threshold the gesture hands off to the
  // Arrow starter (same handler as the menu's Arrow option) and the
  // follow-up click is swallowed. Under the threshold it stays a plain
  // click, which toggles the menu as before.
  const DRAG_THRESHOLD_PX = 4;
  const pressRef = useRef<{ x: number; y: number; id: number; type: string } | null>(null);
  const draggedRef = useRef(false);
  const detachRef = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      detachRef.current?.();
    },
    [],
  );
  const handlePlusPointerDown = (e: ReactPointerEvent) => {
    e.stopPropagation();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pressRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType };
    draggedRef.current = false;
    const onMove = (ev: PointerEvent) => {
      const press = pressRef.current;
      if (!press || ev.pointerId !== press.id) return;
      if (Math.hypot(ev.clientX - press.x, ev.clientY - press.y) < DRAG_THRESHOLD_PX) return;
      detach();
      draggedRef.current = true;
      onClose();
      // The drag machinery only reads clientX/clientY (+ pointerType for the
      // touch branch), so a minimal synthetic event is enough to hand off
      // mid-gesture.
      onArrowPointerDown({
        clientX: ev.clientX,
        clientY: ev.clientY,
        pointerId: ev.pointerId,
        pointerType: press.type,
      } as ReactPointerEvent);
    };
    const onUp = (ev: PointerEvent) => {
      if (pressRef.current && ev.pointerId !== pressRef.current.id) return;
      detach();
    };
    const detach = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      pressRef.current = null;
      detachRef.current = null;
    };
    detachRef.current = detach;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

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
      className="pointer-events-none absolute z-[var(--z-toolbar)]"
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
        onPointerDown={handlePlusPointerDown}
        onClick={() => {
          // A drag that became an arrow start still fires a click on
          // release; swallow it so the menu doesn't pop mid-draw.
          if (draggedRef.current) {
            draggedRef.current = false;
            return;
          }
          onToggle();
        }}
        onMouseEnter={handleHoverEnter}
        onMouseLeave={handleHoverLeave}
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
          onMouseEnter={handleHoverEnter}
          onMouseLeave={handleHoverLeave}
          style={{
            ...menu.pos,
            transformOrigin: menu.origin,
            transform: active ? `${menu.base} scale(1)` : `${menu.base} ${menu.collapsed}`,
            opacity: active ? 1 : 0,
            transition: 'transform 220ms cubic-bezier(0.34, 1.4, 0.64, 1), opacity 140ms ease',
          }}
        >
          {options.map((option, i) => {
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
                      else if (option.kind === 'add-point') onAddRailPoint?.();
                      else if (option.kind === 'add-row') onAddTableRow?.();
                      else if (option.kind === 'add-column') onAddTableColumn?.();
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
