// The panel parts the Space panel cards share (./space-games, ./space-mini-view, ./space-panels): the editor's surfaces
// and inks with their dark pairs, a dialog's close cross and a small button, primary or secondary.

export const PANEL = 'fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700';
export const RULE = 'stroke-slate-100 dark:stroke-slate-800';
export const STRONG = 'fill-slate-800 dark:fill-slate-100';
export const BODY = 'fill-slate-600 dark:fill-slate-300';
export const SUBTLE = 'fill-slate-500 dark:fill-slate-400';
export const SECONDARY = 'fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-600';

/** A dialog's close cross, centred on (x, y). */
export function Close({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x - 2.4} ${y - 2.4} L${x + 2.4} ${y + 2.4} M${x + 2.4} ${y - 2.4} L${x - 2.4} ${y + 2.4}`}
      strokeWidth={0.9}
      strokeLinecap="round"
      className="stroke-slate-400 dark:stroke-slate-500"
    />
  );
}

/** A small button, `solid` the brand's primary, else the secondary's white with a border. */
export function Button({
  x,
  y,
  w,
  h = 10,
  text,
  solid = false,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  text: string;
  solid?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={2.5}
        strokeWidth={0.6}
        className={solid ? 'fill-emerald-600 stroke-emerald-600' : SECONDARY}
      />
      <text
        x={x + w / 2}
        y={y + h / 2 + 2}
        fontSize={5.4}
        fontWeight={600}
        textAnchor="middle"
        className={solid ? 'fill-white' : 'fill-slate-700 dark:fill-slate-200'}
      >
        {text}
      </text>
    </g>
  );
}
