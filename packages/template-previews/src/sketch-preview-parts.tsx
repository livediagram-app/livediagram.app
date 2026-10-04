// The marker look the Draw template tiles share (template-preview-11.tsx, template-preview-14.tsx):
// the off-white board, the stock marker colours, a marker line's stroke and a stick figure.

export const BOARD = 'rgb(251 250 247)';
export const EDGE = 'rgb(148 163 184)';
export const INK = 'rgb(28 25 23)';
export const BLUE = 'rgb(37 99 235)';
export const RED = 'rgb(225 29 72)';
export const GREEN = 'rgb(22 163 74)';
export const VIOLET = 'rgb(124 58 237)';
export const ORANGE = 'rgb(234 88 12)';
export const NOTE = 'rgb(253 230 138)';
export const NOTE_EDGE = 'rgb(234 179 8)';

// A marker line's look: round, unfilled, in `colour`.
export const pen = (colour: string, width = 1) =>
  ({
    fill: 'none',
    stroke: colour,
    strokeWidth: width,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }) as const;

// The board every Draw tile sits on.
export const Board = () => (
  <rect x="3" y="3" width="74" height="38" rx="3" fill={BOARD} stroke={EDGE} strokeWidth="1" />
);

// A stick figure, its head centred on (x, y).
export const Stick = ({ x, y, c = INK }: { x: number; y: number; c?: string }) => (
  <g {...pen(c, 0.8)}>
    <circle cx={x} cy={y} r="1.6" />
    <path
      d={`M${x} ${y + 1.6} L${x} ${y + 6} M${x - 2.4} ${y + 4.4} L${x} ${y + 3} L${x + 2.4} ${y + 4.4} M${x - 2} ${y + 9} L${x} ${y + 6} L${x + 2} ${y + 9}`}
    />
  </g>
);
