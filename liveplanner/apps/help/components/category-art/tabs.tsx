import { Label } from '@/components/illustrations/primitives';
import { Card, Stage } from './parts';

const PILLS: { label: string; x: number; w: number; active?: boolean }[] = [
  { label: 'Overview', x: 52, w: 72 },
  { label: 'Budget', x: 130, w: 92, active: true },
  { label: 'Roadmap', x: 228, w: 70 },
];

// Tabs: one project holding several tabs, stacked behind each other, each with its own content: a roadmap
// at the back, a board in the middle, a sheet in front, and the tab bar to move between them.
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
      {/* Front: a sheet of figures. */}
      <Card x={30} y={40} w={250} h={124} r={12}>
        <Label x={46} y={64} size={10.5} weight={700} tone="strong">
          Budget
        </Label>
        {[0, 1, 2, 3].map((row) =>
          [0, 1, 2].map((col) => (
            <rect
              key={`${row}-${col}`}
              x={46 + col * 72}
              y={76 + row * 18}
              width={72}
              height={18}
              className={
                row === 0 ? 'fill-slate-100 stroke-slate-200' : 'fill-white stroke-slate-200'
              }
              strokeWidth={1}
            />
          )),
        )}
        <rect
          x={190}
          y={130}
          width={72}
          height={18}
          className="fill-transparent stroke-brand-400"
          strokeWidth={1.5}
        />
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
