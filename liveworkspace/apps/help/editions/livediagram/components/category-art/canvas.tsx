import { Arrow, Cursor, SelectionBox, Shape } from '@liveworkspace/help-site/art/primitives';
import { Stage } from '@liveworkspace/help-site/art/parts';
import {
  CLUSTER_W,
  CornerCluster,
  STRIP_W,
  Strip,
} from '@/editions/livediagram/components/illustrations/editor-chrome';
import { PlusHandles, Sticky } from '@/editions/livediagram/components/illustrations/editor-canvas';

// Canvas: the infinite canvas itself, mid-flowchart, as the editor draws it. A decision branching to two outcomes,
// the chosen one selected with its + buttons, a sticky note beside it, the palette strip floating above and the
// corner cluster (Undo and Redo, Cleanup, Layers and Theme, zoom) at the bottom right.
export function CanvasArt() {
  return (
    <Stage>
      <Strip x={(400 - STRIP_W) / 2} y={12} />

      {/* The flow. */}
      <Arrow from={[96, 112]} to={[122, 112]} />
      <Arrow from={[188, 112]} to={[218, 82]} kind="elbow" />
      <Arrow from={[188, 112]} to={[218, 142]} kind="elbow" />
      <Shape x={24} y={95} w={72} h={34} kind="stadium" label="Start" />
      <Shape x={124} y={83} w={64} h={58} kind="diamond" label="Ready?" />
      <Shape x={220} y={64} w={78} h={36} accent label="Ship it" />
      <Shape x={220} y={124} w={78} h={36} label="Iterate" />
      <SelectionBox x={220} y={64} w={78} h={36} />
      <PlusHandles x={220} y={64} w={78} h={36} />

      <Sticky x={324} y={96} s={58} text={['Launch', 'on Friday!']} />

      <Cursor x={286} y={90} colour="brand" />

      <CornerCluster x={400 - 10 - CLUSTER_W} y={186} canRedo />
    </Stage>
  );
}
