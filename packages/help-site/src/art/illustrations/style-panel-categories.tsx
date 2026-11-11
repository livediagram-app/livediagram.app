// The element menu's Shadow, Size and Rotation categories, drawn for the help pages.
// Re-exported from ./style-panels, where the help pages import them.
import { Scene, Shape, SelectionBox, Label } from '../primitives';
import { MenuCard, OptionBox, SectionTitle } from './style-panel-parts';

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

/** The Shadow category: five glyph-only presets (named on hover) over four sliders, with the Drop shadow on a card. */
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
    <Scene w={420} h={234}>
      <MenuCard x={mx} y={my} w={232} h={202} title="Shadow">
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
            </g>
          );
        })}
        <SliderRow x={mx + 14} y={my + 114} label="Offset X" t={0.5} value="0px" />
        <SliderRow x={mx + 14} y={my + 136} label="Offset Y" t={0.58} value="4px" />
        <SliderRow x={mx + 14} y={my + 158} label="Blur" t={0.25} value="12px" />
        <SliderRow x={mx + 14} y={my + 180} label="Opacity" t={0.25} value="25%" />
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
    <Scene w={420} h={224}>
      <MenuCard x={mx} y={my} w={232} h={186} title="Size">
        <NumberBox x={mx + 14} y={my + 46} label="WIDTH" value="160" />
        <NumberBox x={mx + 122} y={my + 46} label="HEIGHT" value="90" />
        <Label x={mx + 14} y={my + 104} size={11} weight={600} tone="strong">
          Lock Aspect Ratio
        </Label>
        <Label x={mx + 14} y={my + 119} size={10} tone="muted">
          Typing one dimension
        </Label>
        <Label x={mx + 14} y={my + 132} size={10} tone="muted">
          carries the other
        </Label>
        {/* The toggle, switched on. */}
        <rect x={mx + 188} y={my + 102} width={30} height={16} rx={8} className="fill-brand-500" />
        <circle cx={mx + 210} cy={my + 110} r={6} className="fill-white help-art-as-drawn" />
        <rect x={mx + 14} y={my + 146} width={204} height={26} rx={6} className="fill-slate-100" />
        <Label x={mx + 116} y={my + 159.5} anchor="middle" size={11} weight={600} tone="body">
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
