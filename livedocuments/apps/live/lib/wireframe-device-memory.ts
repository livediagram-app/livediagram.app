// The device last chosen for a wireframe page in this browser (docs/specs/007-editor/
// wireframe-pages.md "Choosing the device"): Choose a Device rings and focuses it first. A
// per-viewer convenience: an unreadable or blocked store answers the iPhone.
import {
  DEFAULT_WIREFRAME_DEVICE,
  isWireframeDeviceId,
  type WireframeDeviceId,
} from '@livedocuments/document';

const KEY = 'livedocuments:v2:wireframe-device';

export function lastWireframeDevice(): WireframeDeviceId {
  try {
    const stored = window.localStorage.getItem(KEY);
    return isWireframeDeviceId(stored) ? stored : DEFAULT_WIREFRAME_DEVICE;
  } catch {
    return DEFAULT_WIREFRAME_DEVICE;
  }
}

export function rememberWireframeDevice(device: WireframeDeviceId): void {
  try {
    window.localStorage.setItem(KEY, device);
  } catch {
    // A blocked store only loses the convenience.
  }
}
