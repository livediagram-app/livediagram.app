'use client';

// Choose a Device (docs/specs/007-editor/wireframe-pages.md "Choosing the device"): the step the
// first page's Wireframe card turns its choice to. The device tiles,
// the one last chosen in this browser ringed and focused, under the back bar to All kinds.
import type { WireframeDeviceId } from '@livedesign/design';
import { BackBar } from '@livedesign/ui';
import { lastWireframeDevice } from '@/lib/wireframe-device-memory';
import { DevicePicker } from './DevicePicker';

export function ChooseDeviceStep({
  onChoose,
  onBack,
  columns = 4,
}: {
  onChoose: (device: WireframeDeviceId) => void;
  onBack: () => void;
  columns?: 3 | 4;
}) {
  return (
    <div className="flex flex-col gap-2" data-choose-device="">
      <BackBar label="All kinds" current="Wireframe" onClick={onBack} gap="tight" />
      <p className="px-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
        Choose a Device
      </p>
      <DevicePicker
        current={lastWireframeDevice()}
        onChoose={onChoose}
        columns={columns}
        autoFocus
      />
    </div>
  );
}
