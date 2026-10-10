// Style-surface illustrations for the Canvas articles on the Quick Style Panel, Element Shadows,
// Size and Rotating Elements (docs/specs/018-help/help-app.md). Each draws the real surface
// with its real labels: the Quick style panel on the left edge (QuickStylePanel.tsx), and the
// Shadow, Size and Rotation categories of the element menu (ShadowSection.tsx, SizeSection.tsx,
// EditorContextMenu.tsx). Composed from the shared primitives so the house style holds.

import type { ReactNode } from 'react';
import { Scene, Shape, SelectionBox, Label } from './primitives';

// --- Shared bits -------------------------------------------------------------------------------

/** A small uppercase section title, as the panel and the menu print them. */
function SectionTitle({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <Label x={x} y={y} size={10} weight={700} tone="muted">
      {children}
    </Label>
  );
}

/** A colour swatch target; `on` rings it as the chosen option. */
function Swatch({ x, y, cls, on = false }: { x: number; y: number; cls: string; on?: boolean }) {
  return (
    <g>
      {on && (
        <rect
          x={x - 2.5}
          y={y - 2.5}
          width={19}
          height={19}
          rx={5}
          className="fill-none stroke-brand-500"
          strokeWidth={1.6}
        />
      )}
      <rect x={x} y={y} width={14} height={14} rx={3.5} className={cls} />
    </g>
  );
}

