// Style-surface illustrations for the Canvas articles on the Quick Style Panel (livediagram) and Quick Style Bar
// (livedocuments, livedesign), Element Shadows, Size and Rotating Elements (docs/specs/018-help/help-app.md). Each
// draws the real surface with its real labels: the Quick style panel on the left edge (QuickStylePanel.tsx), the Quick
// Style bar beside a page's title bar (QuickStyleBar.tsx), and the
// Shadow, Size and Rotation categories of the element menu (ShadowSection.tsx, SizeSection.tsx,
// EditorContextMenu.tsx). Composed from the shared primitives so the house style holds.
import type { ReactNode } from 'react';
import { Scene, Shape, SelectionBox, Label } from '../primitives';
import { OptionBox, SectionTitle, Swatch } from './style-panel-parts';

export { RotationCategory, ShadowCategory, SizeCategory } from './style-panel-categories';

// --- Quick style panel -------------------------------------------------------------------------

// The theme default first, then the six theme colours, then Ink (Stroke row only).
const STROKE_SWATCHES = [
  'fill-slate-600',
  'fill-rose-500',
  'fill-amber-500',
  'fill-amber-400',
  'fill-emerald-500',
  'fill-brand-500',
  'fill-violet-500',
  'fill-slate-800',
];
const FILL_SWATCHES = [
  'fill-white stroke-slate-300',
  'fill-rose-400',
  'fill-amber-500',
  'fill-amber-400',
  'fill-emerald-400',
  'fill-brand-200',
  'fill-violet-400',
];

/** The More colours target that ends every colour row: four coloured dots. */
function MoreColours({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x + 4} cy={y + 4} r={2.6} className="fill-rose-400" />
      <circle cx={x + 10} cy={y + 4} r={2.6} className="fill-amber-400" />
      <circle cx={x + 4} cy={y + 10} r={2.6} className="fill-emerald-400" />
      <circle cx={x + 10} cy={y + 10} r={2.6} className="fill-brand-400" />
    </g>
  );
}

/** The Quick style panel on the left edge, styling the selected shape beside it. */
export function QuickStylePanelScene() {
  const px = 18;
  const py = 14;
  const rowX = px + 12;
  return (
    <Scene w={420} h={314}>
      {/* A compact strip: no panel header, straight into the rows. */}
      <rect
        x={px}
        y={py + 22}
        width={196}
        height={270}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <SectionTitle x={rowX} y={py + 44}>
        STROKE
      </SectionTitle>
      {STROKE_SWATCHES.map((cls, i) => (
        <Swatch key={i} x={rowX + i * 19} y={py + 53} cls={cls} on={i === 5} />
      ))}
      <MoreColours x={rowX + 8 * 19} y={py + 53} />
      <SectionTitle x={rowX} y={py + 84}>
        BACKGROUND
      </SectionTitle>
      {FILL_SWATCHES.map((cls, i) => (
        <Swatch key={i} x={rowX + i * 19} y={py + 93} cls={cls} on={i === 5} />
      ))}
      <MoreColours x={rowX + 7 * 19} y={py + 93} />
      <SectionTitle x={rowX} y={py + 124}>
        STROKE WIDTH
      </SectionTitle>
      {[1.2, 2.4, 4].map((sw, i) => (
        <OptionBox key={i} x={rowX + i * 40} y={py + 132} on={i === 1}>
          <line
            x1={rowX + i * 40 + 8}
            y1={py + 142}
            x2={rowX + i * 40 + 26}
            y2={py + 142}
            className="stroke-slate-600"
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </OptionBox>
      ))}
      <SectionTitle x={rowX} y={py + 166}>
        STROKE STYLE
      </SectionTitle>
      {['', '4 3', '1 3'].map((dash, i) => (
        <OptionBox key={i} x={rowX + i * 40} y={py + 174} on={i === 0}>
          <line
            x1={rowX + i * 40 + 8}
            y1={py + 184}
            x2={rowX + i * 40 + 26}
            y2={py + 184}
            className="stroke-slate-600"
            strokeWidth={2}
            strokeDasharray={dash || undefined}
            strokeLinecap="round"
          />
        </OptionBox>
      ))}
      <SectionTitle x={rowX} y={py + 208}>
        TEXT ALIGNMENT
      </SectionTitle>
      {[0, 1, 2].map((i) => (
        <OptionBox key={i} x={rowX + i * 40} y={py + 216} on={i === 1}>
          {[0, 1, 2].map((r) => {
            const lw = r === 1 ? 10 : 16;
            const bx = rowX + i * 40 + 9;
            const lx = i === 0 ? bx : i === 1 ? bx + (16 - lw) / 2 : bx + 16 - lw;
            return (
              <line
                key={r}
                x1={lx}
                y1={py + 221 + r * 5}
                x2={lx + lw}
                y2={py + 221 + r * 5}
                className="stroke-slate-500"
                strokeWidth={1.4}
                strokeLinecap="round"
              />
            );
          })}
        </OptionBox>
      ))}
      <line
        x1={px + 8}
        y1={py + 244}
        x2={px + 188}
        y2={py + 244}
        className="stroke-slate-200"
        strokeWidth={1}
      />
      <SectionTitle x={rowX} y={py + 254}>
        ACTIONS
      </SectionTitle>
      {/* Clear Styles, with its eraser glyph */}
      <path
        d={`M${rowX + 2} ${py + 276} l6 -6 l5 5 l-6 6 h-3 Z M${rowX + 8} ${py + 270} l4 -4 l5 5 l-4 4`}
        fill="none"
        className="stroke-slate-500"
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
      <Label x={rowX + 24} y={py + 274} size={11} weight={600} tone="body">
        Clear Styles
      </Label>
      {/* The selected shape, in the chosen blue. */}
      <Shape
        x={276}
        y={112}
        w={104}
        h={58}
        label="Service"
        fill="fill-brand-200"
        stroke="stroke-brand-500"
      />
      <SelectionBox x={276} y={112} w={104} h={58} />
    </Scene>
  );
}

