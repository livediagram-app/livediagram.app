'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

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
    const rect = node.getBoundingClientRect();
    const margin = 8;
    let dx = 0;
    let dy = 0;
    if (rect.left < margin) dx = margin - rect.left;
    else if (rect.right > window.innerWidth - margin) dx = window.innerWidth - margin - rect.right;
    if (rect.top < margin) dy = margin - rect.top;
    else if (rect.bottom > window.innerHeight - margin)
      dy = window.innerHeight - margin - rect.bottom;
    if (dx !== adjust.x || dy !== adjust.y) setAdjust({ x: dx, y: dy });
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
      className="fixed z-50 flex w-36 animate-fade-in flex-col rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
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
    ? 'cursor-not-allowed text-slate-300'
    : danger
      ? 'text-rose-700 hover:bg-rose-50'
      : 'text-slate-700 hover:bg-slate-100';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${tone}`}>
      <span className={disabled ? 'text-slate-300' : danger ? 'text-rose-600' : 'text-slate-400'}>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
