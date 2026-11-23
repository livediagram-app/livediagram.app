import { Label } from '@liveworkspace/help-site/art/primitives';
import { Chip, Stage } from '@liveworkspace/help-site/art/parts';
import { AppFrame, Lines, PageHead, VerifiedBadge, type TreeRowSpec } from '../illustrations/kit';

const ROWS: TreeRowSpec[] = [
  { label: 'Start Here', state: 'verified' },
  { label: 'Engineering', open: true },
  { label: 'Deploying', depth: 1, current: true, state: 'verified' },
  { label: 'On-Call', depth: 1, state: 'due' },
  { label: 'People', open: false },
];

// About liveknowledge: what it is in one picture. A Knowledgebase (the page tree, a verified page) under the two
// promises: free, and open source.
export function AboutArt() {
  return (
    <Stage>
      <Chip x={118} y={10} label="Free for everyone" tone="emerald" h={20} size={10} />
      <Chip x={236} y={10} label="Open source" tone="violet" h={20} size={10} />
      <g transform="translate(40 40)">
        <AppFrame w={320} h={150} rows={ROWS}>
          <PageHead x={128} y={38} title="Deploying" crumb="Engineering" />
          <VerifiedBadge x={128} y={68} after="Review due 10 Jun" />
          <Lines x={128} y={84} widths={[170, 160, 118]} />
        </AppFrame>
      </g>
      <Label x={200} y={208} anchor="middle" size={9} weight={600} tone="muted">
        Pages · Verified · Ask · Insights
      </Label>
    </Stage>
  );
}
