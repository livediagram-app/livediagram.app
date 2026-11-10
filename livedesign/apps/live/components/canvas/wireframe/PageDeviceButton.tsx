'use client';

// A wireframe page's Frame (docs/specs/007-editor/wireframe-pages.md "Choosing the device"): the
// button beside its cog, its device's glyph (named Frame on a desktop, its device after the name in
// its tooltip), opening the Frame popover (WireframeDeviceSettings).
import type { LaidOutPage } from '@livedesign/design';
import { WIREFRAME_DEVICES } from '@livedesign/design';
import type { WireframeDevicePatch, WireframeFrameTheme } from '@livedesign/design';
import { TitlePopoverButton, titleButtonClass } from '../TitlePopoverButton';
import { DeviceGlyph } from './DeviceGlyph';
import { WireframeDeviceSettings } from './WireframeDeviceSettings';

const POPOVER_WIDTH = 344;
// The title-bar room it takes: the cog's size and a gap, or named beside its icon ("Frame" is
// narrower than Layout's "Layout", so it takes Layout's 78).
const DEVICE_ROOM = 28;
const DEVICE_LABELLED_ROOM = 78;

export function pageDeviceRoom(labelled: boolean): number {
  return labelled ? DEVICE_LABELLED_ROOM : DEVICE_ROOM;
}

export function PageDeviceButton({
  page,
  labelled,
  openRequest = 0,
  headless = false,
  onDevice,
  frameTheme,
}: {
  page: LaidOutPage;
  frameTheme?: WireframeFrameTheme | undefined;
  labelled: boolean;
  // Opens it from elsewhere each time it rises (a phone's Appearance sheet); 0 never does.
  openRequest?: number;
  // No button of its own: a phone's Appearance sheet opens it (TitlePopoverButton's headless).
  headless?: boolean;
  onDevice: (patch: WireframeDevicePatch) => void;
}) {
  const device = page.device ?? 'iphone';
  const popover = (
    <TitlePopoverButton
      name="Frame"
      detail={WIREFRAME_DEVICES[device].label}
      labelled={labelled}
      openRequest={openRequest}
      headless={headless}
      className={titleButtonClass}
      icon={<DeviceGlyph device={device} />}
      width={POPOVER_WIDTH}
    >
      <WireframeDeviceSettings page={page} onDevice={onDevice} frameTheme={frameTheme} />
    </TitlePopoverButton>
  );
  if (headless) return popover;
  return (
    <div
      className="pointer-events-auto"
      data-page-device-button={page.id}
      // A press here is the button's, never the canvas's (no marquee, no deselect, no draw).
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {popover}
    </div>
  );
}
