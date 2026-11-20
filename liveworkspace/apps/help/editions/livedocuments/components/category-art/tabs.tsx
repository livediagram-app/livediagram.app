import { Label } from '@liveworkspace/help-site/art/primitives';
import { Card, Stage } from '@liveworkspace/help-site/art/parts';
import { MiniSlide } from '@liveworkspace/help-site/art/work';

const PILLS: { label: string; x: number; w: number; active?: boolean }[] = [
  { label: 'Overview', x: 52, w: 72 },
  { label: 'Pitch deck', x: 130, w: 92, active: true },
  { label: 'Roadmap', x: 228, w: 70 },
];

// Tabs: one document holding several tabs of pages, stacked behind each other, each with its own content: a roadmap
// at the back, an article in the middle, a deck of slides in front, and the tab bar to move between them.
export function TabsArt() {
  return (
    <Stage>
      {/* Back: a roadmap of bars. */}
      <Card x={118} y={10} w={250} h={124} r={12}>
        <rect x={262} y={22} width={60} height={8} rx={4} className="fill-amber-300" />
        <rect x={300} y={38} width={56} height={8} rx={4} className="fill-emerald-300" />
      </Card>
      {/* Middle: an article page's heading and lines of text. */}
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
      {/* Front: the pitch deck's slides. */}
      <Card x={30} y={40} w={250} h={124} r={12}>
        <Label x={46} y={60} size={10.5} weight={700} tone="strong">
          Pitch deck
        </Label>
        <MiniSlide x={46} y={74} w={132} h={74} />
        <MiniSlide x={190} y={74} w={74} h={42} />
        <MiniSlide x={190} y={118} w={74} h={42} />
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
