import { Label } from '@liveworkspace/help-site/art/primitives';
import { Card, Stage, Window } from '@liveworkspace/help-site/art/parts';
import { Lines } from '../illustrations/kit';

const PLACES = ['Home', 'My Work', 'Recent', 'Shared With You', 'Team Spaces'] as const;
const KNOWLEDGEBASES = [
  'Team Handbook',
  'Platform Runbook',
  'Onboarding',
  'Design Docs',
  'Support Playbook',
  'Meeting Notes',
] as const;

/** A book: a Knowledgebase's glyph on its card. */
function Book({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x} ${y + 2}a2 2 0 0 1 2-2h12v18H${x + 2}a2 2 0 0 0-2 2zM${x} ${y + 20}a2 2 0 0 0 2 2h12v-4`}
      className="fill-none stroke-brand-600"
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  );
}

// Explorer: the one library every liveworkspace app shares, here holding knowledgebases. The sidebar with My Work
// open, and a grid of knowledgebases, each card a book and its name.
export function ExplorerArt() {
  return (
    <Stage>
      <Window x={14} y={12} w={372} h={196} title="Explorer · liveknowledge">
        <rect x={14} y={34} width={92} height={174} className="fill-slate-50" />
        {PLACES.map((place, i) => (
          <g key={place}>
            {i === 1 ? (
              <rect
                x={20}
                y={44 + i * 18}
                width={80}
                height={15}
                rx={4}
                className="fill-brand-100"
              />
            ) : null}
            <Label
              x={28}
              y={52 + i * 18}
              size={7.5}
              weight={i === 1 ? 700 : 500}
              tone={i === 1 ? 'strong' : 'body'}
            >
              {place}
            </Label>
          </g>
        ))}
        {KNOWLEDGEBASES.map((name, i) => {
          const x = 118 + (i % 3) * 88;
          const y = 46 + Math.floor(i / 3) * 78;
          return (
            <Card key={name} x={x} y={y} w={80} h={68} r={8}>
              <rect x={x + 6} y={y + 6} width={68} height={34} rx={5} className="fill-brand-50" />
              <Book x={x + 33} y={y + 11} />
              <Label x={x + 8} y={y + 51} size={7} weight={700} tone="strong">
                {name}
              </Label>
              <Lines x={x + 8} y={y + 58} widths={[40]} h={3} />
            </Card>
          );
        })}
      </Window>
    </Stage>
  );
}
