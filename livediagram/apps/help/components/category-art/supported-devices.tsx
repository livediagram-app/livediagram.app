import {
  SupportedDevicesArt as Scene,
  type ScreenBox,
} from '@liveworkspace/help-site/art/scenes/supported-devices';

// The same little diagram, drawn into any screen: a palette strip on top, then two shapes and the arrow
// between them, scaled to the box.
function Diagram({ x, y, w, h }: ScreenBox) {
  const u = Math.min(w, h * 1.4) / 100;
  const cx = x + w / 2;
  const cy = y + h * 0.58;
  return (
    <g>
      <rect
        x={cx - 30 * u}
        y={y + 5 * u}
        width={60 * u}
        height={8 * u}
        rx={3 * u}
        className="fill-slate-100 stroke-slate-200"
        strokeWidth={0.8}
      />
      <rect
        x={cx - 40 * u}
        y={cy - 9 * u}
        width={28 * u}
        height={18 * u}
        rx={3 * u}
        className="fill-white stroke-brand-400"
        strokeWidth={1.4}
      />
      <rect
        x={cx + 12 * u}
        y={cy - 9 * u}
        width={28 * u}
        height={18 * u}
        rx={3 * u}
        className="fill-brand-500"
      />
      <path
        d={`M${cx - 12 * u} ${cy} H${cx + 9 * u}`}
        className="stroke-brand-400"
        strokeWidth={1.6}
      />
      <path
        d={`M${cx + 7 * u} ${cy - 3 * u} l4 ${3 * u} -4 ${3 * u}`}
        className="fill-none stroke-brand-400"
        strokeWidth={1.6}
      />
    </g>
  );
}

// Supported Devices: the shared scene (docs/specs/018-help/help-pages.md "Category art"), one diagram on a
// computer, a tablet and a phone.
export function SupportedDevicesArt() {
  return <Scene screen={(box) => <Diagram {...box} />} />;
}
