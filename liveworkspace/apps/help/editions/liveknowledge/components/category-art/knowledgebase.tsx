import { Stage } from '@liveworkspace/help-site/art/parts';
import {
  AppFrame,
  FormatRow,
  Lines,
  PageHead,
  Pill,
  SIDEBAR_W,
  VerifiedBadge,
  type TreeRowSpec,
} from '../illustrations/kit';

const ROWS: TreeRowSpec[] = [
  { label: 'Start Here', state: 'verified' },
  { label: 'Engineering', open: true },
  { label: 'Deploying', depth: 1, current: true, state: 'verified' },
  { label: 'Rollbacks', depth: 2 },
  { label: 'On-Call', depth: 1, state: 'due' },
  { label: 'People', open: false, state: 'verified' },
  { label: 'Holidays', depth: 0 },
];

// Knowledgebase: the editor itself. The page tree with its verified ticks and a Review Due pill, the formatting row,
// and a verified page of writing with a link to another page.
export function KnowledgebaseArt() {
  return (
    <Stage>
      <g transform="translate(12 10)">
        <AppFrame w={376} h={204} rows={ROWS} topRow={<FormatRow x={SIDEBAR_W} y={0} />}>
          <PageHead x={130} y={44} title="Deploying" crumb="Engineering" />
          <VerifiedBadge x={130} y={74} after="Review due 10 Jun" />
          <Lines x={130} y={92} widths={[214, 200, 120]} />
          <Pill x={130} y={128} label="Rollbacks" tone="brand" size={7} h={11} />
          <Lines x={182} y={126} widths={[150]} />
          <Lines x={130} y={142} widths={[206, 168]} />
        </AppFrame>
      </g>
    </Stage>
  );
}
