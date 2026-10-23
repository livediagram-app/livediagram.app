import { Shadow, Stage } from './parts';

// The same little diagram, drawn into any screen: a palette strip on top, then two shapes and the arrow
// between them, scaled to the box (x, y, w, h).
function Screen({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const u = Math.min(w, h * 1.4) / 100;
  const cx = x + w / 2;
  const cy = y + h * 0.58;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3} className="fill-white" />
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

// Supported Devices: one design on a computer, a tablet and a phone.
export function SupportedDevicesArt() {
  return (
    <Stage>
      {/* Laptop. */}
      <Shadow x={34} y={34} w={212} h={136} r={10} />
      <rect
        x={34}
        y={34}
        width={212}
        height={136}
        rx={10}
        className="fill-slate-800 stroke-slate-600 help-art-as-drawn"
        strokeWidth={1.5}
      />
      <Screen x={42} y={42} w={196} h={120} />
      <path d="M14 176 H266 l-12 12 H26 Z" className="fill-slate-300" />
      <rect
        x={14}
        y={170}
        width={252}
        height={8}
        rx={3}
        className="fill-slate-200 stroke-slate-300"
        strokeWidth={1}
      />
      <rect x={118} y={170} width={44} height={4} rx={2} className="fill-slate-300" />

      {/* Tablet. */}
      <Shadow x={232} y={64} w={104} h={134} r={12} />
      <rect
        x={232}
        y={64}
        width={104}
        height={134}
        rx={12}
        className="fill-slate-800 stroke-slate-600 help-art-as-drawn"
        strokeWidth={1.5}
      />
      <Screen x={240} y={72} w={88} h={118} />

      {/* Phone. */}
      <Shadow x={318} y={98} w={62} h={110} r={12} />
      <rect
        x={318}
        y={98}
        width={62}
        height={110}
        rx={12}
        className="fill-slate-800 stroke-slate-600 help-art-as-drawn"
        strokeWidth={1.5}
      />
      <Screen x={323} y={108} w={52} h={92} />
      <rect
        x={340}
        y={102}
        width={18}
        height={3}
        rx={1.5}
        className="fill-slate-600 help-art-as-drawn"
      />
    </Stage>
  );
}
