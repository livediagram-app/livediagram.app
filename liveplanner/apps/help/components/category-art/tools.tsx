import { Label } from '@liveworkspace/help-site/art/primitives';
import { Card, Kbd, Shadow } from '@liveworkspace/help-site/art/parts';
import { ToolsArt as Scene } from '@liveworkspace/help-site/art/scenes/tools';

// The dark board's columns, each with its head dot and its cards' tags.
const COLUMNS = [
  { x: 254, head: 'fill-slate-400', tags: ['fill-amber-400', 'fill-sky-400', 'fill-emerald-400'] },
  { x: 298, head: 'fill-amber-400', tags: ['fill-sky-400', 'fill-rose-400'] },
  { x: 342, head: 'fill-emerald-400', tags: ['fill-emerald-400'] },
];

// Tools: the shared scene (docs/specs/018-help/help-pages.md "Category art"). liveplanner's Tools are Dark Mode and
// Zen Mode: the Z key and what Zen mode hides, and a board in Zen mode and the Dark appearance, nothing round it but
// the work.
export function ToolsArt() {
  return (
    <Scene>
      {/* Zen mode's key and what it hides. */}
      <Card x={22} y={22} w={200} h={78} r={12}>
        <Kbd x={36} y={40} w={34} h={34} label="Z" />
        <Label x={84} y={46} size={10.5} weight={700} tone="strong">
          Just the board
        </Label>
        <Label x={84} y={62} size={9} tone="muted">
          No header, tab bar or
        </Label>
        <Label x={84} y={75} size={9} tone="muted">
          corner buttons
        </Label>
      </Card>

      {/* A board in Zen mode, in the Dark appearance: the work and nothing else. */}
      <path
        d="M224 134 C232 134 234 116 240 112"
        className="fill-none stroke-brand-300"
        strokeWidth={1.6}
        strokeDasharray="3 4"
        strokeLinecap="round"
      />
      <Shadow x={242} y={22} w={142} h={176} r={12} />
      <g className="help-art-as-drawn">
        <rect x={242} y={22} width={142} height={176} rx={12} className="fill-slate-900" />
        <rect x={254} y={36} width={46} height={5} rx={2.5} className="fill-slate-300" />
        <rect x={326} y={36} width={46} height={5} rx={2.5} className="fill-slate-700" />
        <rect x={326} y={36} width={28} height={5} rx={2.5} className="fill-brand-400" />
        {COLUMNS.map((col) => (
          <g key={col.x}>
            <rect x={col.x} y={52} width={40} height={134} rx={6} className="fill-slate-800" />
            <circle cx={col.x + 8} cy={61} r={2.5} className={col.head} />
            <rect
              x={col.x + 14}
              y={59.5}
              width={18}
              height={3}
              rx={1.5}
              className="fill-slate-500"
            />
            {col.tags.map((tag, i) => (
              <g key={i}>
                <rect
                  x={col.x + 4}
                  y={70 + i * 34}
                  width={32}
                  height={28}
                  rx={4}
                  className="fill-slate-700"
                />
                <rect
                  x={col.x + 9}
                  y={77 + i * 34}
                  width={20}
                  height={3.5}
                  rx={1.7}
                  className="fill-slate-300"
                />
                <rect
                  x={col.x + 9}
                  y={85 + i * 34}
                  width={14}
                  height={3.5}
                  rx={1.7}
                  className="fill-slate-500"
                />
                <rect
                  x={col.x + 9}
                  y={91 + i * 34}
                  width={10}
                  height={3.5}
                  rx={1.7}
                  className={tag}
                />
              </g>
            ))}
          </g>
        ))}
      </g>
    </Scene>
  );
}
