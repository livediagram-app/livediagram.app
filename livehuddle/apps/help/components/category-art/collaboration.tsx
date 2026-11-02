import { Arrow, Avatar, Cursor, Label, Shape } from '@liveworkspace/help-site/art/primitives';
import { Button } from '@liveworkspace/help-site/art/primitives';
import { Card, Stage } from '@liveworkspace/help-site/art/parts';

// Collaboration: three people on one canvas at once. Their cursors, Sam's live selection, a comment thread
// pinned to a shape, and the presence avatars beside Share.
export function CollaborationArt() {
  return (
    <Stage>
      {/* Presence and Share. */}
      <Card x={254} y={12} w={134} h={32} r={10}>
        <Avatar cx={274} cy={28} r={10} initial="M" colour="violet" />
        <Avatar cx={290} cy={28} r={10} initial="S" colour="emerald" />
        <Avatar cx={306} cy={28} r={10} initial="Y" colour="brand" />
        <Button x={324} y={18} w={56} h={20} label="Share" variant="primary" />
      </Card>

      <Arrow from={[124, 86]} to={[170, 112]} kind="elbow" />
      <Shape x={36} y={66} w={88} h={40} label="Research" />
      <Shape x={172} y={94} w={96} h={40} accent label="Prototype" />
      <Shape
        x={60}
        y={146}
        w={84}
        h={36}
        kind="stadium"
        label="Interviews"
        fill="fill-amber-100"
        stroke="stroke-amber-400"
      />
      <Arrow from={[80, 106]} to={[92, 144]} tone="muted" />

      {/* Sam's live selection on Research. */}
      <rect
        x={31}
        y={61}
        width={98}
        height={50}
        rx={9}
        className="fill-none stroke-emerald-500"
        strokeWidth={2}
      />
      <rect
        x={31}
        y={47}
        width={34}
        height={14}
        rx={4}
        className="fill-emerald-500 dark:fill-emerald-700"
      />
      <Label x={48} y={54.5} anchor="middle" size={8.5} weight={700} tone="onAccent">
        Sam
      </Label>

      {/* A comment pinned to Prototype, and its thread. */}
      <path
        d="M262 84 a10 10 0 1 1 6 9 l-6 3 Z"
        className="fill-amber-400 stroke-white"
        strokeWidth={1.5}
      />
      <Card x={212} y={146} w={170} h={60} r={10}>
        <Avatar cx={230} cy={163} r={9} initial="M" colour="violet" />
        <Label x={245} y={163} size={9.5} weight={700} tone="strong">
          Maya
        </Label>
        <Label x={276} y={163} size={8.5} tone="muted">
          just now
        </Label>
        <Label x={224} y={182} size={9.5} tone="body">
          Can we test this on Friday?
        </Label>
        <Label x={224} y={196} size={8.5} weight={600} tone="accent">
          Reply
        </Label>
      </Card>

      <Cursor x={148} y={60} name="Maya" colour="violet" />
      <Cursor x={112} y={92} colour="emerald" />
      <Cursor x={240} y={126} name="You" colour="brand" />
    </Stage>
  );
}
