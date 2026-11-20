import { Card, Stage } from '@liveworkspace/help-site/art/parts';
import { BarTab } from '../illustrations/editor-chrome';
import { Desk, MeetingTable, Plant, Room, Rug, Sofa } from '../illustrations/space-furniture';

// Tabs: one Space holding several floors, stacked behind each other, each furnished its own way: a garden at the
// back, the meeting floor in the middle, the ground floor's desks and lounge in front, and the bottom bar's tabs to
// move between them.
export function TabsArt() {
  return (
    <Stage>
      <Card x={118} y={10} w={250} h={124} r={10}>
        <rect x={130} y={22} width={226} height={100} rx={4} className="fill-emerald-100" />
        <Plant cx={330} cy={50} />
        <Plant cx={300} cy={40} />
      </Card>
      <Card x={94} y={24} w={250} h={124} r={10}>
        <Room x={240} y={34} w={94} h={60} name="" door="none" />
        <MeetingTable x={258} y={56} w={56} />
      </Card>
      <Card x={30} y={40} w={250} h={124} r={10}>
        <Room x={42} y={52} w={120} h={100} name="Desks" />
        <Desk x={56} y={80} />
        <Desk x={108} y={80} />
        <Room x={168} y={52} w={100} h={100} name="Lounge" door="left" />
        <Rug cx={218} cy={104} rx={34} ry={16} />
        <Sofa x={198} y={92} />
      </Card>
      <Card x={40} y={178} w={300} h={30} r={8}>
        <BarTab x={50} y={180} w={86} label="Ground Floor" active />
        <BarTab x={140} y={180} w={70} label="First Floor" />
        <BarTab x={214} y={180} w={70} label="Garden" />
      </Card>
    </Stage>
  );
}
