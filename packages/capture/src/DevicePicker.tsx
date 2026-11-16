'use client';

// The microphone and camera pickers, one row each, on the shared Select (a real <select>, so the keyboard, a phone's
// own picker and a screen reader work as they do everywhere). The camera row ends with No Camera, which a call or a
// walkthrough reads as the camera off. A row with nothing to pick says so rather than offering an empty list.

import { Select } from '@liveworkspace/ui';
import { useId } from 'react';
import type { CaptureDevices } from './devices';

export const NO_CAMERA = 'none';

export type DevicePickerProps = {
  devices: CaptureDevices;
  // The picked microphone's id, or null for the browser's default.
  microphone: string | null;
  // The picked camera's id, null for the browser's default, or NO_CAMERA.
  camera: string | null;
  onMicrophone: (id: string | null) => void;
  onCamera: (id: string | null) => void;
  disabled?: boolean;
  // Leave the camera row out (a sound-only capture).
  withCamera?: boolean;
};

export function DevicePicker({
  devices,
  microphone,
  camera,
  onMicrophone,
  onCamera,
  disabled = false,
  withCamera = true,
}: DevicePickerProps) {
  const id = useId();
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5">
      <label
        htmlFor={`${id}-mic`}
        className="text-xs font-medium text-slate-600 dark:text-slate-300"
      >
        Microphone
      </label>
      <Select
        id={`${id}-mic`}
        value={microphone ?? ''}
        disabled={disabled || devices.microphones.length === 0}
        onChange={(e) => onMicrophone(e.target.value || null)}
        className="min-w-0"
      >
        {devices.microphones.length === 0 ? <option value="">No microphone found</option> : null}
        {devices.microphones.length > 0 ? <option value="">Default</option> : null}
        {devices.microphones.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
          </option>
        ))}
      </Select>
      {withCamera ? (
        <>
          <label
            htmlFor={`${id}-camera`}
            className="text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            Camera
          </label>
          <Select
            id={`${id}-camera`}
            value={camera ?? ''}
            disabled={disabled}
            onChange={(e) => onCamera(e.target.value || null)}
            className="min-w-0"
          >
            {devices.cameras.length > 0 ? <option value="">Default</option> : null}
            {devices.cameras.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
            <option value={NO_CAMERA}>No Camera</option>
          </Select>
        </>
      ) : null}
    </div>
  );
}
