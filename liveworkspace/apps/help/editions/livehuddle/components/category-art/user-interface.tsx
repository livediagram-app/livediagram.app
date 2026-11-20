import { Callout, Stage, Window } from '@liveworkspace/help-site/art/parts';
import { EditorScreen } from '../illustrations/devices';

// User Interface: the whole editor laid out, with numbered callouts on its parts: the logo and menu cards, the
// palette strip, the corner cluster, and the tabs along the foot.
export function UserInterfaceArt() {
  return (
    <Stage>
      <Window x={14} y={10} w={372} h={200} title="Our Office · livehuddle">
        <EditorScreen x={15} y={30} w={370} />
      </Window>
      <Callout cx={26} cy={40} n={1} />
      <Callout cx={200} cy={40} n={2} />
      <Callout cx={300} cy={176} n={3} />
      <Callout cx={26} cy={196} n={4} />
    </Stage>
  );
}
