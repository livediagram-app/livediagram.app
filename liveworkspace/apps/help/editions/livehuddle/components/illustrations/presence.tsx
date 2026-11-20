// Presence in a Space (the Collaboration articles, liveworkspace/docs/specs/017-help/help-centre.md): live cursors
// and walking characters on the floor, the open tab's presence stack, a teammate's held selection, the In Use menu
// that releases it, and following someone. Drawn on livehuddle's own floor and chrome.

import { Cursor, Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { BAR_H, BottomBar, Card } from './editor-chrome';
import { Desk, MeetingTable, OfficeFloor, Plant, Room, Sofa, Rug } from './space-furniture';
import { PixelCharacter } from './pixel-character';

/** The presence stack on the open tab: overlapping initials in each person's colour. */
function PresenceStack({ x, y, people }: { x: number; y: number; people: [string, string][] }) {
  return (
    <g>
      {people.map(([initial, cls], i) => (
        <g key={initial}>
          <circle cx={x + i * 8} cy={y} r={5} className={`${cls} stroke-white`} strokeWidth={1} />
          <Label x={x + i * 8} y={y + 0.5} size={6.5} weight={700} anchor="middle" tone="onAccent">
            {initial}
          </Label>
        </g>
      ))}
    </g>
  );
}

const PEOPLE: [string, string][] = [
  ['A', 'fill-violet-500 dark:fill-violet-700'],
  ['J', 'fill-amber-500 dark:fill-amber-700'],
  ['M', 'fill-rose-500 dark:fill-rose-700'],
];

/** Everyone in the Space at once: Aria's and Jae's pointers with their names as they build, Mara walking in to the
 *  Lounge, and the open tab's presence stack in the bottom bar. */
export function SpacePresence() {
  return (
    <Scene w={420} h={230}>
      <g transform="translate(60 14) scale(0.95)">
        <OfficeFloor x={0} y={0} />
      </g>
      <Cursor x={118} y={58} name="Aria" colour="violet" />
      <Cursor x={286} y={74} name="Jae" colour="amber" />
      <PixelCharacter fx={150} fy={170} px={1.7} shirt="rose" name="Mara" />
      <BottomBar y={230 - BAR_H} w={420} tabs={['Virtual Office']} firstTabW={112} />
      <PresenceStack x={98} y={230 - BAR_H + 15} people={PEOPLE} />
    </Scene>
  );
}

/** A teammate's selection: Jae has the meeting table, so its outline is in Jae's colour with Jae's initial on its
 *  corner, and it is held for Jae while they work on it. */
export function PresenceSelection() {
  return (
    <Scene w={420} h={190}>
      <Room x={30} y={24} w={360} h={150} name="Meeting Room" />
      <MeetingTable x={80} y={80} w={90} />
      <rect
        x={72}
        y={70}
        width={106}
        height={46}
        rx={3}
        className="fill-none stroke-amber-500"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      <circle cx={72} cy={70} r={6} className="fill-amber-500 dark:fill-amber-700" />
      <Label x={72} y={70.5} size={7} weight={700} anchor="middle" tone="onAccent">
        J
      </Label>
      <Cursor x={170} y={110} name="Jae" colour="amber" />
      <Desk x={270} y={80} />
      <Plant cx={360} cy={150} />
    </Scene>
  );
}

/** Right-clicking the sofa Jae holds: the In Use menu names whose hold it is, and Release Jae's Hold frees it. */
export function ReleaseHold() {
  const mx = 214;
  const my = 40;
  return (
    <Scene w={420} h={180}>
      <Room x={20} y={24} w={180} h={136} name="Lounge" door="none" />
      <Rug cx={102} cy={96} rx={46} ry={22} />
      <Sofa x={82} y={78} />
      <rect
        x={76}
        y={72}
        width={52}
        height={30}
        rx={3}
        className="fill-none stroke-amber-500"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      <circle cx={76} cy={72} r={6} className="fill-amber-500 dark:fill-amber-700" />
      <Label x={76} y={72.5} size={7} weight={700} anchor="middle" tone="onAccent">
        J
      </Label>
      <Cursor x={118} y={92} />
      <Card x={mx} y={my} w={190} h={92} r={7}>
        <Label x={mx + 12} y={my + 14} size={8} weight={700} tone="muted">
          IN USE
        </Label>
        <rect x={mx + 5} y={my + 24} width={180} height={22} rx={5} className="fill-slate-100" />
        <circle cx={mx + 16} cy={my + 35} r={3} className="fill-amber-500 dark:fill-amber-700" />
        <Label x={mx + 25} y={my + 35.5} size={10} tone="strong">
          Release Jae&apos;s Hold
        </Label>
        <Label x={mx + 12} y={my + 62} size={9} tone="muted">
          They keep their work; it just stops
        </Label>
        <Label x={mx + 12} y={my + 74} size={9} tone="muted">
          being theirs to edit.
        </Label>
      </Card>
    </Scene>
  );
}

/** Following Sam: the pill at the top of the canvas with its Stop, Sam's character ringed where they stand, and
 *  your view moving with them. */
export function FollowAlong() {
  return (
    <Scene w={420} h={210}>
      <Room x={30} y={44} w={240} h={150} name="Desks" />
      <Desk x={60} y={90} />
      <Desk x={110} y={90} />
      <Desk x={160} y={90} />
      <Room x={282} y={44} w={120} h={150} name="Kitchen" door="left" />
      <Plant cx={380} cy={176} />
      <circle
        cx={232}
        cy={158}
        r={16}
        className="fill-emerald-500/15 stroke-emerald-500"
        strokeWidth={1.2}
      />
      <PixelCharacter fx={232} fy={166} px={1.8} shirt="emerald" name="Sam" />
      <g>
        <rect x={127} y={10} width={166} height={24} rx={12} className="fill-brand-700" />
        <circle cx={141} cy={22} r={3} className="fill-white help-art-as-drawn" />
        <Label x={150} y={22.5} size={10.5} weight={600} tone="onAccent">
          Following Sam
        </Label>
        <rect
          x={250}
          y={15}
          width={34}
          height={14}
          rx={7}
          className="fill-white/25 help-art-as-drawn"
        />
        <Label x={267} y={22.5} anchor="middle" size={9.5} weight={700} tone="onAccent">
          Stop
        </Label>
      </g>
      <path
        d="M210 166 h-40"
        className="stroke-emerald-500"
        strokeWidth={1}
        strokeDasharray="2 3"
      />
    </Scene>
  );
}
