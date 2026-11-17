// The microphones and cameras this browser can see, for the device picker. Their names are hidden until the person
// has let the page use one (the browser's rule), so until then each is "Microphone 1", "Camera 2", or, where the
// browser hides them altogether until then, the kind is `locked`.

import { useEffect, useState } from 'react';

export type CaptureDevice = { id: string; label: string };
export type CaptureDevices = {
  microphones: CaptureDevice[];
  cameras: CaptureDevice[];
  // A kind the browser has but won't list until the page is allowed to use it (Chrome lists one nameless, id-less
  // entry per kind before then): the picker offers to ask rather than saying none was found.
  locked?: { microphones: boolean; cameras: boolean };
};

export const NO_DEVICES: CaptureDevices = { microphones: [], cameras: [] };

type DeviceSource = Pick<MediaDevices, 'enumerateDevices'> & Partial<EventTarget>;

const deviceSource = (): DeviceSource | undefined =>
  (globalThis.navigator as Navigator | undefined)?.mediaDevices;

/** Every microphone and camera, each named; none where the browser lists none. */
export async function listDevices(source = deviceSource()): Promise<CaptureDevices> {
  if (!source?.enumerateDevices) return NO_DEVICES;
  let all: MediaDeviceInfo[];
  try {
    all = await source.enumerateDevices();
  } catch {
    return NO_DEVICES;
  }
  const named = (kind: MediaDeviceKind, noun: string) =>
    all
      .filter((d) => d.kind === kind && d.deviceId !== '')
      .map((d, i) => ({ id: d.deviceId, label: d.label.trim() || `${noun} ${i + 1}` }));
  const microphones = named('audioinput', 'Microphone');
  const cameras = named('videoinput', 'Camera');
  const hiddenOf = (kind: MediaDeviceKind, shown: CaptureDevice[]) =>
    shown.length === 0 && all.some((d) => d.kind === kind && d.deviceId === '');
  return {
    microphones,
    cameras,
    locked: {
      microphones: hiddenOf('audioinput', microphones),
      cameras: hiddenOf('videoinput', cameras),
    },
  };
}

/**
 * The devices, kept current while `enabled`: listed again when one is plugged in or out, and when `refresh` changes
 * (after the browser has been allowed to name them).
 */
export function useMediaDevices(enabled: boolean, refresh: unknown = 0): CaptureDevices {
  const [devices, setDevices] = useState<CaptureDevices>(NO_DEVICES);
  useEffect(() => {
    if (!enabled) return;
    const source = deviceSource();
    let live = true;
    const update = () => {
      void listDevices(source).then((next) => {
        if (live) setDevices(next);
      });
    };
    update();
    source?.addEventListener?.('devicechange', update);
    return () => {
      live = false;
      source?.removeEventListener?.('devicechange', update);
    };
  }, [enabled, refresh]);
  return devices;
}
