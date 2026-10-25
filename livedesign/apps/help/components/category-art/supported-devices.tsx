import { SupportedDevicesArt as Scene } from '@liveworkspace/help-site/art/scenes/supported-devices';
import { MiniLogo } from '@liveworkspace/help-site/art/work';

// Supported Devices: the shared scene (docs/specs/018-help/help-pages.md "Category art"), one logo artboard on a
// computer, a tablet and a phone, on the canvas's grey.
export function SupportedDevicesArt() {
  return (
    <Scene
      screen={({ x, y, w, h }) => (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={3} className="fill-slate-100" />
          <MiniLogo x={x + 4} y={y + 4} w={w - 8} h={h - 8} />
        </g>
      )}
    />
  );
}
