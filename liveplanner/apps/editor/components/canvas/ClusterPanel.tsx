'use client';

// A panel flying out of a bottom-right cluster button (docs/specs/011-theme/canvas-and-theme-dialog.md for Tab Style,
// docs/specs/026-plan/plan-board.md "Configure" for a board's): on a screen wider than a phone, its bottom-right corner
// sits just above its button and it grows from there; without the button on screen (a whiteboard, an embed) it is a
// centred dialog, and on a phone a bottom sheet whose grab handle drags it taller or down to close. No dimming: what
// it changes applies live, so the work behind stays in view, and the full-screen layer is a transparent click-catcher
// (click outside closes it; a right-click never leaks to the canvas).
import { use, useId, useRef, useState, type ReactNode } from 'react';
import { browser } from 'react-dom';
import {
  useEscape,
  useFocusTrap,
  Portal,
  DialogCloseButton,
  SheetHandle,
  safeInset,
  useSheetDrag,
} from '@liveplanner/ui';
import { HeroDialogHeader, type HeroArt } from '@liveworkspace/ui/dialog-hero';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@liveworkspace/workbench/lib/ui-scale';
import { useModalGuard } from '@liveworkspace/workbench/hooks/ui/useModalGuard';

export function ClusterPanel({
  label,
  title,
  subtitle,
  headerEnd,
  anchorSelector,
  width = 'w-[44rem]',
  hero,
  onClose,
  children,
}: {
  // The dialog's accessible name.
  label: string;
  title: string;
  // A line under the title (only on a home, typically).
  subtitle?: ReactNode;
  // Window controls before the close button (a help link).
  headerEnd?: ReactNode;
  // The cluster button it flies out of.
  anchorSelector: string;
  // Its width on a screen wider than a phone (a Tailwind width class).
  width?: string;
  // The dialog hero header's art (liveworkspace/docs/specs/004-index/dialog-hero-header.md), drawn in place of the
  // plain title row: Configure Board wears it, Tab Style keeps the row.
  hero?: HeroArt;
  onClose: () => void;
  children: ReactNode;
}) {
  // Mount-open modal: silence the canvas shortcut and paste listeners behind it.
  useModalGuard(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  const anchor = useClusterAnchor(anchorSelector);
  const panelScale = useUiScale('panels');
  const sheet = useSheetDrag(onClose);
  const titleId = useId();
  useEscape(onClose);

  return (
    <Portal>
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className={`fixed inset-0 z-[var(--z-modal)] flex ${anchor ? '' : 'items-center justify-center max-sm:items-end'}`}
      >
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className={`flex max-h-[calc(100%-2rem)] ${width} max-w-[calc(100%-2rem)] flex-col rounded-xl border border-slate-200 bg-white shadow-xl outline-none max-sm:max-h-[75dvh] max-sm:w-full max-sm:max-w-none max-sm:animate-sheet-up max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-x-0 max-sm:border-b-0 max-sm:shadow-[0_-8px_40px_-12px_rgb(0_0_0/0.25)] dark:border-slate-700 dark:bg-slate-900 ${anchor ? 'fixed animate-fly-up-in shadow-2xl motion-reduce:animate-fade-in' : ''}`}
          // Drawn at the Panels UI scale like every other panel (docs/specs/007-editor/ui-scale.md); under its `zoom`
          // the anchored offsets are in the panel's own px, so they are converted (toSurfacePx).
          style={
            anchor
              ? {
                  ...uiScaleStyle(panelScale),
                  right: toSurfacePx(anchor.right, panelScale),
                  bottom: toSurfacePx(anchor.bottom, panelScale),
                  maxHeight: `calc(100% - ${toSurfacePx(anchor.bottom + 16, panelScale)}px)`,
                  transformOrigin: 'bottom right',
                }
              : { ...uiScaleStyle(panelScale), ...sheet.style, paddingBottom: safeInset('bottom') }
          }
        >
          {/* Over a hero band on a phone, the handle stands over it (relative z-10). */}
          <SheetHandle
            handleProps={sheet.handleProps}
            className={hero ? 'relative z-10 sm:hidden' : 'sm:hidden'}
          />
          {hero ? (
            <HeroDialogHeader
              art={hero}
              titleId={titleId}
              title={title}
              subtitle={subtitle}
              actions={headerEnd}
              onClose={onClose}
              underHandle
            />
          ) : (
            <div className="flex flex-col gap-2 border-b border-slate-200 px-4 pb-2.5 pt-3 max-sm:pt-0 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {title}
                  </h2>
                  {subtitle ? (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>
                  ) : null}
                </div>
                {/* Help sits with the close button, where the editor's dialogs keep their window controls. */}
                <div className="flex items-center gap-1">
                  {headerEnd}
                  <DialogCloseButton compact onClick={onClose} />
                </div>
              </div>
            </div>
          )}
          {/* A fixed least height, so moving between the home and its panels never makes it jump. */}
          <div className="min-h-[20rem] overflow-y-auto px-5 pb-4 pt-2">{children}</div>
        </div>
      </div>
    </Portal>
  );
}

// The button's place: how far the panel's right edge and bottom sit from the window's, so it sits just above the
// button with its right edge on the cluster's (the screen's right-hand side). Null without the button on screen, or on
// a phone (below 640 px), where it stays a dialog.
const ANCHOR_GAP_PX = 8;
function useClusterAnchor(selector: string): { right: number; bottom: number } | null {
  // Read once as it opens, in the browser only (use(browser())): the button does not move while it is open.
  use(browser());
  const [anchor] = useState<{ right: number; bottom: number } | null>(() => {
    if (window.innerWidth < 640) return null;
    const button = document.querySelector<HTMLElement>(selector);
    const box = button?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    // The cluster's right edge (the zoom controls end it), else the button's own.
    const cluster = document
      .querySelector<HTMLElement>('[data-zoom-cluster]')
      ?.getBoundingClientRect();
    const edge = cluster && cluster.width > 0 ? Math.max(cluster.right, box.right) : box.right;
    return {
      right: Math.max(8, Math.round(window.innerWidth - edge)),
      bottom: Math.round(window.innerHeight - box.top + ANCHOR_GAP_PX),
    };
  });
  return anchor;
}
