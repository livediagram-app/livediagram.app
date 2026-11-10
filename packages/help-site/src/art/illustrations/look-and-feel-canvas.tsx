// The Canvas panel of the Tab Style dialog, for the canvas basics of livediagram, livedocuments and
// livedesign (docs/specs/018-help/help-app.md): the Static and Animated pattern carousels
// (CanvasStyleControls.tsx). Composed from the shared primitives.

import { Label } from '../primitives';
import { Caption, CarouselHeading, OptionBox, Slider, TabStylePanel } from './tab-style-parts';

/** A pattern's look, drawn inside a tile's preview strip (`x`, `y`, 84 by 13). */
function PatternArt({ kind, x, y }: { kind: string; x: number; y: number }) {
  const line = { className: 'stroke-slate-300', strokeWidth: 1, fill: 'none' } as const;
  const cols = Array.from({ length: 9 }, (_, i) => x + 4 + i * 9.5);
  switch (kind) {
    case 'Grid':
      return (
        <g className="fill-slate-400">
          {cols.map((cx) =>
            [y + 3.5, y + 9.5].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.1} />),
          )}
        </g>
      );
    case 'Lines':
      return <path d={`M${x} ${y + 4} H${x + 84} M${x} ${y + 9} H${x + 84}`} {...line} />;
    case 'Graph':
      return (
        <path
          d={`M${x} ${y + 4} H${x + 84} M${x} ${y + 9} H${x + 84} ${cols.map((cx) => `M${cx} ${y} V${y + 13}`).join(' ')}`}
          {...line}
        />
      );
    case 'Crosshatch':
    case 'Diagonal': {
      const starts = Array.from({ length: 7 }, (_, i) => x + i * 12);
      const fwd = starts.map((sx) => `M${sx} ${y + 13} L${sx + 13} ${y}`).join(' ');
      const back = starts.map((sx) => `M${sx} ${y} L${sx + 13} ${y + 13}`).join(' ');
      return <path d={kind === 'Diagonal' ? fwd : `${fwd} ${back}`} {...line} />;
    }
    case 'Confetti': {
      const bits: [number, number, string][] = [
        [6, 3, 'fill-rose-400'],
        [20, 8, 'fill-amber-400'],
        [33, 2, 'fill-emerald-400'],
        [47, 7, 'fill-brand-400'],
        [60, 3, 'fill-violet-400'],
        [73, 8, 'fill-rose-400'],
      ];
      return (
        <g className="help-art-as-drawn">
          {bits.map(([dx, dy, cls]) => (
            <rect key={dx} x={x + dx} y={y + dy} width={4} height={2.5} rx={1} className={cls} />
          ))}
        </g>
      );
    }
    case 'Stripes':
      return (
        <g className="fill-slate-200">
          {Array.from({ length: 7 }, (_, i) => (
            <rect key={i} x={x + 2 + i * 12} y={y} width={5} height={13} />
          ))}
        </g>
      );
    case 'Waves':
    case 'Flow': {
      const wave = (wy: number) => `M${x} ${wy} ${'q7 -3 14 0 '.repeat(6).trim()}`;
      const d = `${wave(y + 4)} ${wave(y + 10)}`;
      return kind === 'Flow' ? (
        <path
          d={d}
          className="stroke-brand-300"
          strokeWidth={1.2}
          fill="none"
          strokeDasharray="5 3"
        />
      ) : (
        <path d={d} {...line} />
      );
    }
    case 'Drift':
      return (
        <g className="fill-brand-300">
          {(
            [
              [8, 4],
              [22, 9],
              [37, 3],
              [50, 8],
              [64, 5],
              [77, 10],
            ] as const
          ).map(([dx, dy]) => (
            <circle key={dx} cx={x + dx} cy={y + dy} r={1.8} />
          ))}
        </g>
      );
    case 'Aurora':
      return (
        <g className="help-art-as-drawn">
          <ellipse
            cx={x + 28}
            cy={y + 6.5}
            rx={26}
            ry={5}
            className="fill-emerald-200"
            opacity={0.8}
          />
          <ellipse
            cx={x + 58}
            cy={y + 6.5}
            rx={24}
            ry={5}
            className="fill-violet-200"
            opacity={0.8}
          />
        </g>
      );
    case 'Ripple':
      return (
        <g className="stroke-brand-300" fill="none" strokeWidth={1}>
          {[10, 22, 36].map((rx) => (
            <ellipse key={rx} cx={x + 42} cy={y + 6.5} rx={rx} ry={rx / 8 + 1} />
          ))}
        </g>
      );
    case 'Ribbons':
      return (
        <g fill="none" strokeWidth={2.4} strokeLinecap="round" className="help-art-as-drawn">
          <path
            d={`M${x + 2} ${y + 9} C${x + 24} ${y - 2} ${x + 50} ${y + 14} ${x + 82} ${y + 3}`}
            className="stroke-brand-200"
          />
          <path
            d={`M${x + 2} ${y + 4} C${x + 30} ${y + 14} ${x + 56} ${y - 1} ${x + 82} ${y + 10}`}
            className="stroke-violet-200"
          />
        </g>
      );
    default:
      return null;
  }
}

/** A pattern tile in a Canvas panel carousel: the pattern drawn for real, then its name. */
function PatternTile({
  x,
  y,
  kind,
  on = false,
}: {
  x: number;
  y: number;
  kind: string;
  on?: boolean;
}) {
  return (
    <OptionBox x={x} y={y} w={96} h={34} on={on} label={kind}>
      <rect
        x={x + 6}
        y={y + 4}
        width={84}
        height={13}
        rx={3}
        className="fill-white stroke-slate-100"
        strokeWidth={1}
      />
      <PatternArt kind={kind} x={x + 6} y={y + 4} />
    </OptionBox>
  );
}

/** The Canvas panel: the Static and Animated pattern carousels (a page of nine each on a wide
 *  screen), the Canvas and Pattern colours, and the Opacity and Size sliders. */
export function LookAndFeelCanvas() {
  const still = [
    'Grid',
    'Blank',
    'Lines',
    'Graph',
    'Crosshatch',
    'Confetti',
    'Stripes',
    'Diagonal',
    'Waves',
  ];
  const animated = ['Flow', 'Drift', 'Aurora', 'Ripple', 'Ribbons'];
  return (
    <TabStylePanel panel="Canvas" h={384} sceneH={408}>
      <CarouselHeading y={98} label="STATIC" />
      {still.map((p, i) => (
        <PatternTile
          key={p}
          x={60 + (i % 3) * 102}
          y={106 + Math.floor(i / 3) * 38}
          kind={p}
          on={i === 0}
        />
      ))}
      <Caption x={60} y={232}>
        ANIMATED
      </Caption>
      {animated.map((p, i) => (
        <PatternTile key={p} x={60 + (i % 3) * 102} y={240 + Math.floor(i / 3) * 38} kind={p} />
      ))}
      <Caption x={60} y={334}>
        COLOURS
      </Caption>
      <rect
        x={60}
        y={346}
        width={18}
        height={18}
        rx={4}
        className="fill-white stroke-slate-300"
        strokeWidth={1.3}
      />
      <Label x={84} y={355} size={10} tone="body">
        Canvas
      </Label>
      <rect x={130} y={346} width={18} height={18} rx={4} className="fill-slate-300" />
      <Label x={154} y={355} size={10} tone="body">
        Pattern
      </Label>
      <Slider x={220} y={334} w={140} t={1} label="Opacity" readout="100%" />
      <Slider x={220} y={364} w={140} t={1 / 3} label="Size" readout="100%" />
    </TabStylePanel>
  );
}
