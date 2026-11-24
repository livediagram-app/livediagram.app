import {
  SupportedDevicesArt as Scene,
  type ScreenBox,
} from '@liveworkspace/help-site/art/scenes/supported-devices';
import {
  AppFrame,
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

// Supported Devices: the shared scene (liveworkspace/docs/specs/017-help/help-centre.md "Category art"), the same
// Knowledgebase on a computer, a tablet and a phone: the real editor frame scaled whole into each screen.
function Editor({ x, y, w, h }: ScreenBox) {
  const k = Math.min(w / W, h / H);
  const ox = x + (w - W * k) / 2;
  const oy = y + (h - H * k) / 2;
  return (
    <g transform={`translate(${ox} ${oy}) scale(${k})`}>
      <AppFrame w={W} h={H} rows={ROWS} topRow={<FormatRow x={SIDEBAR_W} y={0} />}>
        <PageHead x={130} y={44} title="Deploying" crumb="Engineering" />
        <VerifiedBadge x={130} y={74} after="Review due 10 Jun" />
        <Lines x={130} y={92} widths={[214, 200, 120, 190]} />
      </AppFrame>
    </g>
  );
}

export function SupportedDevicesArt() {
  return <Scene screen={(box) => <Editor {...box} />} />;
}
