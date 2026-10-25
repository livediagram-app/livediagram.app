'use client';

// The Photo panel (docs/specs/031-photo/photo-pages.md "The Photo panel"): docked top-right by
// default, 360 px wide, the overview card (histogram, size, the pixel under the pointer) over three tabs, Layers,
// Adjust and History.
// An Editor works in it; a Participant sees the read-only Layers tab and the info line; a Viewer has
// no panel.
import { useState } from 'react';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { SegmentedRadio } from '@liveworkspace/workbench/components/primitives/SegmentedRadio';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import type { DockAnchor } from '@/lib/canvas-chrome';
import { track } from '@/lib/telemetry';
import { PhotoAdjustTab } from './PhotoAdjustTab';
import { PhotoLayersTab } from './PhotoLayersTab';
import { PhotoHistoryTab, PhotoOverview } from './PhotoPanelParts';

type Tab = 'layers' | 'adjust' | 'history';
const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'layers', label: 'Layers' },
  { id: 'adjust', label: 'Adjust' },
  { id: 'history', label: 'History' },
];

/** The panel's insides: the histogram, the info line and the three tabs (a docked panel's, or a phone's
 *  bottom sheet's). */
export function PhotoPanelBody({ photo }: { photo: PhotoEditorView }) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const [tab, setTab] = useState<Tab>('layers');
  const open = (t: Tab) => {
    setTab(t);
    track('UI', 'Opened', `PhotoPanel${t.charAt(0).toUpperCase()}${t.slice(1)}`);
  };
  const tabs = photo.canEdit ? TABS : TABS.filter((t) => t.id === 'layers');
  return (
    <div
      data-photo-panel=""
      className="flex max-h-[min(74vh,calc(100dvh-16rem))] min-h-0 flex-col gap-3 pb-1 pt-1"
    >
      <PhotoOverview photo={photo} />
      {tabs.length > 1 ? (
        <div className="px-3">
          <SegmentedRadio label="Photo Panel" options={tabs} value={tab} onChange={open} />
        </div>
      ) : null}
      {tab === 'layers' || !photo.canEdit ? (
        <PhotoLayersTab photo={photo} onOpenAdjust={() => open('adjust')} others={photo.others} />
      ) : tab === 'adjust' ? (
        <PhotoAdjustTab photo={photo} />
      ) : (
        <PhotoHistoryTab photo={photo} />
      )}
    </div>
  );
}

/** Over its Photo button in the Pages strip: open until the button is pressed again or the page loses focus,
 *  never closed by a press outside it (the photo is worked on beside it). */
export function PhotoPanel({
  photo,
  popoverAnchor,
  onPopoverClose,
}: {
  photo: PhotoEditorView;
  popoverAnchor?: DockAnchor;
  onPopoverClose: () => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  return (
    <MovablePanel
      title="Photo"
      position={null}
      defaultCorner="bottom-right"
      width="w-[360px] max-w-[calc(100vw-2rem)]"
      popoverWidth="w-[360px]"
      helpArticle="photoPages"
      dataTourId="photo-panel"
      onMoveTo={() => {}}
      asPopover
      popoverOpen
      popoverAnchor={popoverAnchor}
      onPopoverClose={onPopoverClose}
    >
      <PhotoPanelBody photo={photo} />
    </MovablePanel>
  );
}
