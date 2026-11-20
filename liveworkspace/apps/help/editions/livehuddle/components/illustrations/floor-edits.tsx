// Changing what is on a Space's floor (the Canvas and Tips articles, liveworkspace/docs/specs/017-help/help-centre.md):
// Undo and Redo with their keys and corner buttons, rotating a piece, Shift-dragging a copy, and the toast an agent's
// change leaves. Drawn with livehuddle's own furniture and chrome.

import {
  Button,
  Cursor,
  Label,
  Scene,
  SelectionBox,
} from '@liveworkspace/help-site/art/primitives';
import { Card, CornerCluster } from './editor-chrome';
import { Chair, Desk, MeetingTable, Plant, Room, Sofa } from './space-furniture';

/** A key on the keyboard with what it does under it. */
function KeyChip({ x, y, keys, caption }: { x: number; y: number; keys: string; caption: string }) {
  const w = keys.length > 3 ? 56 : 40;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        width={w}
        height={26}
        rx={6}
        className="fill-white stroke-slate-300"
        strokeWidth={0.75}
      />
      <Label x={w / 2} y={14} anchor="middle" size={10} weight={700} tone="body">
        {keys}
      </Label>
      <Label x={w / 2} y={42} anchor="middle" size={10} tone="muted">
        {caption}
      </Label>
    </g>
  );
}

/** The Desks room with its first two desks; the third is the one Undo and Redo step over. */
function DeskRoom({ third }: { third: 'gone' | 'back' }) {
  return (
    <g>
      <Room x={24} y={24} w={250} h={150} name="Desks" />
      <Desk x={50} y={64} />
      <Desk x={110} y={64} />
      <Plant cx={250} cy={152} />
      {third === 'gone' ? (
        <g opacity={0.3}>
          <Desk x={170} y={64} />
          <rect
            x={166}
            y={56}
            width={42}
            height={40}
            rx={2}
            className="fill-none stroke-slate-400"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        </g>
      ) : (
        <g>
          <Desk x={170} y={64} />
          <SelectionBox x={166} y={56} w={42} h={40} />
        </g>
      )}
    </g>
  );
}

/** Undo: the desk just added fades away as Cmd or Ctrl plus Z steps it back. */
export function UndoStep() {
  return (
    <Scene w={420} h={220}>
      <DeskRoom third="gone" />
      <KeyChip x={316} y={50} keys="⌘ Z" caption="Undo" />
      <CornerCluster x={420 - 8 - 162} y={188} canRedo highlight="undo" />
    </Scene>
  );
}

/** Redo: the desk that was undone comes back. */
export function RedoStep() {
  return (
    <Scene w={420} h={220}>
      <DeskRoom third="back" />
      <KeyChip x={308} y={50} keys="⌘ ⇧ Z" caption="Redo" />
      <CornerCluster x={420 - 8 - 162} y={188} canRedo highlight="redo" />
    </Scene>
  );
}

/** A sofa turned 45° over its upright outline, the angle read off beside it. */
export function RotatedSofa() {
  const cx = 200;
  const cy = 110;
  return (
    <Scene w={400} h={210}>
      <Room x={70} y={20} w={260} h={176} name="Lounge" door="none" />
      <rect
        x={cx - 24}
        y={cy - 13}
        width={48}
        height={26}
        rx={3}
        className="fill-none stroke-slate-400"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <g transform={`rotate(45 ${cx} ${cy})`}>
        <Sofa x={cx - 20} y={cy - 9} />
        <SelectionBox x={cx - 24} y={cy - 13} w={48} h={26} />
      </g>
      <path
        d={`M${cx + 34} ${cy - 34} A 48 48 0 0 1 ${cx + 48} ${cy}`}
        fill="none"
        className="stroke-brand-500"
        strokeWidth={1.25}
        strokeLinecap="round"
      />
      <Label x={cx + 66} y={cy - 22} anchor="middle" size={11} weight={600} tone="accent">
        45°
      </Label>
    </Scene>
  );
}

/** Shift and drag: the chair stays where it was while its copy follows the pointer. */
export function ShiftDragDuplicate() {
  return (
    <Scene w={420} h={190}>
      <Room x={24} y={24} w={372} h={146} name="Meeting Room" />
      <MeetingTable x={60} y={84} w={90} />
      <Chair cx={214} cy={100} facing="left" s={1.3} />
      <g opacity={0.5}>
        <Chair cx={300} cy={100} facing="left" s={1.3} />
      </g>
      <SelectionBox x={290} y={88} w={20} h={24} />
      <path d="M226 100 h56" className="stroke-slate-400" strokeWidth={1} strokeDasharray="3 3" />
      <Cursor x={304} y={106} />
      <rect
        x={330}
        y={40}
        width={44}
        height={22}
        rx={5}
        className="fill-white stroke-slate-300"
        strokeWidth={0.75}
      />
      <Label x={352} y={52} anchor="middle" size={10} weight={700} tone="strong">
        Shift
      </Label>
    </Scene>
  );
}

/** An agent's change: the room it furnished outlined in the agent token owner's colour, and the toast naming who
 *  changed how many pieces and why, with Show and Undo. */
export function AgentChangeToast() {
  return (
    <Scene w={420} h={210}>
      <Room x={40} y={18} w={200} h={88} name="Focus Room" />
      <Desk x={70} y={50} />
      <Desk x={130} y={50} />
      <Plant cx={214} cy={88} />
      <rect
        x={34}
        y={12}
        width={212}
        height={100}
        rx={6}
        className="fill-none stroke-violet-500 dark:stroke-violet-700"
        strokeWidth={1.75}
      />
      <Card x={40} y={128} w={340} h={66} r={7}>
        <circle cx={58} cy={146} r={6} className="fill-none stroke-slate-500" strokeWidth={1.1} />
        <path
          d="M58 144 v5 M58 142 v0.1"
          className="stroke-slate-500"
          strokeWidth={1.2}
          strokeLinecap="round"
        />
        <Label x={72} y={146.5} size={10} tone="strong">
          Webber changed 3 elements: add a focus room
        </Label>
        <Button x={72} y={160} w={50} h={22} label="Show" />
        <Button x={130} y={160} w={50} h={22} label="Undo" variant="primary" />
        <path
          d="M362 141l6 6M368 141l-6 6"
          className="stroke-slate-400"
          strokeWidth={1.2}
          strokeLinecap="round"
        />
      </Card>
    </Scene>
  );
}
