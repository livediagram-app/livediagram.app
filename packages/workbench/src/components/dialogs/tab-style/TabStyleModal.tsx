'use client';

// The Tab Style dialog's shared frame (liveworkspace/docs/specs/011-workbench/tab-style.md "What is shared",
// "Placement"): a popover hanging from what opened it on a screen 640 px wide and up, the centred dialog without it, a
// bottom sheet on a phone. No dimming: every control applies live, so the person watches the tab change behind it,
// and the full-screen layer is a transparent click-catcher (an outside click closes it; a right-click never leaks to
// the canvas). Under the dialog hero header (liveworkspace/docs/specs/004-index/dialog-hero-header.md): the swatch
// fan's band, the title and the line for the view that is up, then Show Me, the help link and the close.

import { useId, useRef } from 'react';
import {
  Portal,
  SheetHandle,
  safeInset,
  useEscape,
  useFocusTrap,
  useSheetDrag,
} from '@liveworkspace/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { canvasThemeHeroArt } from '@liveworkspace/ui/dialog-hero-art/canvas-theme';
import { useUiScale } from '../../providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '../../../lib/ui-scale';
import { useModalGuard } from '../../../hooks/ui/useModalGuard';
import { useTabStyleAnchor } from './useTabStyleAnchor';
import { TAB_STYLE_TITLE, type TabStyleFrame, type TabStyleFrameParts } from './tab-style-profile';

export function TabStyleModal({
  frame,
  title,
  subtitle,
  help,
  tourApi,
  onClose,
  children,
}: TabStyleFrameParts & { frame: Extract<TabStyleFrame, { kind: 'modal' }> }) {
  // Mount-open modal: silence the canvas shortcut and paste listeners behind it (lib/modal-guard).
  useModalGuard(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(dialogRef);
  const anchor = useTabStyleAnchor(frame.opener);
  const panelScale = useUiScale('panels');
  // On a phone it is a bottom sheet, its grab handle dragging it taller or down to close (BottomSheet's).
  const sheet = useSheetDrag(onClose);
  // Show Me: the tour of the home, run on this dialog.
  const { useTabStyleTour, TabStyleShowMeButton, TabStyleTourStage } = frame.tour;
  const tour = useTabStyleTour(tourApi);
  // While Show Me runs, Escape is the tour's, never the dialog's.
  useEscape(onClose, { enabled: !tour.active });
  const hanging = anchor && 'top' in anchor;

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
          aria-label={title === TAB_STYLE_TITLE ? 'Tab style' : title}
          // A bottom sheet on a phone, rising from the bottom edge as the editor's other phone sheets do, the canvas
          // still in view above it so each pick shows on the tab.
          className={`flex max-h-[calc(100%-2rem)] w-[44rem] max-w-[calc(100%-2rem)] flex-col rounded-xl border border-slate-200 bg-white shadow-xl outline-none max-sm:max-h-[75dvh] max-sm:w-full max-sm:max-w-none max-sm:animate-sheet-up max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-x-0 max-sm:border-b-0 max-sm:shadow-[0_-8px_40px_-12px_rgb(0_0_0/0.25)] dark:border-slate-700 dark:bg-slate-900 ${anchor ? `fixed ${hanging ? 'animate-dialog-in' : 'animate-fly-up-in'} shadow-2xl motion-reduce:animate-fade-in` : ''}`}
          // Drawn at the Panels UI scale like every other panel (each product's 007-editor/ui-scale.md); under its
          // `zoom` the anchored offsets are in the panel's own px, so they are converted (toSurfacePx).
          style={
            anchor
              ? {
                  ...uiScaleStyle(panelScale),
                  right: toSurfacePx(anchor.right, panelScale),
                  ...('top' in anchor
                    ? {
                        top: toSurfacePx(anchor.top, panelScale),
                        maxHeight: `calc(100% - ${toSurfacePx(anchor.top + 16, panelScale)}px)`,
                        transformOrigin: 'top right',
                      }
                    : {
                        bottom: toSurfacePx(anchor.bottom, panelScale),
                        maxHeight: `calc(100% - ${toSurfacePx(anchor.bottom + 16, panelScale)}px)`,
                        transformOrigin: 'bottom right',
                      }),
                }
              : { ...uiScaleStyle(panelScale), ...sheet.style, paddingBottom: safeInset('bottom') }
          }
        >
          {/* The grab handle stands over the header's band, which runs up under it on a phone. */}
          <SheetHandle handleProps={sheet.handleProps} className="relative z-10 sm:hidden" />
          {/* "Appearance" is the VIEWER's own light / dark chrome, so this dialog, the tab's look shared with
              everyone, takes the name of the section that opens it. */}
          <HeroDialogHeader
            art={canvasThemeHeroArt}
            titleId={titleId}
            title={title}
            subtitle={subtitle}
            actions={
              <>
                <TabStyleShowMeButton tour={tour} />
                {help}
              </>
            }
            onClose={onClose}
            underHandle
          />
          {/* Fixed min-height so switching between views doesn't collapse the modal and make it jump around. */}
          <div className="min-h-[20rem] overflow-y-auto px-5 pb-4 pt-2">{children}</div>
        </div>
      </div>
      <TabStyleTourStage tour={tour} />
    </Portal>
  );
}