/** A small option button holding a glyph; `on` fills it as the chosen option. */
function OptionBox({
  x,
  y,
  w = 34,
  h = 20,
  on = false,
  children,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  on?: boolean;
  children?: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={5}
        className={on ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'}
        strokeWidth={1.3}
      />
      {children}
    </g>
  );
}

/** The element menu's card: a white rounded surface with a category header row. */
function MenuCard({
  x,
  y,
  w,
  h,
  title,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  children?: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={x + 14} y={y + 17} size={11} weight={700} tone="strong">
        {title}
      </Label>
      {/* The open category's chevron, pointing up. */}
      <path
        d={`M${x + w - 22} ${y + 19} l4 -4 l4 4`}
        fill="none"
        className="stroke-slate-400"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1={x}
        y1={y + 30}
        x2={x + w}
        y2={y + 30}
        className="stroke-slate-200"
        strokeWidth={1}
      />
      {children}
    </g>
  );
}

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

/** The Quick style panel on the left edge, styling the selected shape beside it. */
export function QuickStylePanelScene() {
  const px = 18;
  const py = 14;
  const rowX = px + 12;
  return (
    <Scene w={420} h={292}>
      <rect
        x={px}
        y={py}
        width={196}
        height={264}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <Label x={rowX} y={py + 16} size={11} weight={700} tone="strong">
        Quick style
      </Label>
      <line
        x1={px}
        y1={py + 30}
        x2={px + 196}
        y2={py + 30}
        className="stroke-slate-200"
        strokeWidth={1}
      />
      <SectionTitle x={rowX} y={py + 44}>
        STROKE
      </SectionTitle>
      {STROKE_SWATCHES.map((cls, i) => (
        <Swatch key={i} x={rowX + i * 21} y={py + 53} cls={cls} on={i === 5} />
      ))}
      <SectionTitle x={rowX} y={py + 84}>
        BACKGROUND
      </SectionTitle>
      {FILL_SWATCHES.map((cls, i) => (
        <Swatch key={i} x={rowX + i * 21} y={py + 93} cls={cls} on={i === 5} />
      ))}
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
      <Label x={px + 98} y={py + 256} anchor="middle" size={11} weight={600} tone="body">
        Clear styles
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

// --- Shadow ------------------------------------------------------------------------------------

/** A slider row: label, track with thumb, and its value. */
function SliderRow({
  x,
  y,
  label,
  t,
  value,
}: {
  x: number;
  y: number;
  label: string;
  t: number;
  value: string;
}) {
  const trackX = x + 62;
  const trackW = 86;
  return (
    <g>
      <Label x={x} y={y} size={10} tone="body">
        {label}
      </Label>
      <rect x={trackX} y={y - 2} width={trackW} height={4} rx={2} className="fill-slate-200" />
      <rect x={trackX} y={y - 2} width={trackW * t} height={4} rx={2} className="fill-brand-400" />
      <circle
        cx={trackX + trackW * t}
        cy={y}
        r={5}
        className="fill-white stroke-brand-500"
        strokeWidth={1.5}
      />
      <Label x={trackX + trackW + 32} y={y} anchor="end" size={10} tone="muted">
        {value}
      </Label>
    </g>
  );
}

/** The Shadow category: five presets over four sliders, with the Drop shadow on a card. */
export function ShadowCategory() {
  const mx = 18;
  const my = 16;
  const presets = ['None', 'Soft', 'Drop', 'Lifted', 'Hard'];
  // Each preset's look as a small offset/opacity pair drawn under a white tile.
  const looks: [number, number, number][] = [
    [0, 0, 0],
    [0, 1.5, 0.12],
    [0, 3, 0.2],
    [0, 6, 0.24],
    [3, 3, 0.4],
  ];
  return (
    <Scene w={420} h={248}>
      <MenuCard x={mx} y={my} w={232} h={216} title="Shadow">
        <SectionTitle x={mx + 14} y={my + 44}>
          PRESETS
        </SectionTitle>
        {presets.map((p, i) => {
          const tx = mx + 14 + i * 42;
          const [ox, oy, op] = looks[i]!;
          return (
            <g key={p}>
              <OptionBox x={tx} y={my + 54} w={36} h={36} on={i === 2}>
                {op > 0 && (
                  <rect
                    x={tx + 10 + ox}
                    y={my + 63 + oy}
                    width={16}
                    height={16}
                    rx={3}
                    // The shadow ink is fixed dark in both appearances, as on the canvas.
                    className="fill-slate-800 help-art-as-drawn"
                    opacity={op}
                  />
                )}
                <rect
                  x={tx + 10}
                  y={my + 63}
                  width={16}
                  height={16}
                  rx={3}
                  className="fill-white stroke-slate-300"
                  strokeWidth={1.2}
                />
              </OptionBox>
              <Label x={tx + 18} y={my + 102} anchor="middle" size={10} tone="muted">
                {p}
              </Label>
            </g>
          );
        })}
        <SliderRow x={mx + 14} y={my + 128} label="Offset X" t={0.5} value="0px" />
        <SliderRow x={mx + 14} y={my + 150} label="Offset Y" t={0.58} value="4px" />
        <SliderRow x={mx + 14} y={my + 172} label="Blur" t={0.25} value="12px" />
        <SliderRow x={mx + 14} y={my + 194} label="Opacity" t={0.25} value="25%" />
      </MenuCard>
      {/* The card on the canvas, lifted by the Drop preset. */}
      <g className="help-art-as-drawn">
        <rect
          x={290}
          y={96}
          width={98}
          height={60}
          rx={8}
          className="fill-slate-800"
          opacity={0.1}
        />
        <rect
          x={289}
          y={94}
          width={100}
          height={60}
          rx={8}
          className="fill-slate-800"
          opacity={0.08}
        />
      </g>
      <Shape x={286} y={88} w={100} h={60} label="Card" />
    </Scene>
  );
}

// --- Size --------------------------------------------------------------------------------------

/** One labelled number box with its px unit. */
function NumberBox({ x, y, label, value }: { x: number; y: number; label: string; value: string }) {
  return (
    <g>
      <SectionTitle x={x} y={y}>
        {label}
      </SectionTitle>
      <rect
        x={x}
        y={y + 9}
        width={92}
        height={24}
        rx={5}
        className="fill-white stroke-slate-300"
        strokeWidth={1.3}
      />
      <Label x={x + 8} y={y + 21.5} size={11} tone="strong">
        {value}
      </Label>
      <Label x={x + 84} y={y + 21.5} anchor="end" size={10} tone="muted">
        px
      </Label>
    </g>
  );
}

/** The Size category: Width and Height boxes, the aspect lock and Reset Aspect Ratio. */
export function SizeCategory() {
  const mx = 18;
  const my = 20;
  return (
    <Scene w={420} h={214}>
      <MenuCard x={mx} y={my} w={232} h={176} title="Size">
        <NumberBox x={mx + 14} y={my + 46} label="WIDTH" value="160" />
        <NumberBox x={mx + 122} y={my + 46} label="HEIGHT" value="90" />
        <Label x={mx + 14} y={my + 104} size={11} weight={600} tone="strong">
          Lock Aspect Ratio
        </Label>
        <Label x={mx + 14} y={my + 119} size={10} tone="muted">
          Typing one dimension carries the other
        </Label>
        {/* The toggle, switched on. */}
        <rect x={mx + 188} y={my + 102} width={30} height={16} rx={8} className="fill-brand-500" />
        <circle cx={mx + 210} cy={my + 110} r={6} className="fill-white help-art-as-drawn" />
        <rect x={mx + 14} y={my + 136} width={204} height={26} rx={6} className="fill-slate-100" />
        <Label x={mx + 116} y={my + 149.5} anchor="middle" size={11} weight={600} tone="body">
          Reset Aspect Ratio
        </Label>
      </MenuCard>
      {/* The element being sized, with its dimensions. */}
      <Shape x={272} y={70} w={120} h={68} label="Header" />
      <SelectionBox x={272} y={70} w={120} h={68} />
      <Label x={332} y={156} anchor="middle" size={10} tone="muted">
        160 × 90
      </Label>
    </Scene>
  );
}

// --- Rotation ----------------------------------------------------------------------------------

/** The Rotation category: eight 45° tiles, each previewing its angle, with 45° chosen. */
export function RotationCategory() {
  const mx = 18;
  const my = 24;
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Scene w={420} h={200}>
      <MenuCard x={mx} y={my} w={204} h={150} title="Rotation">
        {angles.map((deg, i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          const tx = mx + 14 + col * 46;
          const ty = my + 42 + row * 54;
          const cx = tx + 20;
          const cy = ty + 17;
          return (
            <g key={deg}>
              <OptionBox x={tx} y={ty} w={40} h={46} on={deg === 45}>
                {/* An upright marker turned by the tile's angle. */}
                <g transform={`rotate(${deg} ${cx} ${cy})`}>
                  <rect
                    x={cx - 6}
                    y={cy - 8}
                    width={12}
                    height={16}
                    rx={2}
                    fill="none"
                    className={deg === 45 ? 'stroke-brand-500' : 'stroke-slate-500'}
                    strokeWidth={1.4}
                  />
                  <line
                    x1={cx}
                    y1={cy - 8}
                    x2={cx}
                    y2={cy - 3}
                    className={deg === 45 ? 'stroke-brand-500' : 'stroke-slate-500'}
                    strokeWidth={1.4}
                  />
                </g>
                <Label
                  x={cx}
                  y={ty + 37}
                  anchor="middle"
                  size={10}
                  tone={deg === 45 ? 'accent' : 'muted'}
                >
                  {`${deg}°`}
                </Label>
              </OptionBox>
            </g>
          );
        })}
      </MenuCard>
      {/* The element on the canvas, turned to 45°. */}
      <g transform="rotate(45 322 100)">
        <Shape x={286} y={74} w={72} h={52} accent label="Tilt" />
      </g>
    </Scene>
  );
}
