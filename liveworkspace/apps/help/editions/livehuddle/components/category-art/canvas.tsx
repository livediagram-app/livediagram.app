import { Cursor } from '@liveworkspace/help-site/art/primitives';
import { Stage } from '@liveworkspace/help-site/art/parts';
import { CornerCluster, Strip } from '../illustrations/editor-chrome';
import { OfficeFloor } from '../illustrations/space-furniture';

// Canvas: the floor a Space is built on, mid-build. Rooms with their desks, table and sofa, the palette strip
// floating above, your pointer, and Undo, Theme & Canvas and zoom in the corner.
export function CanvasArt() {
  return (
    <Stage>
      <g transform="translate(46 50)">
        <OfficeFloor x={0} y={0} />
      </g>
      <Cursor x={250} y={160} name="You" />
      <Strip x={40} y={10} />
      <CornerCluster x={230} y={190} />
    </Stage>
  );
}
