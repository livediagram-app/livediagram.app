import { SupportedDevicesArt as Scene } from '@liveworkspace/help-site/art/scenes/supported-devices';
import { MiniBoard } from './plan-parts';

// Supported Devices: the shared scene (docs/specs/018-help/help-pages.md "Category art"), one board of cards on a
// computer, a tablet and a phone.
export function SupportedDevicesArt() {
  return (
    <Scene screen={({ x, y, w, h }) => <MiniBoard x={x + 3} y={y + 3} w={w - 6} h={h - 6} />} />
  );
}
