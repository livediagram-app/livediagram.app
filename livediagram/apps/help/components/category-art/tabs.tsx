import { Arrow, Label, Shape } from '@liveworkspace/help-site/art/primitives';
import { Card, Stage } from '@liveworkspace/help-site/art/parts';

const PILLS: { label: string; x: number; w: number; active?: boolean }[] = [
  { label: 'Overview', x: 52, w: 72 },
  { label: 'Architecture', x: 130, w: 92, active: true },
  { label: 'Roadmap', x: 228, w: 70 },
];

// Tabs: one document holding several canvases, stacked behind each other, each with its own content: a roadmap
// at the back, a board in the middle, the architecture diagram in front, and the tab bar to move between them.
export function TabsArt() {
  return (
    <Stage>
      {/* Back: a roadmap of bars. */}
      <Card x={118} y={10} w={250} h={124} r={12}>
        <rect x={262} y={22} width={60} height={8} rx={4} className="fill-amber-300" />
        <rect x={300} y={38} width={56} height={8} rx={4} className="fill-emerald-300" />
      </Card>
      {/* Middle: a board's columns. */}
      <Card x={94} y={24} w={250} h={124} r={12}>
        <rect x={276} y={34} width={56} height={10} rx={3} className="fill-violet-100" />
        <rect
          x={276}
          y={50}
          width={56}
          height={22}
          rx={4}
          className="fill-white stroke-violet-200"
          strokeWidth={1}
        />
        <rect
          x={276}
          y={76}
          width={56}
          height={22}
          rx={4}
          className="fill-white stroke-violet-200"
          strokeWidth={1}
        />
      </Card>
      {/* Front: the architecture diagram. */}
      <Card x={30} y={40} w={250} h={124} r={12}>
        <Shape x={46} y={96} w={58} h={38} label="Web" />
        <Shape x={128} y={96} w={58} h={38} accent label="API" />
        <Shape
          x={208}
          y={90}
          w={56}
          h={50}
          kind="cylinder"
          label="DB"
          fill="fill-emerald-100"
          stroke="stroke-emerald-400"
        />
        <Arrow from={[104, 115]} to={[125, 115]} />
        <Arrow from={[186, 115]} to={[205, 115]} />
        <Label x={46} y={64} size={10.5} weight={700} tone="strong">
          System Architecture
        </Label>
      </Card>

      {/* The tab bar. */}
      <Card x={40} y={178} w={300} h={30} r={10}>
        {PILLS.map((p) => (
          <g key={p.label}>
            <rect
              x={p.x}
              y={183}
              width={p.w}
              height={20}
              rx={6}
              className={
                p.active ? 'fill-white stroke-brand-400' : 'fill-slate-100 stroke-transparent'
              }
              strokeWidth={1.5}
            />
            <Label
              x={p.x + p.w / 2}
              y={193.5}
              anchor="middle"
              size={9.5}
              weight={p.active ? 700 : 500}
              tone={p.active ? 'accent' : 'body'}
            >
              {p.label}
            </Label>
          </g>
        ))}
        <rect
          x={306}
          y={183}
          width={22}
          height={20}
          rx={6}
          className="fill-brand-50 stroke-brand-200"
          strokeWidth={1}
        />
        <path
          d="M317 188 v10 M312 193 h10"
          className="stroke-brand-600"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </Card>
    </Stage>
  );
}
