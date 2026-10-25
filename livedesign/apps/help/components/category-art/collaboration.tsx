import { Avatar, Button, Cursor, Label } from '@liveworkspace/help-site/art/primitives';
import { Card, Stage } from '@liveworkspace/help-site/art/parts';

// Collaboration: two people on one logo at once. Sam's live selection round the mark, Maya's cursor on the
// wordmark, a comment pinned to the mark and its thread, and the presence avatars beside Share.
export function CollaborationArt() {
  return (
    <Stage>
      {/* The logo artboard. */}
      <Label x={24} y={22} size={8.5} weight={600} tone="muted">
        1024 x 1024 · Logo
      </Label>
      <Card x={24} y={30} w={180} h={180} r={4}>
        <circle
          cx={114}
          cy={104}
          r={56}
          className="fill-none stroke-sky-300"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <path
          d="M114 30 V210 M24 104 H204"
          className="fill-none stroke-sky-200"
          strokeWidth={0.8}
        />
        <path d="M114 66 L152 134 H76 Z" className="fill-brand-500" />
        <circle cx={114} cy={108} r={13} className="fill-white help-art-as-drawn" />
        <Label x={114} y={182} anchor="middle" size={18} weight={800} tone="strong">
          PEAK
        </Label>
      </Card>

      {/* Sam's live selection round the mark. */}
      <rect
        x={70}
        y={60}
        width={88}
        height={80}
        rx={3}
        className="fill-none stroke-emerald-500"
        strokeWidth={2}
      />
      <rect
        x={70}
        y={46}
        width={34}
        height={14}
        rx={4}
        className="fill-emerald-500 dark:fill-emerald-700"
      />
      <Label x={87} y={53.5} anchor="middle" size={8.5} weight={700} tone="onAccent">
        Sam
      </Label>
      <Cursor x={150} y={134} colour="emerald" />

      {/* Maya on the wordmark. */}
      <Cursor x={146} y={180} name="Maya" colour="violet" />

      {/* A comment pinned to the mark. */}
      <path
        d="M160 70 a10 10 0 1 1 6 9 l-6 3 Z"
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
      <Card x={232} y={64} w={156} h={96} r={10}>
        <Avatar cx={249} cy={81} r={9} initial="M" colour="violet" />
        <Label x={264} y={81} size={9.5} weight={700} tone="strong">
          Maya
        </Label>
        <Label x={294} y={81} size={8.5} tone="muted">
          just now
        </Label>
        <Label x={243} y={101} size={9} tone="body">
          Could the peak sit a
        </Label>
        <Label x={243} y={114} size={9} tone="body">
          little higher?
        </Label>
        <line x1={242} y1={126} x2={378} y2={126} className="stroke-slate-100" strokeWidth={1} />
        <Avatar cx={249} cy={142} r={7} initial="S" colour="emerald" />
        <Label x={261} y={142.5} size={8.5} tone="body">
          Moving it now
        </Label>
        <Label x={378} y={142.5} anchor="end" size={8.5} weight={600} tone="accent">
          Reply
        </Label>
      </Card>
    </Stage>
  );
}
