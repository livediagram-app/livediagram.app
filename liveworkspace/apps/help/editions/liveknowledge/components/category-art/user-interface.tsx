import { Callout, Stage } from '@liveworkspace/help-site/art/parts';
import {
  AppFrame,
  FOOT_H,
  FormatRow,
  Lines,
  PageHead,
  SIDEBAR_W,
  VerifiedBadge,
  type TreeRowSpec,
} from '../illustrations/kit';

const ROWS: TreeRowSpec[] = [
  { label: 'Start Here', state: 'verified' },
  { label: 'Engineering', open: true },
  { label: 'Deploying', depth: 1, current: true },
  { label: 'On-Call', depth: 1, state: 'due' },
];
const W = 376;
const H = 204;
const OX = 12;
const OY = 10;

// User Interface: the editor laid out, with numbered callouts on its parts: 1 the sidebar and its page tree, 2 the
// formatting row, 3 the page, and 4 the footer, whose tabs are Pages, Ask and Insights.
export function UserInterfaceArt() {
  return (
    <Stage>
      <g transform={`translate(${OX} ${OY})`}>
        <AppFrame w={W} h={H} rows={ROWS} topRow={<FormatRow x={SIDEBAR_W} y={0} />}>
          <PageHead x={130} y={44} title="Deploying" crumb="Engineering" />
          <VerifiedBadge x={130} y={74} after="Review due 10 Jun" />
          <Lines x={130} y={92} widths={[214, 200, 120, 190]} />
        </AppFrame>
      </g>
      <Callout cx={OX + 8} cy={OY + 40} n={1} />
      <Callout cx={OX + SIDEBAR_W + 8} cy={OY + 4} n={2} />
      <Callout cx={OX + 122} cy={OY + 44} n={3} />
      <Callout cx={OX + 8} cy={OY + H - 6 - FOOT_H / 2} n={4} />
    </Stage>
  );
}
