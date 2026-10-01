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

/** An action panel: a row per action, each with its round check, name and
 *  assignee, the header's open count, and the dashed Add Action bar. */
export function ActionPanelCard() {
  const x = 100;
  const y = 10;
  const w = 220;
  const rows = [
    { name: 'Confirm the retry budget', who: 'Sam', done: false },
    { name: 'Write the runbook', who: 'Priya', done: true },
    { name: 'Load test the queue', who: 'You', done: false },
  ];
  return (
    <Scene w={420} h={226}>
      <CollabCard x={x} y={y} w={w} h={204} title="Actions" aside="2 OPEN">
        {rows.map((r, i) => {
          const ry = y + 38 + i * 42;
          return (
            <g key={r.name}>
              <rect x={x + 10} y={ry} width={w - 20} height={36} rx={9} className="fill-slate-50" />
              <circle
                cx={x + 26}
                cy={ry + 13}
                r={7}
                className={r.done ? 'fill-emerald-500' : 'fill-white stroke-brand-400'}
                strokeWidth={1.8}
              />
              {r.done ? (
                <Label
                  x={x + 26}
                  y={ry + 13.5}
                  anchor="middle"
                  size={8}
                  weight={700}
                  tone="onAccent"
                >
                  ✓
                </Label>
              ) : null}
              <Label
                x={x + 40}
                y={ry + 13}
                size={9.5}
                weight={600}
                tone={r.done ? 'muted' : 'strong'}
              >
                {r.name}
              </Label>
              <Avatar
                cx={x + 45}
                cy={ry + 27}
                r={5}
                initial={r.who[0]!}
                colour={r.done ? 'emerald' : 'brand'}
              />
              <Label x={x + 54} y={ry + 27.5} size={8} tone="muted">
                {r.who}
              </Label>
            </g>
          );
        })}
        <rect
          x={x + 10}
          y={y + 168}
          width={w - 20}
          height={24}
          rx={8}
          className="fill-brand-50 stroke-brand-300"
          strokeWidth={1.2}
          strokeDasharray="4 3"
        />
        <Label x={x + w / 2} y={y + 180} anchor="middle" size={9} weight={600} tone="accent">
          + Add Action
        </Label>
      </CollabCard>
    </Scene>
  );
}
