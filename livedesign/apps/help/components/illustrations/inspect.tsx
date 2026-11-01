// Illustrations for the Inspect article under Wireframe Pages (docs/specs/007-editor/wireframe-pages.md "Inspect").
// Each draws the real surface with its real labels: a wireframe screen with the selected element outlined and its
// spacing measured in red (InspectOverlay.tsx), and the Inspect panel beside it (InspectPanel.tsx,
// InspectSpacingBox.tsx). Composed from the shared primitives.

import { Scene, Label, Panel } from '@liveworkspace/help-site/art/primitives';

// --- Shared bits -------------------------------------------------------------------------------

/** A measured gap on the canvas: a red line with end ticks and its distance in a pill. */
function Measure({
  x1,
  y1,
  x2,
  y2,
  value,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  value: string;
}) {
  const across = y1 === y2;
  const mx = (x1 + x2) / 2;
  // A gap across is narrow, so its pill sits just above the line rather than over the edges it measures.
  const my = (y1 + y2) / 2 - (y1 === y2 ? 11 : 0);
  const pillW = value.length * 6 + 8;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-rose-500" strokeWidth={1.2} />
      {across ? (
        <>
          <line
            x1={x1}
            y1={y1 - 3}
            x2={x1}
            y2={y1 + 3}
            className="stroke-rose-500"
            strokeWidth={1.2}
          />
          <line
            x1={x2}
            y1={y2 - 3}
            x2={x2}
            y2={y2 + 3}
            className="stroke-rose-500"
            strokeWidth={1.2}
          />
        </>
      ) : (
        <>
          <line
            x1={x1 - 3}
            y1={y1}
            x2={x1 + 3}
            y2={y1}
            className="stroke-rose-500"
            strokeWidth={1.2}
          />
          <line
            x1={x2 - 3}
            y1={y2}
            x2={x2 + 3}
            y2={y2}
            className="stroke-rose-500"
            strokeWidth={1.2}
          />
        </>
      )}
      <rect
        x={mx - pillW / 2}
        y={my - 6.5}
        width={pillW}
        height={13}
        rx={6.5}
        className="fill-rose-500 dark:fill-rose-700"
      />
      <Label x={mx} y={my + 0.5} anchor="middle" size={10} weight={700} tone="onAccent">
        {value}
      </Label>
    </g>
  );
}

/** One value cell in the panel: its name over its value, as InspectValueCell draws it. */
function Cell({
  x,
  y,
  w,
  name,
  value,
}: {
  x: number;
  y: number;
  w: number;
  name: string;
  value: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={22}
        rx={4}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1}
      />
      <Label x={x + 5} y={y + 11.5} size={10} tone="muted">
        {name}
      </Label>
      <Label x={x + w - 5} y={y + 11.5} size={10} weight={600} tone="strong" anchor="end">
        {value}
      </Label>
    </g>
  );
}

/** A small panel button: Copy CSS, Copy Values, PNG, SVG. */
function PanelButton({ x, y, w, label }: { x: number; y: number; w: number; label: string }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={18}
        rx={4}
        className="fill-white stroke-slate-200"
        strokeWidth={1}
      />
      <Label x={x + w / 2} y={y + 9.5} size={10} weight={600} anchor="middle">
        {label}
      </Label>
    </g>
  );
}

// --- Scenes ------------------------------------------------------------------------------------

