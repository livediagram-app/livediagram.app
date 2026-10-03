'use client';

import type { ReactNode, RefObject } from 'react';
import { CloseIcon, Glyph } from '@livediagram/ui';

// The parts of a MenuFlyoutSection (MenuFlyoutSection.tsx): its trigger's two faces (a section
// header, or a plain verb row) and the floating panel that holds its contents.

export const sectionTriggerClass = (open: boolean) =>
  `flex w-full cursor-pointer items-center justify-between px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition ${
    open
      ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
      : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-300'
  }`;

export const plainTriggerClass = (open: boolean) =>
  `flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-[13px] transition ${
    open
      ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
  }`;

export function SectionTriggerFace({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <>
      <span className="flex items-center gap-2">
        <span className="flex w-4 shrink-0 items-center justify-center">{icon}</span>
        {title}
      </span>
      {/* Ellipsis — signals the row opens further sub-options (in a side
          flyout), distinct from an accordion's chevron that expands inline. */}
      <Glyph size={14} units={16} filled>
        <circle cx="4" cy="8" r="1.15" />
        <circle cx="8" cy="8" r="1.15" />
        <circle cx="12" cy="8" r="1.15" />
      </Glyph>
    </>
  );
}

export function FlyoutPanel({
  panelRef,
  isPanel,
  isMobile,
  pos,
  icon,
  title,
  onClose,
  children,
}: {
  panelRef: RefObject<HTMLDivElement | null>;
  isPanel: boolean;
  isMobile: boolean;
  pos: { left: number; top: number; width?: number; minHeight?: number } | null;
  icon: ReactNode;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label={title}
      data-menu-flyout=""
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      // z-popover, not z-overlay: this panel opens FROM a menu that is itself
      // z-modal, so at z-overlay it lost the stacking contest with its own
      // host. On a wide screen that never showed, because the panel fits
      // beside the menu and never overlaps it. On a narrow one there is no
      // room to the side, the clamp puts it directly over the menu, and it
      // rendered behind — tapping Collaborate on a phone appeared to do
      // nothing at all. Same reason the token exists for menus opened inside
      // a dialog.
      className={`fixed z-[var(--z-popover)] flex animate-fade-in flex-col rounded-md ${
        isPanel
          ? 'max-h-[calc(100dvh-1rem)] w-72 overflow-y-auto overscroll-contain'
          : 'w-56 overflow-hidden'
      } border border-slate-200 bg-white/95 text-sm shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-slate-950/40`}
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        ...(pos?.width ? { width: pos.width } : null),
        ...(pos?.minHeight ? { minHeight: pos.minHeight } : null),
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      {/* Mobile only. On desktop the flyout sits BESIDE its parent, so
          the parent is still on screen and still shows which row is
          open — the panel needs no title and no way back. Covering the
          parent takes both of those away, so the header restores them:
          it says which category you are in, and Close is the way back
          to the menu underneath. */}
      {isMobile ? (
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
          <span className="flex min-w-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span className="flex w-4 shrink-0 items-center justify-center">{icon}</span>
            <span className="truncate">{title}</span>
          </span>
          <button
            type="button"
            aria-label={`Close ${title}`}
            onClick={onClose}
            className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <CloseIcon />
          </button>
        </div>
      ) : null}
      {children}
    </div>
  );
}