// --- Quick Style bar ---------------------------------------------------------------------------

/** One of a page-bar card's buttons: an icon drawn by `icon` at its left, then its name; `on` tints it (its popover
 *  open). Returns the next button's x. */
function BarButton({
  x,
  y,
  w,
  label,
  on = false,
  icon,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  on?: boolean;
  icon: (cx: number, cy: number) => ReactNode;
}) {
  return (
    <g>
      {on && <rect x={x} y={y} width={w} height={20} rx={5} className="fill-brand-50" />}
      {icon(x + 11, y + 10)}
      <Label x={x + 21} y={y + 14} size={10} weight={600} tone={on ? 'accent' : 'body'}>
        {label}
      </Label>
    </g>
  );
}

/** A page-bar card: the white rounded card both bars wear. */
function BarCard({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={26}
      rx={7}
      className="fill-white stroke-slate-200"
      strokeWidth={1.3}
    />
  );
}

const chip = (cls: string) => (cx: number, cy: number) => (
  <rect x={cx - 5} y={cy - 5} width={10} height={10} rx={2.5} className={cls} />
);
const ring = (cls: string) => (cx: number, cy: number) => (
  <rect
    x={cx - 4.2}
    y={cy - 4.2}
    width={8.4}
    height={8.4}
    rx={2}
    className={`fill-white ${cls}`}
    strokeWidth={2}
  />
);
const stroke = (sw: number, dash?: string) => (cx: number, cy: number) => (
  <line
    x1={cx - 6}
    y1={cy}
    x2={cx + 6}
    y2={cy}
    className="stroke-slate-600"
    strokeWidth={sw}
    strokeDasharray={dash}
    strokeLinecap="round"
  />
);
const glyph = (cx: number, cy: number) => (
  <circle cx={cx} cy={cy} r={4.5} fill="none" className="stroke-slate-500" strokeWidth={1.3} />
);

/** The Quick Style bar left of a page's title bar, its Fill popover open over the page, styling the selected
 *  shape (QuickStyleBar.tsx, quick-style-sections.tsx). */
export function QuickStyleBarScene() {
  const top = 14;
  const by = top + 3;
  return (
    <Scene w={520} h={286}>
      {/* The page. */}
      <rect
        x={20}
        y={52}
        width={480}
        height={222}
        rx={4}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={22} y={top + 17} size={10} weight={700} tone="strong">
        Problem
      </Label>
      <Label x={70} y={top + 17} size={10} tone="muted">
        · Slide (16:9)
      </Label>
      {/* The Quick Style bar: Stroke, Fill (open), Width, Line. */}
      <BarCard x={150} y={top} w={198} />
      <BarButton x={153} y={by} w={52} label="Stroke" icon={ring('stroke-brand-500')} />
      <BarButton x={205} y={by} w={38} label="Fill" on icon={chip('fill-brand-200')} />
      <BarButton x={243} y={by} w={52} label="Width" icon={stroke(2.2)} />
      <BarButton x={295} y={by} w={50} label="Line" icon={stroke(2, '3 2.5')} />
      {/* The page's own title bar. */}
      <BarCard x={354} y={top} w={146} />
      <BarButton x={357} y={by} w={44} label="Style" icon={glyph} />
      <BarButton x={401} y={by} w={50} label="Layout" icon={glyph} />
      <line
        x1={455}
        y1={by + 4}
        x2={455}
        y2={by + 16}
        className="stroke-slate-200"
        strokeWidth={1}
      />
      <circle
        cx={474}
        cy={by + 10}
        r={5}
        fill="none"
        className="stroke-slate-500"
        strokeWidth={1.4}
      />
      <circle cx={474} cy={by + 10} r={1.8} className="fill-slate-500" />
      {/* Fill's popover, anchored under its button. */}
      <rect
        x={170}
        y={top + 32}
        width={214}
        height={56}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <SectionTitle x={182} y={top + 51}>
        FILL
      </SectionTitle>
      {FILL_SWATCHES.map((cls, i) => (
        <Swatch key={i} x={182 + i * 19} y={top + 60} cls={cls} on={i === 5} />
      ))}
      {/* Transparent: the no-colour chip's diagonal. */}
      <rect
        x={182 + 7 * 19}
        y={top + 60}
        width={14}
        height={14}
        rx={3.5}
        className="fill-white stroke-slate-300"
      />
      <line
        x1={182 + 7 * 19 + 2}
        y1={top + 72}
        x2={182 + 7 * 19 + 12}
        y2={top + 62}
        className="stroke-rose-500"
        strokeWidth={1.4}
      />
      <MoreColours x={182 + 8 * 19} y={top + 60} />
      {/* The selected shape, in the chosen blue. */}
      <Shape
        x={300}
        y={150}
        w={130}
        h={76}
        label="Service"
        fill="fill-brand-200"
        stroke="stroke-brand-500"
      />
      <SelectionBox x={300} y={150} w={130} h={76} />
    </Scene>
  );
}
