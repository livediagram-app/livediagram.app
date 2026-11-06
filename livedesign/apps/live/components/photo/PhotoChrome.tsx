'use client';

// A photo page's chrome while it is in focus (docs/specs/031-photo/photo-pages.md "Working on a photo
// page"): the options flyout under the tool's button in the palette strip (the photo tools are in the strip itself,
// PhotoStripTools); on a phone the tools are a row at the bottom, a tap on the tool in hand opening its options as a
// bottom sheet (PhotoPhoneOptions), and the Photo panel a bottom sheet. An Editor sees both; a Participant the Eyedropper alone, and on a phone the sheet
// (photo-pages.md "Share roles"); a Viewer nothing.
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { toolbarTopClearancePx } from '@/lib/canvas-chrome';
import { CLUSTER_STRIP } from '@liveworkspace/workbench/components/canvas/cluster-strip';
import { useState } from 'react';
import { BottomSheet } from '@liveworkspace/workbench/components/primitives/BottomSheet';
import { PhotoDialogs } from './PhotoDialogs';
import { PhotoPanelBody } from './PhotoPanel';
import { PhotoPhoneHeldBar, PhotoPhoneOptionsSheet } from './PhotoPhoneOptions';
import { PhotoToolsRail } from './PhotoToolsRail';
import { PhotoBusyPill } from './PhotoBusyPill';
import { PhotoToolFlyout } from './PhotoToolFlyout';
import { PhotoQuickPanel } from './PhotoQuickPanel';
import { usePhotoDropPaste } from './usePhotoDropPaste';
import { usePhotoShortcuts } from './usePhotoShortcuts';
import { usePressOutsideDismiss } from './useToolFlyoutDismiss';

// A press in these is the Layers sheet's own (photo-pages.md "The Photo panel"): the sheet, its Layers button (which
// toggles it), and the menus, popovers, pickers and dialogs it opens, portalled out of it. The tools row is outside:
// taking a tool puts the sheet away for the photo.
const LAYERS_SHEET_INSIDE =
  '[data-photo-layers-sheet], [data-photo-layers-button], [data-anchored-popover], [data-colour-picker], [data-photo-gradient-editor], [role="menu"], [role="dialog"], [role="alertdialog"]';
// Escape in a field (a layer's name being typed), a menu, a popover or a dialog is that one's.
const LAYERS_SHEET_ESCAPE_ELSEWHERE =
  'input, textarea, select, [contenteditable="true"], [data-anchored-popover], [role="menu"], [role="dialog"], [role="alertdialog"]';

export function PhotoChrome({
  photo,
  scale,
  left = 12,
}: {
  photo: PhotoEditorView | undefined;
  scale: number;
  /** How far the quick panel sits from the canvas's left edge: past a Contents sidebar docked there. */
  left?: number;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const mobile = useIsMobileViewport();
  // A phone's Photo panel: a bottom sheet off the rail's Layers button.
  const [sheet, setSheet] = useState(false);
  const live = !!photo?.session && photo.canEdit;
  const inspect = !!photo?.session && !photo.canEdit && photo.canInspect;
  usePhotoShortcuts(live ? photo : null);
  usePhotoDropPaste(live ? photo : null);
  // A tap outside the sheet (the photo, the canvas, the tools row) or Escape puts it away, as the options sheet.
  usePressOutsideDismiss(
    mobile && sheet,
    LAYERS_SHEET_INSIDE,
    () => setSheet(false),
    LAYERS_SHEET_ESCAPE_ELSEWHERE,
  );
  if (!photo || !(live || inspect)) return null;
  const top = toolbarTopClearancePx(scale);
  if (mobile)
    return (
      <>
        {live ? <PhotoDialogs photo={photo} /> : null}
        {live ? <PhotoBusyPill top={top + 8} /> : null}
        {live ? <PhotoPhoneOptionsSheet photo={photo} /> : null}
        {/* The room under the strip the page frames below, as on a desktop. */}
        <div
          data-photo-options=""
          aria-hidden
          className="invisible absolute left-3 h-px w-px"
          style={{ top }}
        />
        {sheet ? (
          <BottomSheet
            onClose={() => setSheet(false)}
            zClassName="z-[var(--z-popover)]"
            data-photo-layers-sheet=""
          >
            <PhotoPanelBody photo={photo} />
          </BottomSheet>
        ) : null}
        <div
          className="pointer-events-none absolute inset-x-2 z-[var(--z-panel)] flex flex-col items-start gap-2"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)' }}
        >
          {live ? <PhotoPhoneHeldBar photo={photo} /> : null}
          <div className="pointer-events-auto flex w-full items-stretch gap-2">
            <div className="min-w-0 flex-1">
              <PhotoToolsRail placement="row" inspect={!live} />
            </div>
            <button
              type="button"
              data-photo-layers-button=""
              aria-expanded={sheet}
              onClick={() => setSheet((open) => !open)}
              className={`${CLUSTER_STRIP} shrink-0 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200`}
            >
              {/* The strip stretches its children: the name held in the middle of the rail's height. */}
              <span className="my-auto">Layers</span>
            </button>
          </div>
        </div>
      </>
    );
  return (
    <>
      {live ? <PhotoDialogs photo={photo} /> : null}
      {/* The room under the strip the page frames below (top-strip-inset reads `data-photo-options`). */}
      <div
        data-photo-options=""
        aria-hidden
        className="invisible absolute left-3 h-px w-px"
        style={{ top }}
      />
      {live ? <PhotoToolFlyout photo={photo} /> : null}
      {live ? <PhotoQuickPanel photo={photo} top={top + 8} left={left} /> : null}
      {live ? <PhotoBusyPill top={top + 8} /> : null}
    </>
  );
}
