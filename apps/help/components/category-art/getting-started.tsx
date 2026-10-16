import { Arrow, Avatar, Cursor, Label, Shape } from '@/components/illustrations/primitives';
import { Card, Stage, TickDisc } from './parts';

// A numbered step disc, sitting on the top edge of its card.
function Step({ cx, cy, n }: { cx: number; cy: number; n: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={11} className="fill-brand-500 stroke-white" strokeWidth={2.5} />
      <Label x={cx} y={cy + 0.5} anchor="middle" size={11} weight={800} tone="onAccent">
        {n}
      </Label>
    </g>
  );
}

// Getting Started: the first three things a new person does, as three cards on a path. Pick a starting point,
// add shapes, share the link.
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

      {/* 1: pick a starting point. */}
      <Card x={18} y={52} w={108} h={140} r={12}>
        {[
          ['fill-brand-100', 'fill-brand-400'],
          ['fill-violet-100', 'fill-violet-400'],
          ['fill-amber-100', 'fill-amber-400'],
          ['fill-emerald-100', 'fill-emerald-400'],
        ].map(([bg, fg], i) => {
          const x = 30 + (i % 2) * 44;
          const y = 70 + Math.floor(i / 2) * 40;
          const on = i === 0;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={40}
                height={34}
                rx={6}
                className={`${bg} ${on ? 'stroke-brand-500' : 'stroke-transparent'}`}
                strokeWidth={2}
              />
              <rect x={x + 6} y={y + 7} width={16} height={4} rx={2} className={fg} />
              <rect
                x={x + 6}
                y={y + 15}
                width={28}
                height={3}
                rx={1.5}
                className="fill-white help-art-as-drawn"
                opacity={0.9}
              />
              <rect
                x={x + 6}
                y={y + 21}
                width={20}
                height={3}
                rx={1.5}
                className="fill-white help-art-as-drawn"
                opacity={0.9}
              />
            </g>
          );
        })}
        <Label x={72} y={170} anchor="middle" size={10.5} weight={700} tone="strong">
          Pick a start
        </Label>
      </Card>
      <Step cx={72} cy={52} n={1} />

      {/* 2: add shapes. */}
      <Card x={146} y={52} w={108} h={140} r={12}>
        <Shape x={158} y={74} w={40} h={26} label="" />
        <Shape
          x={210}
          y={98}
          w={34}
          h={34}
          kind="circle"
          fill="fill-violet-100"
          stroke="stroke-violet-400"
        />
        <Shape x={162} y={118} w={36} h={26} accent />
        <Arrow from={[198, 87]} to={[214, 101]} width={2} />
        <Arrow from={[180, 100]} to={[180, 115]} width={2} />
        <Cursor x={226} y={128} colour="violet" />
        <Label x={200} y={170} anchor="middle" size={10.5} weight={700} tone="strong">
          Add shapes
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
        <Avatar cx={316} cy={145} r={9} initial="J" colour="amber" />
        <Avatar cx={330} cy={145} r={9} initial="R" colour="rose" />
        <TickDisc cx={356} cy={145} r={8} />
        <Label x={328} y={170} anchor="middle" size={10.5} weight={700} tone="strong">
          Share it
        </Label>
      </Card>
      <Step cx={328} cy={52} n={3} />
    </Stage>
  );
}
