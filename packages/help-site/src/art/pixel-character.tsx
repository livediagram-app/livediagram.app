// The pixel character Avatar mode walks, for the help centres' figures (livediagram's and livehuddle's): one drawing,
// so the figures agree with each other and with the canvas's sprite (packages/avatar avatar-sprite.tsx).
import { Label } from './primitives';

/** The pixel character Avatar mode walks, standing with its feet at (fx, fy).
 *  `shirt` is the owner's participant colour; `name` draws the chip other
 *  people's characters wear above their heads (your own has none). */
export function PixelCharacter({
  fx,
  fy,
  px = 3,
  shirt = 'brand',
  name,
  hair = 'fill-amber-900',
}: {
  fx: number;
  fy: number;
  px?: number;
  shirt?: 'brand' | 'emerald' | 'violet' | 'rose';
  name?: string;
  hair?: string;
}) {
  const p = (n: number) => n * px;
  const shirtCls = {
    brand: ['fill-brand-500', 'fill-brand-600'],
    emerald: ['fill-emerald-500', 'fill-emerald-600'],
    violet: ['fill-violet-500', 'fill-violet-600'],
    rose: ['fill-rose-500', 'fill-rose-600'],
  }[shirt];
  const chipFill = {
    brand: 'fill-brand-500',
    emerald: 'fill-emerald-500 dark:fill-emerald-700',
    violet: 'fill-violet-500 dark:fill-violet-700',
    rose: 'fill-rose-500 dark:fill-rose-700',
  }[shirt];
  return (
    <g>
      {/* Drawn in its own colours in both appearances (help-art.css `help-art-as-drawn`), as the canvas draws the
          character: dark mode's turned-over slate ramp made its trousers and shoes light (Work Tracker #492). */}
      <g
        transform={`translate(${fx - p(8)} ${fy - p(23)})`}
        shapeRendering="crispEdges"
        className="help-art-as-drawn"
        data-pixel-character=""
      >
        <ellipse cx={p(8)} cy={p(23)} rx={p(5)} ry={p(1.2)} className="fill-slate-900/25" />
        <rect x={p(5)} y={p(15)} width={p(3)} height={p(6)} className="fill-slate-600" />
        <rect x={p(9)} y={p(15)} width={p(3)} height={p(6)} className="fill-slate-600" />
        <rect x={p(5)} y={p(21)} width={p(3)} height={p(2)} className="fill-slate-800" />
        <rect x={p(9)} y={p(21)} width={p(3)} height={p(2)} className="fill-slate-800" />
        <rect x={p(4)} y={p(9)} width={p(8)} height={p(6)} className={shirtCls[0]} />
        <rect x={p(2)} y={p(9)} width={p(2)} height={p(4)} className={shirtCls[0]} />
        <rect x={p(12)} y={p(9)} width={p(2)} height={p(4)} className={shirtCls[1]} />
        <rect x={p(4)} y={p(1)} width={p(8)} height={p(8)} className="fill-amber-200" />
        <rect x={p(3)} y={0} width={p(10)} height={p(3)} className={hair} />
        <rect x={p(6)} y={p(5)} width={px} height={px} className="fill-slate-800" />
        <rect x={p(9)} y={p(5)} width={px} height={px} className="fill-slate-800" />
      </g>
      {name && (
        <g transform={`translate(${fx - (name.length * 6.5 + 12) / 2} ${fy - p(23) - 22})`}>
          <rect width={name.length * 6.5 + 12} height={17} rx={5} className={chipFill} />
          <Label x={6} y={9} tone="onAccent" size={10} weight={600}>
            {name}
          </Label>
        </g>
      )}
    </g>
  );
}
