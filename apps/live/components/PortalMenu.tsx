'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { clampToViewport } from '@/lib/clamp-to-viewport';

type Placement = 'above' | 'below';

type PortalMenuProps = {
  anchor: HTMLElement | null;
  placement?: Placement;
  onClose: () => void;
  children: ReactNode;
};

// Right-align the menu's right edge with the anchor's right edge and place
// it above or below, with a small gap.
const PLACEMENT_TRANSFORM: Record<Placement, string> = {
  above: 'translate(-100%, calc(-100% - 4px))',
  below: 'translate(-100%, 4px)',
};

/**
 * Floating context menu rendered through `createPortal` to `document.body`.
 * Anchored to an arbitrary element via its bounding rect; auto-clamps to the
 * viewport edges; closes when the user clicks outside the menu.
 *
 * Used by the tab bar (above the ellipsis button) and the editor header
 * (below the diagram-title ellipsis button).
 */
export function PortalMenu({ anchor, placement = 'below', onClose, children }: PortalMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [adjust, setAdjust] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!anchor) return;
    const update = () => {
      const r = anchor.getBoundingClientRect();
      setPos({
        left: r.right,
        top: placement === 'below' ? r.bottom : r.top,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchor, placement]);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !pos) return;
    const next = clampToViewport(node.getBoundingClientRect(), adjust);
    if (next.x !== adjust.x || next.y !== adjust.y) setAdjust(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target) && e.target !== anchor) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchor]);

  if (typeof document === 'undefined' || !pos) return null;

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 flex w-36 animate-fade-in flex-col rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
      style={{
        left: pos.left + adjust.x,
        top: pos.top + adjust.y,
        transform: PLACEMENT_TRANSFORM[placement],
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

type MenuItemProps = {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

export function MenuItem({ icon, label, onClick, danger, disabled }: MenuItemProps) {
  const base =
    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition';
  const tone = disabled
    ? 'cursor-not-allowed text-slate-300 dark:text-slate-600'
    : danger
      ? 'text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/15'
      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${tone}`}>
      <span
        className={
          disabled
            ? 'text-slate-300 dark:text-slate-600'
            : danger
              ? 'text-rose-600 dark:text-rose-300'
              : 'text-slate-400 dark:text-slate-500'
        }
      >
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