/** A wireframe phone screen with its Sign In button inspected, and the Inspect panel beside it. */
export function InspectScene() {
  // The phone: a 393-point screen drawn 130 wide, so 24 points is about 8 units.
  const px = 26;
  const py = 12;
  const pw = 140;
  const ph = 216;
  const sx = px + 5; // screen left
  const sw = pw - 10; // screen width
  const fieldX = sx + 8;
  const fieldW = sw - 16;
  const buttonY = 124;
  return (
    <Scene w={420} h={240}>
      {/* The device and its screen, drawn the same in either appearance, as the wireframe itself is. */}
      <g className="help-art-as-drawn">
        <rect x={px} y={py} width={pw} height={ph} rx={18} className="fill-slate-800" />
        <rect x={sx} y={py + 5} width={sw} height={ph - 10} rx={14} className="fill-white" />
        <rect
          x={px + pw / 2 - 16}
          y={py + 9}
          width={32}
          height={6}
          rx={3}
          className="fill-slate-800"
        />

        {/* The Sign In screen: a heading, two fields, the button, a link under it. */}
        <rect x={fieldX} y={32} width={58} height={8} rx={2} className="fill-slate-300" />
        <rect x={fieldX} y={45} width={84} height={5} rx={2} className="fill-slate-200" />
        <rect
          x={fieldX}
          y={60}
          width={fieldW}
          height={18}
          rx={4}
          className="fill-white stroke-slate-300"
          strokeWidth={1}
        />
        <rect
          x={fieldX}
          y={84}
          width={fieldW}
          height={18}
          rx={4}
          className="fill-white stroke-slate-300"
          strokeWidth={1}
        />
        <rect x={fieldX} y={buttonY} width={fieldW} height={18} rx={9} className="fill-slate-800" />
        <Label
          x={fieldX + fieldW / 2}
          y={buttonY + 9.5}
          anchor="middle"
          size={10}
          weight={600}
          tone="onAccent"
        >
          Sign In
        </Label>
        <rect
          x={fieldX + fieldW / 2 - 26}
          y={166}
          width={52}
          height={5}
          rx={2}
          className="fill-slate-200"
        />
      </g>

      {/* The selected button's outline and its spacing: to the field above, the screen's edges, the link below. */}
      <rect
        x={fieldX - 1.5}
        y={buttonY - 1.5}
        width={fieldW + 3}
        height={21}
        rx={10}
        className="fill-none stroke-brand-600"
        strokeWidth={1.5}
      />
      <Measure x1={fieldX + fieldW / 2} y1={102} x2={fieldX + fieldW / 2} y2={buttonY} value="16" />
      <Measure x1={sx} y1={buttonY + 9} x2={fieldX} y2={buttonY + 9} value="24" />
      <Measure x1={fieldX + fieldW} y1={buttonY + 9} x2={sx + sw} y2={buttonY + 9} value="24" />
      <Measure
        x1={fieldX + fieldW / 2}
        y1={buttonY + 18}
        x2={fieldX + fieldW / 2}
        y2={166}
        value="32"
      />

      {/* The Inspect panel. */}
      <Panel x={196} y={12} w={204} h={216} title="Inspect" />
      <Label x={208} y={48} size={11} weight={700} tone="strong">
        Button · Sign In
      </Label>

      <Label x={208} y={66} size={10} weight={700} tone="muted">
        Layout
      </Label>
      <Cell x={208} y={72} w={88} name="W" value="345" />
      <Cell x={300} y={72} w={88} name="H" value="48" />
      <Cell x={208} y={97} w={88} name="X" value="24" />
      <Cell x={300} y={97} w={88} name="Y" value="412" />

      <Label x={208} y={133} size={10} weight={700} tone="muted">
        Colours
      </Label>
      <rect
        x={208}
        y={139}
        width={180}
        height={22}
        rx={4}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1}
      />
      <Label x={213} y={150.5} size={10} tone="muted">
        Fill
      </Label>
      <rect
        x={300}
        y={144}
        width={12}
        height={12}
        rx={3}
        className="help-art-as-drawn fill-slate-800"
      />
      <Label x={383} y={150.5} size={10} weight={600} tone="strong" anchor="end">
        #1E293B
      </Label>

      <Label x={208} y={177} size={10} weight={700} tone="muted">
        Code
      </Label>
      <PanelButton x={208} y={183} w={88} label="Copy CSS" />
      <PanelButton x={300} y={183} w={88} label="Copy Values" />
      <Label x={298} y={218} size={10} weight={600} anchor="middle" tone="accent">
        Copy Inspect Link
      </Label>
    </Scene>
  );
}

/** The panel's Spacing box: the element in the middle, each side's distance and what it is measured to. */
export function InspectSpacingScene() {
  const cx = 210;
  const cy = 90;
  const side = (
    x: number,
    y: number,
    value: string,
    to: string,
    anchor: 'start' | 'middle' | 'end',
  ) => (
    <g>
      <Label x={x} y={y} size={12} weight={700} tone="strong" anchor={anchor}>
        {value}
      </Label>
      <Label x={x} y={y + 14} size={10} tone="muted" anchor={anchor}>
        {to}
      </Label>
    </g>
  );
  return (
    <Scene w={420} h={180} bg="plain">
      <rect
        x={110}
        y={14}
        width={200}
        height={152}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={124} y={32} size={10} weight={700} tone="muted">
        Spacing
      </Label>
      <rect
        x={cx - 34}
        y={cy - 14}
        width={68}
        height={28}
        rx={4}
        className="fill-white stroke-brand-500"
        strokeWidth={2}
      />
      <Label x={cx} y={cy + 1} size={10} anchor="middle" tone="body">
        Button
      </Label>
      {side(cx, cy - 34, '16', 'Text field', 'middle')}
      {side(cx, cy + 30, '32', 'Text', 'middle')}
      {side(cx - 44, cy - 2, '24', 'Screen', 'end')}
      {side(cx + 44, cy - 2, '24', 'Screen', 'start')}
    </Scene>
  );
}
