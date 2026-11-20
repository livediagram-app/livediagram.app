import { Label } from '@liveworkspace/help-site/art/primitives';
import { Callout, Stage, Window } from '@liveworkspace/help-site/art/parts';
import { MiniLogo, MiniWireframe } from '@liveworkspace/help-site/art/work';

const CHROME = 'fill-white stroke-slate-200';

// The bottom-right cluster's buttons, left to right (Panel Layout): Undo, Redo, the page navigator, Contents, the
// Theme & canvas button and the zoom, each with its centre and width.
const CLUSTER = [
  { label: '↶', x: 206, w: 18 },
  { label: '↷', x: 226, w: 18 },
  { label: '2 / 3', x: 254, w: 34 },
  { label: 'Contents', x: 296, w: 44 },
  { label: 'Theme', x: 336, w: 32 },
];

// User Interface: the editor laid out, with numbered callouts on its parts (Panel Layout): 1 the menu button and
// the tab's name, 2 the palette strip, 3 the bottom-right cluster (undo and redo, the page navigator, Contents and
// Theme & canvas) and 4 the tab bar with the quick controls at its end, round a logo artboard and a phone wireframe.
export function UserInterfaceArt() {
  return (
    <Stage>
      <Window x={14} y={10} w={372} h={200} title="Peak brand · livedesign">
        {/* 1: the menu button and the tab's name. */}
        <rect x={24} y={42} width={80} height={22} rx={7} className={CHROME} strokeWidth={1.2} />
        <path
          d="M31 49 h10 M31 53 h10 M31 57 h10"
          className="stroke-slate-500"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <line x1={46} y1={47} x2={46} y2={59} className="stroke-slate-200" strokeWidth={1} />
        <Label x={75} y={53.5} anchor="middle" size={7.5} weight={600} tone="strong">
          Peak brand
        </Label>

        {/* 2: the palette strip, as a logo page opens it: Draw first. */}
        <rect x={122} y={42} width={156} height={22} rx={7} className={CHROME} strokeWidth={1.2} />
        <path
          d="M131 47 v11 l2.9 -2.6 1.9 3.9 1.9 -0.9 -1.8 -3.7 3.7 -0.3 Z"
          className="fill-slate-500"
        />
        <line x1={146} y1={47} x2={146} y2={59} className="stroke-slate-200" strokeWidth={1} />
        {(
          [
            ['Draw', 162],
            ['Shapes', 195],
            ['Write', 228],
            ['Icons', 258],
          ] as const
        ).map(([t, x], i) => (
          <Label
            key={t}
            x={x}
            y={53.5}
            anchor="middle"
            size={8}
            weight={i === 0 ? 700 : 500}
            tone={i === 0 ? 'accent' : 'body'}
          >
            {t}
          </Label>
        ))}

        {/* The pages: a logo artboard and a phone wireframe. */}
        <MiniLogo x={52} y={72} w={80} h={80} />
        <MiniWireframe x={150} y={70} w={40} h={74} />

        {/* 3: the bottom-right cluster. */}
        {CLUSTER.map((b) => (
          <g key={b.label}>
            <rect
              x={b.x - b.w / 2}
              y={150}
              width={b.w}
              height={18}
              rx={5}
              className={CHROME}
              strokeWidth={1.1}
            />
            <Label
              x={b.x}
              y={159.5}
              anchor="middle"
              size={b.label.length > 2 ? 7 : 11}
              weight={600}
              tone="body"
            >
              {b.label}
            </Label>
          </g>
        ))}
        <rect x={355} y={150} width={24} height={18} rx={5} className={CHROME} strokeWidth={1.1} />
        <Label x={367} y={159.5} anchor="middle" size={6.5} weight={700} tone="strong">
          100%
        </Label>

        {/* 4: the tab bar, with the quick controls at its end. */}
        <rect x={24} y={178} width={352} height={24} rx={7} className={CHROME} strokeWidth={1.2} />
        <rect
          x={29}
          y={182}
          width={62}
          height={16}
          rx={4}
          className="fill-white stroke-brand-400"
          strokeWidth={1.2}
        />
        <Label x={60} y={190.5} anchor="middle" size={7.5} weight={700} tone="accent">
          Logo
        </Label>
        <rect x={95} y={182} width={62} height={16} rx={4} className="fill-slate-100" />
        <Label x={126} y={190.5} anchor="middle" size={7.5} weight={500} tone="body">
          App screens
        </Label>
        <Label x={168} y={190.5} anchor="middle" size={11} weight={600} tone="accent">
          +
        </Label>
        {/* Search, Settings and appearance. */}
        <circle
          cx={326}
          cy={189}
          r={3.6}
          className="fill-none stroke-slate-500"
          strokeWidth={1.3}
        />
        <path
          d="M328.6 191.6 l2.6 2.6"
          className="stroke-slate-500"
          strokeWidth={1.3}
          strokeLinecap="round"
        />
        <circle cx={346} cy={190} r={4} className="fill-none stroke-slate-500" strokeWidth={1.3} />
        <circle cx={346} cy={190} r={1.4} className="fill-slate-500" />
        <path d="M367 186 a4.5 4.5 0 1 0 3 7 a3.6 3.6 0 0 1 -3 -7 Z" className="fill-slate-500" />
      </Window>
      <Callout cx={24} cy={40} n={1} />
      <Callout cx={122} cy={40} n={2} />
      <Callout cx={184} cy={159} n={3} />
      <Callout cx={24} cy={176} n={4} />
    </Stage>
  );
}
