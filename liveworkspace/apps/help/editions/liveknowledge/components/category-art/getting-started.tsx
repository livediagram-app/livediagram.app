import { Label } from '@liveworkspace/help-site/art/primitives';
import { Card, Stage } from '@liveworkspace/help-site/art/parts';
import { Btn, Lines, Pill, TreeRows, VerifiedBadge } from '../illustrations/kit';

/** A numbered step card: its number, its name, and what it holds. */
function Step({ x, n, title }: { x: number; n: number; title: string }) {
  return (
    <g>
      <Card x={x} y={40} w={116} h={150} r={10}>
        <circle cx={x + 16} cy={58} r={8} className="fill-brand-600" />
        <Label x={x + 16} y={58.5} anchor="middle" size={8} weight={700} tone="onAccent">
          {n}
        </Label>
        <Label x={x + 30} y={58.5} size={9} weight={700} tone="strong">
          {title}
        </Label>
      </Card>
    </g>
  );
}

// Getting Started: the first three things a team does in liveknowledge, as three cards on a path. Add pages to the
// tree, write and link them, verify the page so the team can trust it.
export function GettingStartedArt() {
  return (
    <Stage>
      <path
        d="M134 115 h12 M262 115 h12"
        className="stroke-brand-300"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Step x={18} n={1} title="Add Pages" />
      <TreeRows
        x={26}
        y={76}
        w={100}
        rows={[
          { label: 'Start Here' },
          { label: 'Engineering', open: true },
          { label: 'Deploying', depth: 1, current: true },
          { label: 'On-Call', depth: 1 },
        ]}
      />
      <Btn x={30} y={150} w={92} h={16} label="New Page" size={7.5} />
      <Step x={146} n={2} title="Write and Link" />
      <Lines x={158} y={80} widths={[92, 86, 60]} />
      <Pill x={158} y={114} label="Rollbacks" tone="brand" size={7} h={11} />
      <Lines x={208} y={112} widths={[42]} />
      <Lines x={158} y={128} widths={[90, 74]} />
      <Step x={274} n={3} title="Verify" />
      <Label x={286} y={88} size={11} weight={800} tone="strong">
        Deploying
      </Label>
      <VerifiedBadge x={286} y={108} by="Maya" />
      <Lines x={286} y={124} widths={[90, 80]} />
      <Btn x={286} y={150} w={92} h={16} label="Verify Again" size={7.5} />
    </Stage>
  );
}
