import { Avatar, Button, Label } from '@liveworkspace/help-site/art/primitives';
import { Card, Stage } from '@liveworkspace/help-site/art/parts';

// The article's paragraphs: each line's width, in the page's text column.
const PARAGRAPHS = [
  { y: 78, lines: [196, 188, 120] },
  { y: 118, lines: [196, 172, 190, 84] },
];

// A collaborator's text caret: a thin bar where they are typing, with their name on a flag above it.
function Caret({
  x,
  y,
  name,
  tone,
}: {
  x: number;
  y: number;
  name: string;
  tone: 'violet' | 'emerald';
}) {
  const fill =
    tone === 'violet'
      ? 'fill-violet-500 dark:fill-violet-700'
      : 'fill-emerald-500 dark:fill-emerald-700';
  const w = name.length * 5.6 + 10;
  return (
    <g>
      <rect x={x} y={y - 4} width={1.6} height={13} className={fill} />
      <rect x={x} y={y - 16} width={w} height={12} rx={3} className={fill} />
      <Label x={x + 5} y={y - 9.5} size={8} weight={700} tone="onAccent">
        {name}
      </Label>
    </g>
  );
}

// Collaboration: two people writing one article at once. Maya's caret mid-sentence, the line Sam has selected, a
// comment pinned to the second paragraph and its thread, and the presence avatars beside Share.
export function CollaborationArt() {
  return (
    <Stage>
      {/* The article page. */}
      <Label x={18} y={18} size={8.5} weight={600} tone="muted">
        A4 · Article
      </Label>
      <Card x={18} y={26} w={226} h={186} r={4}>
        <Label x={34} y={50} size={14} weight={800} tone="strong">
          Launch brief
        </Label>
        <rect x={34} y={60} width={64} height={4} rx={2} className="fill-brand-400" />
        {PARAGRAPHS.map((p) =>
          p.lines.map((w, i) => (
            <rect
              key={`${p.y}-${i}`}
              x={34}
              y={p.y + i * 9}
              width={w}
              height={4}
              rx={2}
              className="fill-slate-200"
            />
          )),
        )}
        {/* Sam's selection over the second paragraph's second line. */}
        <rect x={32} y={124} width={152} height={10} rx={2} className="fill-emerald-500/20" />
        <rect x={34} y={127} width={148} height={4} rx={2} className="fill-emerald-400" />
        <rect x={34} y={166} width={194} height={4} rx={2} className="fill-slate-200" />
        <rect x={34} y={175} width={150} height={4} rx={2} className="fill-slate-200" />
        <rect x={34} y={184} width={170} height={4} rx={2} className="fill-slate-200" />
        <rect x={34} y={193} width={96} height={4} rx={2} className="fill-slate-200" />
      </Card>
      <Caret x={154} y={96} name="Maya" tone="violet" />
      <Caret x={182} y={128} name="Sam" tone="emerald" />

      {/* A comment pinned beside the second paragraph. */}
      <path
        d="M236 118 a9 9 0 1 1 5.5 8 l-5.5 3 Z"
        className="fill-amber-400 stroke-white"
        strokeWidth={1.5}
      />

      {/* Presence and Share. */}
      <Card x={254} y={12} w={134} h={32} r={10}>
        <Avatar cx={274} cy={28} r={10} initial="M" colour="violet" />
        <Avatar cx={290} cy={28} r={10} initial="S" colour="emerald" />
        <Avatar cx={306} cy={28} r={10} initial="Y" colour="brand" />
        <Button x={324} y={18} w={56} h={20} label="Share" variant="primary" />
      </Card>

      {/* The thread. */}
      <Card x={258} y={96} w={130} h={92} r={10}>
        <Avatar cx={275} cy={113} r={9} initial="S" colour="emerald" />
        <Label x={290} y={113} size={9.5} weight={700} tone="strong">
          Sam
        </Label>
        <Label x={314} y={113} size={8.5} tone="muted">
          2 min ago
        </Label>
        <Label x={269} y={133} size={9} tone="body">
          Can we add the Q3
        </Label>
        <Label x={269} y={146} size={9} tone="body">
          numbers here?
        </Label>
        <line x1={268} y1={158} x2={378} y2={158} className="stroke-slate-100" strokeWidth={1} />
        <Avatar cx={275} cy={172} r={7} initial="M" colour="violet" />
        <Label x={287} y={172.5} size={8.5} tone="body">
          On it
        </Label>
        <Label x={378} y={172.5} anchor="end" size={8.5} weight={600} tone="accent">
          Reply
        </Label>
      </Card>
    </Stage>
  );
}
