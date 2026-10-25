// Colour and border illustrations for the Canvas article on Colours, Borders and Opacity
// (docs/specs/018-help/help-app.md). Each draws the real surface with its real labels: the element
// menu's Colours category with the one colour picker open beside its Border row
// (ElementColourBorderSections.tsx, components/colour/ColourPicker.tsx), and the Border category's
// Strength, Pattern and Radius grids (BorderControls.tsx, palette-style-previews.tsx). Composed from
// the shared primitives so the house style holds.

import type { ReactNode } from 'react';
import { Scene, Shape, SelectionBox, Label } from '../primitives';

// --- Shared bits -------------------------------------------------------------------------------

/** The element menu's open category: a white card with its title and an up chevron. */
function CategoryCard({
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

/** A small caption over a grid, as BorderGrid prints it. */
function GridCaption({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <Label x={x} y={y} size={9.5} weight={500} tone="muted">
      {children}
    </Label>
  );
}

/** One option button in a Border grid; `on` fills it as the chosen option. */
function GridButton({
  x,
  y,
  w,
  h = 22,
  on = false,
  children,
}: {
  x: number;
  y: number;
  w: number;
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
        className={on ? 'fill-brand-100 stroke-brand-300' : 'fill-slate-50 stroke-slate-200'}
        strokeWidth={1}
      />
      {children}
    </g>
  );
}

// --- Colours -----------------------------------------------------------------------------------

/** A colour row: the glyph for the surface it paints, its name, and the colour in force. */
function ColourRowLine({
  x,
  y,
  w,
  label,
  glyph,
  chip,
  open = false,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  glyph: ReactNode;
  chip: string;
  open?: boolean;
}) {
  return (
    <g>
      {open && <rect x={x + 4} y={y} width={w - 8} height={24} rx={5} className="fill-slate-100" />}
      <g transform={`translate(${x + 18} ${y + 12})`}>{glyph}</g>
      <Label x={x + 32} y={y + 12.5} size={11} weight={500} tone="strong">
        {label}
      </Label>
      <rect
        x={x + w - 28}
        y={y + 5}
        width={14}
        height={14}
        rx={3}
        className={`${chip} stroke-slate-300`}
        strokeWidth={1}
      />
    </g>
  );
}

// Row glyphs: a letter over a bar, a filled box, an outlined box.
const TEXT_GLYPH = (
  <g>
    <path
      d="M-4 2 L0 -6 L4 2 M-2.4 -1 H2.4"
      fill="none"
      className="stroke-slate-400"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect x={-5} y={4} width={10} height={2} rx={1} className="fill-slate-400" />
  </g>
);
const FILL_GLYPH = <rect x={-5} y={-5} width={10} height={10} rx={2} className="fill-slate-400" />;
const BORDER_GLYPH = (
  <rect
    x={-5}
    y={-5}
    width={10}
    height={10}
    rx={2}
    fill="none"
    className="stroke-slate-400"
    strokeWidth={1.6}
  />
);

/** One picker swatch: 14 units with a hairline, ringed when picked. */
function PickerSwatch({
  x,
  y,
  cls,
  on = false,
}: {
  x: number;
  y: number;
  cls: string;
  on?: boolean;
}) {
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
      <rect
        x={x}
        y={y}
        width={14}
        height={14}
        rx={3.5}
        className={`${cls} stroke-slate-900/10`}
        strokeWidth={1}
      />
    </g>
  );
}

// The Theme Palette for a blue theme: a no-colour swatch leads, then the accent ramp and neutrals.
const THEME_PALETTE = [
  'fill-brand-100',
  'fill-brand-300',
  'fill-brand-500',
  'fill-brand-700',
  'fill-slate-100',
  'fill-slate-400',
  'fill-slate-700',
];
// The strong standard colours, in their order: Ink, Grey, Red, Orange, Yellow, Green, Teal, Blue,
// Violet, Pink.
const STANDARD_STRONG = [
  'fill-slate-800',
  'fill-slate-500',
  'fill-rose-600',
  'fill-orange-600',
  'fill-amber-500',
  'fill-emerald-600',
  'fill-teal-600',
  'fill-blue-600',
  'fill-violet-600',
  'fill-pink-600',
];

/** The element menu's Colours category with the colour picker open beside its Border row. */
export function ColoursSection() {
  const mx = 16;
  const my = 18;
  const mw = 168;
  const rowX = mx;
  const px = 196;
  const py = 30;
  const sx = px + 12;
  const step = 18;
  return (
    <Scene w={420} h={236}>
      <CategoryCard x={mx} y={my} w={mw} h={160} title="Colours">
        <ColourRowLine
          x={rowX}
          y={my + 36}
          w={mw}
          label="Text"
          glyph={TEXT_GLYPH}
          chip="fill-brand-700"
        />
        <ColourRowLine
          x={rowX}
          y={my + 62}
          w={mw}
          label="Background"
          glyph={FILL_GLYPH}
          chip="fill-brand-50"
        />
        <ColourRowLine
          x={rowX}
          y={my + 88}
          w={mw}
          label="Border"
          glyph={BORDER_GLYPH}
          chip="fill-blue-600"
          open
        />
        {/* Reset to Theme, a full-width action button under the rows. */}
        <rect
          x={mx + 10}
          y={my + 122}
          width={mw - 20}
          height={26}
          rx={6}
          className="fill-white stroke-slate-200"
          strokeWidth={1.2}
        />
        <Label x={mx + mw / 2} y={my + 135.5} anchor="middle" size={11} weight={600} tone="body">
          Reset to Theme
        </Label>
      </CategoryCard>
      {/* The picker, in a popover beside the menu. */}
      <rect
        x={px}
        y={py}
        width={206}
        height={146}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={sx} y={py + 16} size={9.5} weight={600} tone="muted">
        Theme Palette
      </Label>
      <Label x={sx} y={py + 62} size={9.5} weight={600} tone="muted">
        Standard Colours
      </Label>
      <Label x={sx} y={py + 108} size={9.5} weight={600} tone="muted">
        Custom Colours
      </Label>
      <Label x={sx + 3 * step + 2} y={py + 125.5} size={10} tone="body">
        Add a custom colour
      </Label>
      {/* The swatches are real colours, drawn the same in both appearances. */}
      <g className="help-art-as-drawn">
        {/* No border colour: a white swatch with a slash. */}
        <rect
          x={sx}
          y={py + 26}
          width={14}
          height={14}
          rx={3.5}
          className="fill-white stroke-slate-300"
          strokeWidth={1}
        />
        <line
          x1={sx + 2.5}
          y1={py + 37.5}
          x2={sx + 11.5}
          y2={py + 28.5}
          className="stroke-rose-500"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        {THEME_PALETTE.map((cls, i) => (
          <PickerSwatch key={cls} x={sx + (i + 1) * step} y={py + 26} cls={cls} />
        ))}
        {STANDARD_STRONG.map((cls, i) => (
          <PickerSwatch key={cls} x={sx + i * step} y={py + 72} cls={cls} on={i === 7} />
        ))}
        <PickerSwatch x={sx} y={py + 118} cls="fill-teal-400" />
        <PickerSwatch x={sx + step} y={py + 118} cls="fill-indigo-400" />
        {/* Add a custom colour: four coloured dots in a dashed square. */}
        <rect
          x={sx + 2 * step}
          y={py + 118}
          width={14}
          height={14}
          rx={3.5}
          fill="none"
          className="stroke-slate-300"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
        <circle cx={sx + 2 * step + 4.5} cy={py + 122.5} r={2.2} className="fill-rose-500" />
        <circle cx={sx + 2 * step + 9.5} cy={py + 122.5} r={2.2} className="fill-orange-500" />
        <circle cx={sx + 2 * step + 4.5} cy={py + 127.5} r={2.2} className="fill-emerald-500" />
        <circle cx={sx + 2 * step + 9.5} cy={py + 127.5} r={2.2} className="fill-blue-500" />
      </g>
      {/* The shape it colours, under the menu. */}
      <Shape
        x={44}
        y={192}
        w={96}
        h={34}
        label="API"
        fill="fill-brand-50"
        stroke="stroke-blue-600"
      />
      <SelectionBox x={44} y={192} w={96} h={34} />
    </Scene>
  );
}

// --- Border ------------------------------------------------------------------------------------

// Strength: no border (a faint dashed outline), then thin, medium, thick and extra thick lines.
const STRENGTHS: (number | null)[] = [null, 1, 2, 3.2, 4.6];
// Pattern: solid, dashed, dotted, dash-dot, long dash, dash-dot-dot.
const PATTERNS = ['', '4 2', '0.1 3', '4 2 0.1 2', '7 2', '4 2 0.1 2 0.1 2'];
// Radius: none, small, medium, large and full (a circle).
const RADII = [0, 2, 4, 6, 7];

/** The Border category: Strength, Pattern and Radius grids, beside the shape they style. */
export function BorderSection() {
  const mx = 16;
  const my = 14;
  const mw = 204;
  const gx = mx + 12;
  const gw = mw - 24;
  const col5 = (gw - 4 * 4) / 5;
  const col3 = (gw - 2 * 4) / 3;
  return (
    <Scene w={420} h={230}>
      <CategoryCard x={mx} y={my} w={mw} h={202} title="Border">
        <GridCaption x={gx} y={my + 42}>
          Strength
        </GridCaption>
        {STRENGTHS.map((sw, i) => {
          const bx = gx + i * (col5 + 4);
          const by = my + 50;
          return (
            <GridButton key={i} x={bx} y={by} w={col5} on={i === 3}>
              {sw === null ? (
                <rect
                  x={bx + col5 / 2 - 6}
                  y={by + 5}
                  width={12}
                  height={12}
                  rx={2}
                  fill="none"
                  className="stroke-slate-400"
                  strokeWidth={1.1}
                  strokeDasharray="2 2"
                />
              ) : (
                <line
                  x1={bx + 7}
                  y1={by + 11}
                  x2={bx + col5 - 7}
                  y2={by + 11}
                  className={i === 3 ? 'stroke-brand-700' : 'stroke-slate-600'}
                  strokeWidth={sw}
                  strokeLinecap="round"
                />
              )}
            </GridButton>
          );
        })}
        <GridCaption x={gx} y={my + 88}>
          Pattern
        </GridCaption>
        {PATTERNS.map((dash, i) => {
          const bx = gx + (i % 3) * (col3 + 4);
          const by = my + 96 + Math.floor(i / 3) * 26;
          return (
            <GridButton key={i} x={bx} y={by} w={col3} on={i === 1}>
              <line
                x1={bx + 12}
                y1={by + 11}
                x2={bx + col3 - 12}
                y2={by + 11}
                className={i === 1 ? 'stroke-brand-700' : 'stroke-slate-600'}
                strokeWidth={2}
                strokeDasharray={dash || undefined}
                strokeLinecap="round"
              />
            </GridButton>
          );
        })}
        <GridCaption x={gx} y={my + 160}>
          Radius
        </GridCaption>
        {RADII.map((rx, i) => {
          const bx = gx + i * (col5 + 4);
          const by = my + 168;
          return (
            <GridButton key={i} x={bx} y={by} w={col5} on={i === 3}>
              <rect
                x={bx + col5 / 2 - 7}
                y={by + 4}
                width={14}
                height={14}
                rx={rx}
                fill="none"
                className={i === 3 ? 'stroke-brand-700' : 'stroke-slate-600'}
                strokeWidth={1.4}
              />
            </GridButton>
          );
        })}
      </CategoryCard>
      {/* The selected shape: a thick, dashed border with large corners. */}
      <rect
        x={262}
        y={86}
        width={126}
        height={70}
        rx={18}
        className="fill-brand-50 stroke-brand-500"
        strokeWidth={4}
        strokeDasharray="10 6"
      />
      <Label x={325} y={122} anchor="middle" size={12} weight={500} tone="strong">
        Checkout
      </Label>
      <SelectionBox x={256} y={80} w={138} h={82} />
    </Scene>
  );
}
