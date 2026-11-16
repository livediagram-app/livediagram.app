// The microphones and cameras this browser can see, for the device picker. Their names are hidden until the person
// has let the page use one (the browser's rule), so until then each is "Microphone 1", "Camera 2".

import { useEffect, useState } from 'react';

export type CaptureDevice = { id: string; label: string };
export type CaptureDevices = { microphones: CaptureDevice[]; cameras: CaptureDevice[] };

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
  return { microphones: named('audioinput', 'Microphone'), cameras: named('videoinput', 'Camera') };
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
