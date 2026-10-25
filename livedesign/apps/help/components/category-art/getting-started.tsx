import { Avatar, DiscText, Label } from '@/components/illustrations/primitives';
import { Card, Stage, TickDisc } from './parts';

// A numbered step disc, sitting on the top edge of its card.
function Step({ cx, cy, n }: { cx: number; cy: number; n: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={11} className="fill-brand-500 stroke-white" strokeWidth={2.5} />
      <DiscText cx={cx} cy={cy} size={11} weight={800}>
        {n}
      </DiscText>
    </g>
  );
}

// The Layers panel's rows, top of the stack first: name, swatch, and whether it is the selected or locked one.
const LAYERS = [
  { name: 'Mark', swatch: 'fill-brand-500', selected: true },
  { name: 'Wordmark', swatch: 'fill-violet-400' },
  { name: 'Guides', swatch: 'fill-sky-400', locked: true },
  { name: 'Background', swatch: 'fill-amber-300' },
];

// An eye: the row's visibility toggle.
function Eye({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <path
        d={`M${cx - 4.5} ${cy} Q${cx} ${cy - 4} ${cx + 4.5} ${cy} Q${cx} ${cy + 4} ${cx - 4.5} ${cy} Z`}
        className="fill-none stroke-slate-400"
        strokeWidth={1}
      />
      <circle cx={cx} cy={cy} r={1.3} className="fill-slate-400" />
    </g>
  );
}

// A padlock: the row is locked.
function Lock({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <path
        d={`M${cx - 2} ${cy - 1} v-1.5 a2 2 0 0 1 4 0 v1.5`}
        className="fill-none stroke-slate-400"
        strokeWidth={1}
      />
      <rect x={cx - 3} y={cy - 1} width={6} height={4.5} rx={1} className="fill-slate-400" />
    </g>
  );
}

// Getting Started: the first three things a new person does in livedesign, as three cards on a path. Pick a
// page (a logo artboard or a wireframe screen), build it up in layers, share the link.
export function GettingStartedArt() {
  return (
    <Stage>
      <path
        d="M72 41 Q136 4 200 41 Q264 4 328 41"
        className="fill-none stroke-brand-300"
        strokeWidth={2}
        strokeDasharray="2 6"
        strokeLinecap="round"
      />

      {/* 1: pick a page. A square logo artboard (picked) with its construction circle, and a phone wireframe. */}
      <Card x={18} y={52} w={108} h={140} r={12}>
        <g transform="translate(0 2)">
          <rect
            x={28}
            y={72}
            width={48}
            height={48}
            rx={4}
            className="fill-white stroke-brand-500"
            strokeWidth={2}
          />
          <circle
            cx={52}
            cy={96}
            r={17}
            className="fill-none stroke-sky-400"
            strokeWidth={0.8}
            strokeDasharray="2.5 2.5"
          />
          <path d="M52 72 V120 M28 96 H76" className="fill-none stroke-sky-300" strokeWidth={0.6} />
          <path d="M52 84 L64 106 H40 Z" className="fill-brand-500" />
          <circle cx={52} cy={98} r={4.5} className="fill-white help-art-as-drawn" />
        </g>
        <Label x={52} y={142} anchor="middle" size={7.5} weight={600} tone="muted">
          Logo
        </Label>

        <rect x={84} y={66} width={32} height={64} rx={6} className="fill-slate-700" />
        <rect x={86.5} y={68.5} width={27} height={59} rx={4} className="fill-white" />
        <rect x={95} y={70.5} width={10} height={2.5} rx={1.2} className="fill-slate-700" />
        <rect x={90} y={77} width={14} height={3.5} rx={1.7} className="fill-brand-500" />
        <rect x={90} y={84} width={19} height={14} rx={2} className="fill-brand-50" />
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={90}
            y={102 + i * 5.5}
            width={i === 2 ? 12 : 19}
            height={2.5}
            rx={1.2}
            className="fill-slate-200"
          />
        ))}
        <rect x={90} y={119} width={19} height={5} rx={2.5} className="fill-brand-500" />
        <Label x={100} y={142} anchor="middle" size={7.5} weight={600} tone="muted">
          Wireframe
        </Label>
        <Label x={72} y={170} anchor="middle" size={10.5} weight={700} tone="strong">
          Pick a page
        </Label>
      </Card>
      <Step cx={72} cy={52} n={1} />

      {/* 2: stack layers. The Layers panel, the mark selected at the top and the guides locked. */}
      <Card x={146} y={52} w={108} h={140} r={12}>
        <Label x={158} y={74} size={8.5} weight={700} tone="body">
          Layers
        </Label>
        <path
          d="M238 71 l4 2 l-4 2 l-4 -2 Z M234 75.5 l4 2 l4 -2"
          className="fill-none stroke-slate-400"
          strokeWidth={1}
          strokeLinejoin="round"
        />
        {LAYERS.map((layer, i) => {
          const y = 84 + i * 18;
          return (
            <g key={layer.name}>
              <rect
                x={154}
                y={y}
                width={92}
                height={16}
                rx={4}
                className={
                  layer.selected
                    ? 'fill-brand-50 stroke-brand-300'
                    : 'fill-white stroke-transparent'
                }
                strokeWidth={1}
              />
              <rect x={159} y={y + 4.5} width={7} height={7} rx={1.5} className={layer.swatch} />
              <Label
                x={171}
                y={y + 8.5}
                size={8}
                weight={layer.selected ? 700 : 500}
                tone={layer.selected ? 'accent' : 'body'}
              >
                {layer.name}
              </Label>
              {layer.locked && <Lock cx={228} cy={y + 8} />}
              <Eye cx={239} cy={y + 8} />
            </g>
          );
        })}
        <Label x={200} y={170} anchor="middle" size={10.5} weight={700} tone="strong">
          Stack layers
        </Label>
      </Card>
      <Step cx={200} cy={52} n={2} />

      {/* 3: share the link. */}
      <Card x={274} y={52} w={108} h={140} r={12}>
        <rect
          x={284}
          y={76}
          width={88}
          height={22}
          rx={6}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.2}
        />
        <path
          d="M291 87 a3 3 0 0 1 3 -3 h3 M301 87 a3 3 0 0 1 -3 3 h-3 M293 87 h6"
          className="fill-none stroke-brand-500"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <rect x={306} y={84.5} width={54} height={5} rx={2.5} className="fill-slate-300" />
        <rect x={292} y={106} width={72} height={20} rx={6} className="fill-brand-500" />
        <Label x={328} y={116.5} anchor="middle" size={9.5} weight={700} tone="onAccent">
          Copy link
        </Label>
        <Avatar cx={302} cy={145} r={9} initial="A" colour="emerald" />
        <Avatar cx={316} cy={145} r={9} initial="T" colour="amber" />
        <Avatar cx={330} cy={145} r={9} initial="R" colour="violet" />
        <TickDisc cx={356} cy={145} r={8} />
        <Label x={328} y={170} anchor="middle" size={10.5} weight={700} tone="strong">
          Share it
        </Label>
      </Card>
      <Step cx={328} cy={52} n={3} />
    </Stage>
  );
}
