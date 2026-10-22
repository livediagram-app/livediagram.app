import { Arrow, Label, Shape } from '@/components/illustrations/primitives';
import { Chip, Stage, Window } from './parts';

// About livediagram: what it is in one picture. Three windows fanned out, one per way of working (planning on a
// board, a diagram, a sketch), under the two promises: free, and open source.
export function AboutArt() {
  return (
    <Stage>
      {/* Plan: a board, tilted back on the left. */}
      <g transform="rotate(-7 92 120)">
        <Window x={18} y={52} w={150} h={118} title="Plan">
          {[0, 1, 2].map((c) => (
            <g key={c}>
              <rect
                x={28 + c * 46}
                y={84}
                width={40}
                height={6}
                rx={3}
                className={['fill-violet-300', 'fill-amber-300', 'fill-emerald-300'][c]}
              />
              {[0, 1, 2].slice(0, 3 - c).map((r) => (
                <rect
                  key={r}
                  x={28 + c * 46}
                  y={96 + r * 22}
                  width={40}
                  height={18}
                  rx={4}
                  className="fill-white stroke-slate-200"
                  strokeWidth={1.2}
                />
              ))}
            </g>
          ))}
        </Window>
      </g>
      {/* Draw: a freehand sketch, tilted forward on the right. */}
      <g transform="rotate(7 308 120)">
        <Window x={232} y={52} w={150} h={118} title="Draw">
          <path
            d="M248 136 C262 100 284 96 296 118 S326 150 340 112 S360 92 366 104"
            fill="none"
            className="stroke-brand-500"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle
            cx={346}
            cy={142}
            r={12}
            fill="none"
            className="stroke-amber-400"
            strokeWidth={2.5}
          />
          <path
            d="M252 152 l22 0"
            className="stroke-slate-400"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Window>
      </g>
      {/* Diagram: in front, in the middle. */}
      <Window x={110} y={40} w={180} h={140} title="Diagram">
        <Shape x={124} y={86} w={60} h={32} label="Idea" />
        <Shape
          x={214}
          y={78}
          w={62}
          h={48}
          kind="diamond"
          fill="fill-violet-100"
          stroke="stroke-violet-400"
        />
        <Shape x={170} y={140} w={64} h={30} accent label="Build" />
        <Arrow from={[184, 102]} to={[211, 102]} width={2} />
        <Arrow from={[245, 126]} to={[226, 138]} width={2} />
      </Window>

      <Chip x={118} y={12} label="Free for everyone" tone="emerald" h={20} size={10} />
      <Chip x={236} y={12} label="Open source" tone="violet" h={20} size={10} />
      <Label x={200} y={204} anchor="middle" size={9} weight={600} tone="muted">
        Diagram · Draw · Workshop · Plan
      </Label>
    </Stage>
  );
}
