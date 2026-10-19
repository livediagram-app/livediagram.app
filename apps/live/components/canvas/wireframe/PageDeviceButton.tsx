'use client';

// A wireframe page's Device (docs/specs/007-editor/wireframe-pages.md "Choosing the device"): the
// button beside its cog, showing its device, opening the Device popover (WireframeDeviceSettings).
import type { LaidOutPage } from '@livediagram/document';
import { WIREFRAME_DEVICES } from '@livediagram/document';
import type { WireframeDevicePatch, WireframeFrameTheme } from '@livediagram/document';
import { TitlePopoverButton, titleButtonClass } from '../TitlePopoverButton';
import { DeviceGlyph } from './DeviceGlyph';
import { WireframeDeviceSettings } from './WireframeDeviceSettings';

const POPOVER_WIDTH = 344;
// The title-bar room it takes: the cog's size and a gap, or named beside its icon.
const DEVICE_ROOM = 28;
const DEVICE_LABELLED_ROOM = 112;

export function pageDeviceRoom(labelled: boolean): number {
  return labelled ? DEVICE_LABELLED_ROOM : DEVICE_ROOM;
}

export function PageDeviceButton({
  page,
  labelled,
  onDevice,
  frameTheme,
}: {
  page: LaidOutPage;
  frameTheme?: WireframeFrameTheme | undefined;
  labelled: boolean;
  onDevice: (patch: WireframeDevicePatch) => void;
}) {
  const device = page.device ?? 'iphone';
  return (
    <div
      className="pointer-events-auto"
      data-page-device-button={page.id}
      // A press here is the button's, never the canvas's (no marquee, no deselect, no draw).
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <TitlePopoverButton
        name={labelled ? WIREFRAME_DEVICES[device].label : 'Device'}
        labelled={labelled}
        className={titleButtonClass}
        icon={<DeviceGlyph device={device} />}
        width={POPOVER_WIDTH}
      >
        <WireframeDeviceSettings page={page} onDevice={onDevice} frameTheme={frameTheme} />
      </TitlePopoverButton>
    </div>
  );
}
