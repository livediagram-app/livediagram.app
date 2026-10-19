'use client';

// A wireframe page's device settings (docs/specs/007-editor/wireframe-pages.md "Choosing the
// device"): the page's device (fixed once made), then Orientation while it turns, the Frame look, and
// System Bars while it has them. The Device popover's body and the page panel's Device tab.
import {
  WIREFRAME_DEVICES,
  WIREFRAME_FRAME_LOOKS,
  WIREFRAME_FRAME_LOOK_LABEL,
  deviceHasSystemBars,
  type LaidOutPage,
  type PageOrientation,
  type WireframeDevicePatch,
  type WireframeFrameTheme,
} from '@livediagram/document';
import { SegmentedRadio } from '@/components/primitives/SegmentedRadio';
import { SwitchRow } from '@/components/primitives/SwitchRow';
import { DeviceMiniature } from './DeviceMiniature';

const ORIENTATIONS: readonly { id: PageOrientation; label: string }[] = [
  { id: 'portrait', label: 'Portrait' },
  { id: 'landscape', label: 'Landscape' },
];
const LOOKS = WIREFRAME_FRAME_LOOKS.map((id) => ({ id, label: WIREFRAME_FRAME_LOOK_LABEL[id] }));

const HEADING = 'mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400';

export function WireframeDeviceSettings({
  page,
  onDevice,
  onOrientation,
  frameTheme,
}: {
  page: LaidOutPage;
  // The tab theme's colours, for the tiles in the Theme look.
  frameTheme?: WireframeFrameTheme | undefined;
  onDevice: (patch: WireframeDevicePatch) => void;
  // A turn, the page panel's own (it frames the page again); absent, the popover turns it as a device change.
  onOrientation?: (next: PageOrientation) => void;
}) {
  const device = page.device ?? 'iphone';
  const look = page.frameLook ?? 'theme';
  const turns = WIREFRAME_DEVICES[device].turns;
  const { width, height } = WIREFRAME_DEVICES[device].screen;
  const screenSize =
    page.orientation === 'landscape' && turns ? `${height} x ${width}` : `${width} x ${height}`;
  return (
    <div data-wireframe-device-settings="" className="flex flex-col gap-3">
      {/* The device is the page's for good, chosen as it was added; shown, not changed. */}
      <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
        <DeviceMiniature
          device={device}
          look={look}
          theme={frameTheme}
          landscape={page.orientation === 'landscape'}
          width={44}
          height={40}
        />
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-slate-900 dark:text-slate-100">
            {WIREFRAME_DEVICES[device].label}
          </span>
          <span className="block text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
            {screenSize}
          </span>
        </span>
      </div>
      {turns ? (
        <div>
          <p className={HEADING}>Orientation</p>
          <SegmentedRadio
            label="Orientation"
            options={ORIENTATIONS}
            value={page.orientation}
            onChange={(next) =>
              onOrientation ? onOrientation(next) : onDevice({ orientation: next })
            }
          />
        </div>
      ) : null}
      <div>
        <p className={HEADING}>Frame</p>
        <SegmentedRadio
          label="Frame"
          options={LOOKS}
          value={look}
          onChange={(frameLook) => onDevice({ frameLook })}
        />
      </div>
      {deviceHasSystemBars(device) ? (
        <div>
          <SwitchRow
            checked={page.systemBars !== false}
            onChange={(systemBars) => onDevice({ systemBars })}
            className="py-1 text-xs"
          >
            System Bars
          </SwitchRow>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            The status bar and home indicator, drawn over the screen.
          </p>
        </div>
      ) : null}
    </div>
  );
}
