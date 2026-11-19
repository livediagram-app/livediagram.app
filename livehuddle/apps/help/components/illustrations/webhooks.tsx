// A Space's Webhooks dialog (liveworkspace/docs/specs/004-index/webhooks.md "Managing them",
// packages/settings-ui/src/webhooks): one Slack webhook with what it sends as small labels, Send Test and Pause,
// its Recent Deliveries, and Add Webhook pinned at the foot. Every label is the dialog's own, in livehuddle's words
// (a Space's events are "Space Renamed" and the rest). Composed from the shared primitives.

import { Button, Dialog, Label } from '@liveworkspace/help-site/art/primitives';

/** One of a webhook's event labels (its Sends), a small grey chip. */
function Chip({ x, y, text }: { x: number; y: number; text: string }) {
  const w = text.length * 5.4 + 14;
  return (
    <g>
      <rect x={x} y={y} width={w} height={16} rx={4} className="fill-slate-100" />
      <Label x={x + 7} y={y + 8.5} size={9} weight={500} tone="body">
        {text}
      </Label>
    </g>
  );
}

/** The Webhooks dialog for a Space, with one webhook posting to Slack. */
export function WebhooksDialog() {
  const x = 30;
  const y = 14;
  const w = 360;
  return (
    <Dialog x={x} y={y} w={w} h={222} title="Webhooks for “Team Space”" sceneW={420} sceneH={250}>
      {/* The webhook's card. */}
      <rect
        x={x + 14}
        y={y + 48}
        width={w - 28}
        height={128}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <rect x={x + 26} y={y + 60} width={18} height={18} rx={4} className="fill-violet-500" />
      <Label x={x + 52} y={y + 65} size={11} weight={700} tone="strong">
        Standup channel
      </Label>
      <Label x={x + 52} y={y + 79} size={9} tone="muted">
        Slack · Added by you
      </Label>
      <rect x={x + w - 76} y={y + 60} width={48} height={16} rx={8} className="fill-emerald-100" />
      <Label
        x={x + w - 52}
        y={y + 68.5}
        size={9}
        weight={600}
        anchor="middle"
        className="fill-emerald-700"
      >
        Active
      </Label>

      <Label x={x + 26} y={y + 100} size={8} weight={700} tone="muted">
        SENDS
      </Label>
      <Label x={x + w - 28} y={y + 100} size={9} weight={600} tone="accent" anchor="end">
        Edit Events
      </Label>
      <Chip x={x + 26} y={y + 108} text="Space Renamed" />
      <Chip x={x + 118} y={y + 108} text="Share Link Made" />
      <Chip x={x + 218} y={y + 108} text="By anyone" />

      <Button x={x + 26} y={y + 136} w={78} h={24} label="Send Test" />
      {/* Pause Webhook and Delete Webhook, icon buttons with tooltips. */}
      <Button x={x + 110} y={y + 136} w={24} h={24} />
      <path
        d={`M${x + 119} ${y + 143}v10M${x + 125} ${y + 143}v10`}
        className="stroke-slate-600"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Button x={x + 140} y={y + 136} w={24} h={24} />
      <path
        d={`M${x + 146} ${y + 144}h12M${x + 148} ${y + 144}l1 9h6l1 -9M${x + 150} ${y + 144}v-2h4v2`}
        className="stroke-slate-600"
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Label x={x + w - 28} y={y + 148} size={9} weight={600} tone="body" anchor="end">
        Recent Deliveries ›
      </Label>

      {/* Add Webhook, pinned at the dialog's foot. */}
      <line
        x1={x}
        y1={y + 186}
        x2={x + w}
        y2={y + 186}
        className="stroke-slate-200"
        strokeWidth={1.5}
      />
      <Button x={x + w - 124} y={y + 194} w={110} h={22} label="Add Webhook" variant="primary" />
    </Dialog>
  );
}
