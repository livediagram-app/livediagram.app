import { Label } from '@/components/illustrations/primitives';
import { Card, Stage, TickDisc, Window } from './parts';

const CHECKS: { label: string; done: boolean }[] = [
  { label: 'Check the connection', done: true },
  { label: 'Clear stuck settings', done: true },
  { label: 'Reload the canvas', done: false },
];

// Troubleshooting: a document that would not load, the fix-it button, and the checklist working through it.
export function TroubleshootingArt() {
  return (
    <Stage>
      <Window x={18} y={18} w={200} h={180} title="livediagram">
        <circle cx={118} cy={82} r={22} className="fill-amber-100" />
        <path
          d="M118 66 l17 30 h-34 Z"
          className="fill-amber-400 stroke-amber-400"
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <rect
          x={116.5}
          y={75}
          width={3}
          height={11}
          rx={1.5}
          className="fill-white help-art-as-drawn"
        />
        <circle cx={118} cy={90.5} r={1.8} className="fill-white help-art-as-drawn" />
        <Label x={118} y={122} anchor="middle" size={11} weight={700} tone="strong">
          This canvas didn&apos;t load
        </Label>
        <Label x={118} y={138} anchor="middle" size={9} tone="muted">
          Your work is safe on the server.
        </Label>
        <rect x={58} y={154} width={120} height={26} rx={8} className="fill-brand-500" />
        <Label x={118} y={167.5} anchor="middle" size={10} weight={700} tone="onAccent">
          Repair this browser
        </Label>
      </Window>

      {/* The checklist. */}
      <Card x={232} y={46} w={152} h={112} r={12}>
        <Label x={246} y={64} size={9} weight={700} tone="muted">
          FIXING IT
        </Label>
        {CHECKS.map((c, i) => {
          const y = 86 + i * 24;
          return (
            <g key={c.label}>
              {c.done ? (
                <TickDisc cx={252} cy={y} r={7} />
              ) : (
                <g>
                  <circle
                    cx={252}
                    cy={y}
                    r={6.5}
                    className="fill-none stroke-slate-200"
                    strokeWidth={2.2}
                  />
                  <path
                    d={`M252 ${y - 6.5} a6.5 6.5 0 0 1 6.5 6.5`}
                    className="fill-none stroke-brand-500"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                  />
                </g>
              )}
              <Label
                x={266}
                y={y + 0.5}
                size={9.5}
                weight={c.done ? 500 : 700}
                tone={c.done ? 'body' : 'strong'}
              >
                {c.label}
              </Label>
            </g>
          );
        })}
      </Card>

      {/* A wrench, leaning on the checklist. */}
      <g transform="rotate(40 350 180)">
        <path d="M340 168 a11 11 0 1 0 20 0 l-5 5 h-10 Z" className="fill-slate-500" />
        <rect x={346} y={178} width={8} height={30} rx={4} className="fill-slate-500" />
      </g>
    </Stage>
  );
}
