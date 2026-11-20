import { Cursor } from '@liveworkspace/help-site/art/primitives';
import { Stage } from '@liveworkspace/help-site/art/parts';
import { CornerCard } from '../illustrations/editor-chrome';
import { PixelCharacter } from '../illustrations/pixel-character';
import { Desk, MeetingTable, Plant, Room, Sticky } from '../illustrations/space-furniture';

// Collaboration: three people in one Space at once. Aria and Jae's cursors as they build, Jae holding the meeting
// table, Mara walking in to the Meeting Room, a note pinned to its wall, and Share in the corner.
export function CollaborationArt() {
  return (
    <Stage>
      <Room x={20} y={44} w={170} h={160} name="Desks" />
      <Desk x={40} y={76} />
      <Desk x={110} y={76} />
      <Desk x={40} y={136} />
      <Plant cx={168} cy={186} />
      <Room x={196} y={44} w={184} h={160} name="Meeting Room" door="left" />
      <MeetingTable x={230} y={110} w={96} />
      <rect
        x={222}
        y={100}
        width={112}
        height={48}
        rx={3}
        className="fill-none stroke-amber-500"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      <Sticky x={330} y={60} w={40} h={34} tone="sky" label="Agenda" />
      <PixelCharacter fx={214} fy={190} px={1.4} shirt="rose" name="Mara" />
      <Cursor x={130} y={150} name="Aria" colour="violet" />
      <Cursor x={322} y={140} name="Jae" colour="amber" />
      <CornerCard x={326} y={8} initial="M" />
    </Stage>
  );
}
