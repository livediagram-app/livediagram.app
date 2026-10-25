import { Label } from '../primitives';
import { Card, Chip, Stage, TickDisc } from '../parts';

// A policy page: its title, then numbered clauses of text lines.
function Page({ x, y, title, rotate }: { x: number; y: number; title: string; rotate: number }) {
  return (
    <g transform={`rotate(${rotate} ${x + 75} ${y + 90})`}>
      <Card x={x} y={y} w={150} h={180} r={10}>
        <rect x={x + 16} y={y + 18} width={20} height={4} rx={2} className="fill-brand-400" />
        <Label x={x + 16} y={y + 36} size={12} weight={700} tone="strong">
          {title}
        </Label>
        {[0, 1, 2].map((k) => (
          <g key={k}>
            <Label x={x + 16} y={y + 62 + k * 38} size={8.5} weight={700} tone="accent">
              {`${k + 1}.`}
            </Label>
            <rect
              x={x + 28}
              y={y + 59 + k * 38}
              width={104}
              height={5}
              rx={2.5}
              className="fill-slate-300"
            />
            <rect
              x={x + 28}
              y={y + 70 + k * 38}
              width={92}
              height={4}
              rx={2}
              className="fill-slate-200"
            />
            <rect
              x={x + 28}
              y={y + 79 + k * 38}
              width={70}
              height={4}
              rx={2}
              className="fill-slate-200"
            />
          </g>
        ))}
      </Card>
    </g>
  );
}

// Policies: the hosted service's terms and privacy policy, side by side, with the seal that says they are the
// current versions and the route for reporting a vulnerability.
export function PoliciesArt() {
  return (
    <Stage>
      <Page x={196} y={20} title="Privacy Policy" rotate={5} />
      <Page x={60} y={22} title="Terms of Service" rotate={-4} />

      {/* The seal. */}
      <g>
        <path d="M188 168 l-9 34 11 -6 6 10 6 -32 Z" className="fill-brand-600" />
        <path d="M210 168 l9 34 -11 -6 -6 10 -6 -32 Z" className="fill-brand-500" />
        <circle cx={199} cy={160} r={22} className="fill-brand-500 stroke-white" strokeWidth={3} />
        <circle
          cx={199}
          cy={160}
          r={16}
          className="fill-none stroke-brand-200"
          strokeWidth={1.5}
          strokeDasharray="2 2.5"
        />
        <TickDisc cx={199} cy={160} r={10} tone="brand" />
      </g>

      <Chip x={268} y={190} label="Report a vulnerability" tone="rose" h={22} size={9} />
    </Stage>
  );
}
