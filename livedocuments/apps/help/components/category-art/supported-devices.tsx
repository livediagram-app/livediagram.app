import { SupportedDevicesArt as Scene } from '@liveworkspace/help-site/art/scenes/supported-devices';
import { MiniArticle } from '@liveworkspace/help-site/art/work';

// Supported Devices: the shared scene (docs/specs/018-help/help-pages.md "Category art"), one article page on a
// computer, a tablet and a phone, on the canvas's grey.
export function SupportedDevicesArt() {
  return (
    <Scene
      screen={({ x, y, w, h }) => {
        // The page keeps its shape: as tall as the screen allows, centred.
        const ph = h - 8;
        const pw = Math.min(w - 8, ph * 0.78);
        return (
          <g>
            <rect x={x} y={y} width={w} height={h} rx={3} className="fill-slate-100" />
            <MiniArticle x={x + (w - pw) / 2} y={y + 4} w={pw} h={ph} />
          </g>
        );
      }}
    />
  );
}
