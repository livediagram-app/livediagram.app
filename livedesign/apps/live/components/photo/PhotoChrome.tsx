'use client';

// A photo page's chrome while it is in focus (docs/specs/031-photo/photo-pages.md "Working on a photo
// page"): the options flyout under the tool's button in the palette strip (the photo tools are in the strip itself,
// PhotoStripTools); on a phone the tools are a row at the bottom, a tap on the tool in hand opening its options as a
// bottom sheet (PhotoPhoneOptions), and the Photo panel a bottom sheet. An Editor sees both; a Participant the Eyedropper alone, and on a phone the sheet
// (photo-pages.md "Share roles"); a Viewer nothing.
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { toolbarTopClearancePx } from '@/lib/canvas-chrome';
import { CLUSTER_STRIP } from '@liveworkspace/workbench/components/canvas/cluster-strip';
import { useState } from 'react';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { PhotoDialogs } from './PhotoDialogs';
import { PhotoPanelBody } from './PhotoPanel';
import { PhotoPhoneHeldBar, PhotoPhoneOptionsSheet } from './PhotoPhoneOptions';
import { PhotoToolsRail } from './PhotoToolsRail';
import { PhotoBusyPill } from './PhotoBusyPill';
import { PhotoToolFlyout } from './PhotoToolFlyout';
import { PhotoQuickPanel } from './PhotoQuickPanel';
import { usePhotoDropPaste } from './usePhotoDropPaste';
import { usePhotoShortcuts } from './usePhotoShortcuts';

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
          <BottomSheet onClose={() => setSheet(false)} zClassName="z-[var(--z-popover)]">
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
              onClick={() => setSheet(true)}
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
