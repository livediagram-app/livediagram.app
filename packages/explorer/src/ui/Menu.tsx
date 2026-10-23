'use client';

// liveplanner's PortalMenu and its rows (components/primitives/PortalMenu.tsx): a floating command menu in a
// portal, anchored below its trigger and kept on screen, closed by a press outside or Escape, its items reached
// with the arrow keys. A header names what it is for, one full-width row per verb, groups apart.

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Portal } from './Portal';
import { useLatest } from './useLatest';

const ITEM = '[role="menuitem"]:not([aria-disabled="true"])';
const MARGIN = 8;

function placeMenu(anchor: HTMLElement, menu: HTMLElement): { left: number; top: number } {
  const a = anchor.getBoundingClientRect();
  const width = menu.offsetWidth || 224;
  const height = menu.offsetHeight || 0;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = a.right - width;
  left = Math.max(MARGIN, Math.min(left, vw - width - MARGIN));
  let top = a.bottom + 4;
  // Opens upward when there is no room below.
  if (height && top + height > vh - MARGIN && a.top - height - 4 > MARGIN) top = a.top - height - 4;
  return { left, top };
}

export function PortalMenu({
  anchor,
  onClose,
  label,
  wide = false,
  children,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  // The menu's name when no MenuHeader names it.
  label?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const close = useLatest(onClose);

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    setAt(placeMenu(anchor, ref.current));
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (ref.current?.contains(target) || anchor?.contains(target)) return;
      close.current();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close.current();
      anchor?.focus();
    };
    const onResize = () => close.current();
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onResize);
    };
  }, [anchor, close]);

  // The first item takes focus, so the arrow keys work from the start.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(ITEM)?.focus({ preventScroll: true });
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const items = [...(ref.current?.querySelectorAll<HTMLElement>(ITEM) ?? [])];
      if (items.length === 0) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const step: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
      if (e.key in step) {
        e.preventDefault();
        items[(i + step[e.key]! + items.length) % items.length]?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        items[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1]?.focus();
      } else if (e.key === 'Tab') {
        close.current();
      }
    },
    [close],
  );

  return (
    <Portal>
      <div
        ref={ref}
        role="menu"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`fixed z-50 flex ${wide ? 'w-80' : 'w-56'} animate-fade-in flex-col rounded-md border border-slate-200 bg-white/90 py-1 text-sm shadow-lg outline-none backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-slate-950/40`}
        style={at ? { left: at.left, top: at.top } : { left: -9999, top: -9999 }}
      >
        {children}
      </div>
    </Portal>
  );
}

// One verb: icon, then its label, sentence case at reading size (the "plain" rows of liveplanner's menus).
export function MenuActionRow({
  label,
  icon,
  onClick,
  disabled = false,
  checked,
}: {
  label: string;
  icon: ReactNode;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  // A toggle row (a tag in the picker): announced as checked or not.
  checked?: boolean;
}) {
  return (
    <button
      type="button"
      role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      tabIndex={-1}
      onClick={disabled ? undefined : onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] outline-none transition ${
        disabled
          ? 'cursor-not-allowed text-slate-500 dark:text-slate-600'
          : 'cursor-pointer text-slate-700 hover:bg-slate-100 focus-visible:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800'
      }`}
    >
      <span className="flex w-5 shrink-0 items-center justify-center text-slate-400 [&_svg]:h-4 [&_svg]:w-4">
        {icon}
      </span>
      {label}
    </button>
  );
}

// A quiet first row naming what the menu is for: the item's name and its badge.
export function MenuHeader({ title, aside }: { title: string; aside?: ReactNode }) {
  const id = useId();
  return (
    <div
      aria-hidden
      className="mb-1 flex items-center gap-2 border-b border-slate-100 px-3 pb-2 pt-1.5 dark:border-slate-800"
    >
      <span
        id={id}
        className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700 dark:text-slate-200"
      >
        {title}
      </span>
      {aside ? <span className="shrink-0">{aside}</span> : null}
    </div>
  );
}

export function MenuGroupSeparator() {
  return (
    <div className="my-1.5 px-2" role="separator">
      <div className="h-px bg-slate-200/90 dark:bg-slate-700/80" />
    </div>
  );
}
