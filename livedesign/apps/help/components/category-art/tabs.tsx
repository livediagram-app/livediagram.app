import { Arrow, Label } from '@/components/illustrations/primitives';
import { Card, Stage } from './parts';

const PILLS: { label: string; x: number; w: number; active?: boolean }[] = [
  { label: 'Logo', x: 52, w: 72 },
  { label: 'App Screens', x: 130, w: 92, active: true },
  { label: 'Photos', x: 228, w: 70 },
];

// Tabs: one design holding several tabs of pages, stacked behind each other, each with its own content: photos at
// the back, a logo's wordmark in the middle, app screens in front, and the tab bar to move between them.
export function TabsArt() {
  return (
    <Stage>
      {/* Back: photos, as strips of colour. */}
      <Card x={118} y={10} w={250} h={124} r={12}>
        <rect x={262} y={22} width={60} height={8} rx={4} className="fill-amber-300" />
        <rect x={300} y={38} width={56} height={8} rx={4} className="fill-emerald-300" />
      </Card>
      {/* Middle: a logo's wordmark and its lines. */}
      <Card x={94} y={24} w={250} h={124} r={12}>
        <rect x={276} y={34} width={56} height={8} rx={4} className="fill-violet-300" />
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={276}
            y={50 + i * 10}
            width={i === 2 ? 34 : 56}
            height={4}
            rx={2}
            className="fill-violet-100"
          />
        ))}
      </Card>
      {/* Front: two app screens, side by side, joined by the flow between them. */}
      <Card x={30} y={40} w={250} h={124} r={12}>
        <Label x={46} y={64} size={10.5} weight={700} tone="strong">
          Sign-in Flow
        </Label>
        {[60, 172].map((x, i) => (
          <g key={x}>
            <rect x={x} y={74} width={48} height={84} rx={7} className="fill-slate-800" />
            <rect x={x + 3} y={77} width={42} height={78} rx={5} className="fill-white" />
            <rect x={x + 8} y={86} width={22} height={4} rx={2} className="fill-brand-500" />
            <rect
              x={x + 8}
              y={96}
              width={32}
              height={8}
              rx={2}
              className="fill-none stroke-slate-300"
              strokeWidth={1}
            />
            <rect
              x={x + 8}
              y={108}
              width={32}
              height={i === 0 ? 8 : 22}
              rx={2}
              className={i === 0 ? 'fill-none stroke-slate-300' : 'fill-emerald-50'}
              strokeWidth={1}
            />
            <rect x={x + 8} y={140} width={32} height={8} rx={4} className="fill-brand-500" />
          </g>
        ))}
        <Arrow from={[110, 116]} to={[169, 116]} />
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
