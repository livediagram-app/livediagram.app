'use client';

// Choose a Device (docs/specs/007-editor/wireframe-pages.md "Choosing the device"): the step a
// Wireframe card turns the Add a Page popover, and the first page's choice, to. The device tiles,
// the one last chosen in this browser ringed and focused, and Back to the kinds.
import type { WireframeDeviceId } from '@livedocuments/document';
import { ChevronLeftIcon } from '@livedocuments/ui';
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
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onBack}
          className="flex h-6 items-center gap-0.5 rounded-md pl-0.5 pr-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <ChevronLeftIcon />
          Back
        </button>
        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Choose a Device</p>
      </div>
      <DevicePicker
        current={lastWireframeDevice()}
        onChoose={onChoose}
        columns={columns}
        autoFocus
      />
    </div>
  );
}
