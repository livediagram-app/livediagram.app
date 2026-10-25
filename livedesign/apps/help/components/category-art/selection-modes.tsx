import { Cursor, Label } from '@liveworkspace/help-site/art/primitives';
import { Stage } from '@liveworkspace/help-site/art/parts';
import { ToolPicker } from '@liveworkspace/help-site/art/tool-picker';

// Selection Modes: the tool picker open with Select chosen in its Edit band, and Select at work on a phone
// wireframe: a marquee dragged across its list rows, the rows it catches selected together.
export function SelectionModesArt() {
  return (
    <Stage>
      <ToolPicker x={22} y={18} current="Select" />

      {/* The wireframe screen. */}
      <Label x={226} y={14} size={8.5} weight={600} tone="muted">
        iPhone · Wireframe
      </Label>
      <rect x={226} y={22} width={110} height={192} rx={16} className="fill-slate-800" />
      <rect
        x={231}
        y={27}
        width={100}
        height={182}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={0.8}
      />
      <rect x={266} y={31} width={30} height={5} rx={2.5} className="fill-slate-700" />
      <rect x={241} y={46} width={56} height={8} rx={4} className="fill-brand-500" />
      <rect
        x={241}
        y={60}
        width={80}
        height={40}
        rx={4}
        className="fill-brand-50 stroke-brand-200"
        strokeWidth={0.8}
      />
      {/* The list rows: an icon and two lines each. */}
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={241} y={110 + i * 24} width={16} height={16} rx={4} className="fill-slate-200" />
          <rect
            x={262}
            y={112 + i * 24}
            width={52}
            height={5}
            rx={2.5}
            className="fill-slate-300"
          />
          <rect x={262} y={121 + i * 24} width={34} height={4} rx={2} className="fill-slate-200" />
        </g>
      ))}
      <rect x={241} y={186} width={80} height={14} rx={7} className="fill-brand-500" />

      {/* Each caught row's own selection, inside the marquee. */}
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={239}
          y={108 + i * 24}
          width={78}
          height={20}
          rx={3}
          className="fill-none stroke-brand-400"
          strokeWidth={1}
        />
      ))}
      {/* The marquee being dragged. */}
      <rect
        x={233}
        y={104}
        width={130}
        height={78}
        rx={2}
        className="fill-brand-500/10 stroke-brand-500"
        strokeWidth={1.2}
        strokeDasharray="4 3"
      />
      <Cursor x={360} y={178} colour="brand" />
    </Stage>
  );
}
