import {
  SupportedDevicesArt as Scene,
  type ScreenBox,
} from '@liveworkspace/help-site/art/scenes/supported-devices';
import { EditorScreen } from '../illustrations/devices';

// Supported Devices: the shared scene (liveworkspace/docs/specs/017-help/help-centre.md "Category art"), the same
// Space on a computer, a tablet and a phone: the real editor scaled into each screen.
function Space({ x, y, w, h }: ScreenBox) {
  // The editor is 520 by 300; fit it whole and centre it in the box.
  const sw = Math.min(w, (h * 520) / 300);
  const sh = (sw * 300) / 520;
  return <EditorScreen x={x + (w - sw) / 2} y={y + (h - sh) / 2} w={sw} />;
}

export function SupportedDevicesArt() {
  return <Scene screen={(box) => <Space {...box} />} />;
}
