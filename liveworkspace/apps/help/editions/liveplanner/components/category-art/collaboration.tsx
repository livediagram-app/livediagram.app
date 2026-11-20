import { Avatar, Button, Cursor, Label } from '@liveworkspace/help-site/art/primitives';
import { Card, Stage } from '@liveworkspace/help-site/art/parts';

// The Sprint Retro's columns (the Team Retro template's Went Well, To Improve and Ideas), their head dots, and the
// dots each card has gathered so far.
const COLUMNS = [
  { x: 20, name: 'Went Well', head: 'fill-emerald-400', votes: [3, 1, 2] },
  { x: 97, name: 'To Improve', head: 'fill-amber-400', votes: [2] },
  { x: 174, name: 'Ideas', head: 'fill-violet-400', votes: [4, 0] },
];

// A retro note: two lines of writing and its dots in the corner.
function Note({ x, y, votes }: { x: number; y: number; votes: number }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={62}
        height={34}
        rx={5}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <rect x={x + 7} y={y + 8} width={44} height={4} rx={2} className="fill-slate-300" />
      <rect x={x + 7} y={y + 16} width={30} height={4} rx={2} className="fill-slate-200" />
      {Array.from({ length: votes }, (_, i) => (
        <circle key={i} cx={x + 10 + i * 7} cy={y + 27} r={2.4} className="fill-brand-500" />
      ))}
    </g>
  );
}

// Collaboration: a live retro on one plan. Everyone's cursors on the Sprint Retro board, the card Sam is carrying to
// Ideas wearing Sam's colour and name, the dots a vote has gathered, Maya's comment, the Timer and Vote buttons the
// bottom-right corner shows while the session runs, and the presence avatars beside Share.
export function CollaborationArt() {
  return (
    <Stage>
      {/* The board. */}
      <Card x={12} y={14} w={236} h={194} r={12}>
        <Label x={24} y={31} size={11} weight={700} tone="strong">
          Sprint Retro
        </Label>
        <Label x={236} y={31} anchor="end" size={8.5} weight={600} tone="muted">
          9 dots cast
        </Label>
        {COLUMNS.map((col) => (
          <g key={col.name}>
            <rect x={col.x} y={42} width={70} height={158} rx={7} className="fill-slate-50" />
            <circle cx={col.x + 9} cy={53} r={3} className={col.head} />
            <Label x={col.x + 16} y={53.5} size={8.5} weight={700} tone="body">
              {col.name}
            </Label>
            {col.votes.map((v, i) => (
              <Note key={i} x={col.x + 4} y={64 + i * 42} votes={v} />
            ))}
          </g>
        ))}

        {/* A comment pinned to a Went Well card. */}
        <path
          d="M74 66 a8 8 0 1 1 5 7 l-5 2.5 Z"
          className="fill-amber-400 stroke-white"
          strokeWidth={1.5}
        />
      </Card>

      {/* Sam carrying a To Improve card over to Ideas. */}
      <g transform="rotate(-6 150 128)">
        <rect
          x={119}
          y={111}
          width={62}
          height={34}
          rx={5}
          className="fill-white stroke-emerald-500"
          strokeWidth={2}
        />
        <rect x={126} y={119} width={44} height={4} rx={2} className="fill-slate-300" />
        <rect x={126} y={127} width={26} height={4} rx={2} className="fill-slate-200" />
        <circle cx={129} cy={138} r={2.4} className="fill-brand-500" />
        <rect
          x={119}
          y={97}
          width={30}
          height={13}
          rx={4}
          className="fill-emerald-500 dark:fill-emerald-700"
        />
        <Label x={134} y={104} anchor="middle" size={8} weight={700} tone="onAccent">
          Sam
        </Label>
      </g>
      <Cursor x={170} y={136} colour="emerald" />

      {/* Presence and Share. */}
      <Card x={254} y={12} w={134} h={32} r={10}>
        <Avatar cx={274} cy={28} r={10} initial="M" colour="violet" />
        <Avatar cx={290} cy={28} r={10} initial="S" colour="emerald" />
        <Avatar cx={306} cy={28} r={10} initial="Y" colour="brand" />
        <Button x={324} y={18} w={56} h={20} label="Share" variant="primary" />
      </Card>

      {/* Maya's comment. */}
      <Card x={258} y={58} w={130} h={74} r={10}>
        <Avatar cx={275} cy={75} r={9} initial="M" colour="violet" />
        <Label x={290} y={75} size={9.5} weight={700} tone="strong">
          Maya
        </Label>
        <Label x={321} y={75} size={8.5} tone="muted">
          just now
        </Label>
        <Label x={269} y={95} size={9} tone="body">
          Let&apos;s keep doing
        </Label>
        <Label x={269} y={108} size={9} tone="body">
          this next sprint
        </Label>
        <Label x={269} y={122} size={8.5} weight={600} tone="accent">
          Reply
        </Label>
      </Card>

      {/* The session tools in the bottom-right corner: the Timer's clock and the lit Vote button. */}
      <Card x={258} y={150} w={130} h={40} r={10}>
        <circle
          cx={276}
          cy={170}
          r={6.5}
          className="fill-none stroke-slate-500"
          strokeWidth={1.5}
        />
        <path
          d="M276 166 v4 l2.6 2"
          className="fill-none stroke-slate-500"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <Label x={287} y={170.5} size={10} weight={700} tone="strong">
          4:52
        </Label>
        <rect x={318} y={159} width={62} height={22} rx={7} className="fill-brand-500" />
        <circle cx={329} cy={170} r={3} className="fill-white help-art-as-drawn" />
        <Label x={354} y={170.5} anchor="middle" size={9} weight={700} tone="onAccent">
          3 left
        </Label>
      </Card>

      <Cursor x={188} y={154} name="Maya" colour="violet" />
      <Cursor x={66} y={168} name="You" colour="brand" />
    </Stage>
  );
}
