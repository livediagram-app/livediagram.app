import { Label } from '@liveworkspace/help-site/art/primitives';
import { Card, Stage } from '@liveworkspace/help-site/art/parts';

const COLUMNS: { title: string; x: number; cards: { y: number; tag: string }[] }[] = [
  {
    title: 'To Do',
    x: 46,
    cards: [
      { y: 74, tag: 'fill-amber-300' },
      { y: 106, tag: 'fill-sky-300' },
      { y: 138, tag: 'fill-violet-300' },
    ],
  },
  {
    title: 'Doing',
    x: 154,
    cards: [
      { y: 74, tag: 'fill-emerald-300' },
      { y: 106, tag: 'fill-amber-300' },
    ],
  },
  { title: 'Done', x: 262, cards: [{ y: 74, tag: 'fill-sky-300' }] },
];

// Plan: a board of cards in columns, its done count filling, and a card mid-drag from Doing to Done.
export function PlanArt() {
  return (
    <Stage>
      <Card x={30} y={20} w={340} h={180} r={14}>
        <Label x={46} y={38} size={10.5} weight={700} tone="strong">
          Sprint 14
        </Label>
        <rect x={262} y={33} width={92} height={7} rx={3.5} className="fill-slate-100" />
        <rect x={262} y={33} width={38} height={7} rx={3.5} className="fill-emerald-400" />
        {COLUMNS.map((col) => (
          <g key={col.title}>
            <rect x={col.x} y={50} width={92} height={136} rx={8} className="fill-slate-50" />
            <Label x={col.x + 8} y={62} size={9} weight={700} tone="body">
              {col.title}
            </Label>
            {col.cards.map((card) => (
              <g key={card.y}>
                <rect
                  x={col.x + 6}
                  y={card.y}
                  width={80}
                  height={26}
                  rx={5}
                  className="fill-white stroke-slate-200"
                  strokeWidth={1}
                />
                <rect
                  x={col.x + 12}
                  y={card.y + 7}
                  width={44}
                  height={5}
                  rx={2.5}
                  className="fill-slate-300"
                />
                <rect
                  x={col.x + 12}
                  y={card.y + 16}
                  width={16}
                  height={4}
                  rx={2}
                  className={card.tag}
                />
              </g>
            ))}
          </g>
        ))}
        {/* The card being dragged into Done, lifted and tilted. */}
        <g transform="rotate(-4 300 120)">
          <rect
            x={262}
            y={108}
            width={80}
            height={26}
            rx={5}
            className="fill-white stroke-brand-400"
            strokeWidth={1.5}
          />
          <rect x={268} y={115} width={44} height={5} rx={2.5} className="fill-slate-300" />
          <rect x={268} y={124} width={16} height={4} rx={2} className="fill-emerald-300" />
        </g>
      </Card>
    </Stage>
  );
}
