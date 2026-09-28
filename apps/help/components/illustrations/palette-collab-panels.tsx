// The Comment and Action panels as the help centre draws them, in their
// modern look (docs/specs/012-collaboration/comment-pin.md "The look", docs/specs/012-collaboration/action-panel.md "The card"):
// a conversation of bubbles over the composer, and an action led by its name
// with a status chip, the assignee row and Mark Complete.

import { Scene, Label, Avatar, Shape, Arrow } from './primitives';
import { CollabCard } from './palette-collaborate';

/** A comment panel beside the element it is about, joined by an ordinary
 *  arrow, its thread as chat bubbles (yours on the right). */
export function CommentPanelCard() {
  const x = 190;
  const y = 12;
  return (
    <Scene w={420} h={222}>
      <Shape x={22} y={86} w={104} h={54} kind="rect" label="Auth service" />
      <Arrow from={[126, 113]} to={[188, 113]} />
      <CollabCard x={x} y={y} w={210} h={198} title="Comments" aside="3 COMMENTS">
        <Avatar cx={x + 22} cy={y + 50} r={9} initial="R" colour="emerald" />
        <rect x={x + 36} y={y + 42} width={130} height={20} rx={9} className="fill-slate-100" />
        <Label x={x + 44} y={y + 53} size={9} tone="body">
          Is this call async?
        </Label>
        <Avatar cx={x + 188} cy={y + 80} r={9} initial="Y" colour="brand" />
        <rect x={x + 56} y={y + 72} width={118} height={20} rx={9} className="fill-brand-100" />
        <Label x={x + 64} y={y + 83} size={9} tone="body">
          Yes, via the queue.
        </Label>
        <Avatar cx={x + 22} cy={y + 110} r={9} initial="P" colour="violet" />
        <rect x={x + 36} y={y + 102} width={104} height={20} rx={9} className="fill-slate-100" />
        <Label x={x + 44} y={y + 113} size={9} tone="body">
          Add a DLQ too?
        </Label>
        <rect
          x={x + 12}
          y={y + 136}
          width={186}
          height={48}
          rx={14}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.2}
        />
        <Label x={x + 22} y={y + 150} size={9} tone="muted">
          Reply…
        </Label>
        <circle cx={x + 184} cy={y + 149} r={8} className="fill-brand-500" />
        <rect x={x + 18} y={y + 163} width={52} height={14} rx={7} className="fill-brand-100" />
        <Label x={x + 44} y={y + 170} anchor="middle" size={8} weight={600} tone="accent">
          ✓ Resolve
        </Label>
      </CollabCard>
    </Scene>
  );
}

/** An action panel: the action's name with its Open chip, the description,
 *  who it is for, and the one loud act, Mark Complete. */
export function ActionPanelCard() {
  const x = 100;
  const y = 12;
  const w = 220;
  return (
    <Scene w={420} h={222}>
      <CollabCard x={x} y={y} w={w} h={198} title="Confirm the retry budget">
        <rect x={x + w - 52} y={y + 10} width={40} height={14} rx={7} className="fill-brand-100" />
        <Label x={x + w - 32} y={y + 17} anchor="middle" size={8} weight={600} tone="accent">
          Open
        </Label>
        <Label x={x + 14} y={y + 48} size={9} tone="muted">
          Check p99 latency with the payments
        </Label>
        <Label x={x + 14} y={y + 61} size={9} tone="muted">
          team before we ship.
        </Label>
        <rect x={x + 12} y={y + 96} width={w - 24} height={38} rx={11} className="fill-slate-100" />
        <Avatar cx={x + 32} cy={y + 115} r={12} initial="S" colour="brand" />
        <Label x={x + 52} y={y + 111} size={9.5} weight={600} tone="strong">
          Assigned to Sam
        </Label>
        <Label x={x + 52} y={y + 124} size={8} tone="muted">
          from Priya · 2 hours ago
        </Label>
        <rect
          x={x + 12}
          y={y + 146}
          width={w - 60}
          height={32}
          rx={11}
          className="fill-brand-500"
        />
        <Label
          x={x + 12 + (w - 60) / 2}
          y={y + 162}
          anchor="middle"
          size={10}
          weight={600}
          tone="onAccent"
        >
          ✓ Mark Complete
        </Label>
        <circle cx={x + w - 28} cy={y + 162} r={16} className="fill-slate-100" />
        <Label x={x + w - 28} y={y + 163} anchor="middle" size={11} tone="body">
          ✎
        </Label>
      </CollabCard>
    </Scene>
  );
}
