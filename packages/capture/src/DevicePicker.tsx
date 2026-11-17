'use client';

// The microphone and camera pickers, one row each, on the shared Select (a real <select>, so the keyboard, a phone's
// own picker and a screen reader work as they do everywhere). The camera row starts with an on/off switch, and its
// list shows only while the camera is on: off is the switch, never an entry in the list. Both lists follow one rule
// (liveworkspace/docs/specs/006-media/walkthroughs.md "The device pickers"): devices to pick are Default and their
// names; none because the browser hasn't been allowed to show them is an Allow button that asks it; none at all is a
// disabled list saying No Microphone Found or No Camera Found.

import { Button, Select, Switch } from '@liveworkspace/ui';
import { useId } from 'react';
import type { CaptureDevice, CaptureDevices } from './devices';

// The camera's id for "no camera", which the recorder reads as off.
export const NO_CAMERA = 'none';

export type CaptureKind = 'microphone' | 'camera';

export type DevicePickerProps = {
  devices: CaptureDevices;
  // The picked microphone's id, or null for the browser's default.
  microphone: string | null;
  // The picked camera's id, or null for the browser's default.
  camera: string | null;
  onMicrophone: (id: string | null) => void;
  onCamera: (id: string | null) => void;
  // The camera switch: on shows the camera list, off records sound only.
  cameraOn: boolean;
  onCameraOn: (on: boolean) => void;
  // Asks the browser for the device (its permission prompt), for a list it hasn't been allowed to show yet.
  onAllow: (kind: CaptureKind) => void;
  disabled?: boolean;
  // Leave the camera row out (a sound-only capture).
  withCamera?: boolean;
};

const LABEL = 'text-xs font-medium text-slate-600 dark:text-slate-300';

const NOUN: Record<CaptureKind, string> = { microphone: 'Microphone', camera: 'Camera' };

/** One device list, the same for both kinds: a list to pick from, an Allow button, or No <Kind> Found. */
function DeviceList({
  id,
  kind,
  label,
  list,
  locked,
  value,
  disabled,
  onChange,
  onAllow,
}: {
  id: string;
  kind: CaptureKind;
  label?: string | undefined;
  list: readonly CaptureDevice[];
  locked: boolean;
  value: string | null;
  disabled: boolean;
  onChange: (id: string | null) => void;
  onAllow: (kind: CaptureKind) => void;
}) {
  if (list.length === 0 && locked) {
    return (
      <span className="flex min-w-0 items-center justify-between gap-2" data-device-locked={kind}>
        <span className="truncate text-xs text-slate-500 dark:text-slate-400">Not allowed yet</span>
        <Button variant="secondary" size="xs" disabled={disabled} onClick={() => onAllow(kind)}>
          {`Allow ${NOUN[kind]}`}
        </Button>
      </span>
    );
  }
  return (
    <Select
      id={id}
      aria-label={label}
      value={list.length === 0 ? '' : (value ?? '')}
      disabled={disabled || list.length === 0}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full min-w-0"
    >
      {list.length === 0 ? (
        <option value="">No {NOUN[kind]} Found</option>
      ) : (
        <option value="">Default</option>
      )}
      {list.map((d) => (
        <option key={d.id} value={d.id}>
          {d.label}
        </option>
      ))}
    </Select>
  );
}

export function DevicePicker({
  devices,
  microphone,
  camera,
  onMicrophone,
  onCamera,
  cameraOn,
  onCameraOn,
  onAllow,
  disabled = false,
  withCamera = true,
}: DevicePickerProps) {
  const id = useId();
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5">
      <label htmlFor={`${id}-mic`} className={LABEL}>
        Microphone
      </label>
      <DeviceList
        id={`${id}-mic`}
        kind="microphone"
        list={devices.microphones}
        locked={devices.locked?.microphones ?? false}
        value={microphone}
        disabled={disabled}
        onChange={onMicrophone}
        onAllow={onAllow}
      />
      {withCamera ? (
        <>
          <span id={`${id}-camera-label`} className={LABEL}>
            Camera
          </span>
          <span className="flex min-h-8 min-w-0 items-center gap-2">
            <Switch
              size="sm"
              checked={cameraOn}
              disabled={disabled}
              labelledBy={`${id}-camera-label`}
              onChange={onCameraOn}
            />
            {cameraOn ? (
              <span className="min-w-0 flex-1">
                <DeviceList
                  id={`${id}-camera`}
                  kind="camera"
                  label="Which Camera"
                  list={devices.cameras}
                  locked={devices.locked?.cameras ?? false}
                  value={camera === NO_CAMERA ? null : camera}
                  disabled={disabled}
                  onChange={onCamera}
                  onAllow={onAllow}
                />
              </span>
            ) : (
              <span className="text-xs text-slate-500 dark:text-slate-400">Off, sound only</span>
            )}
          </span>
        </>
      ) : null}
    </div>
  );
}
