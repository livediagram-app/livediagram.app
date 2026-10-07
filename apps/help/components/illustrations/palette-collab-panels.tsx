// The Comment and Action panels as the help centre draws them, in their
// modern look (docs/specs/012-collaboration/comment-pin.md "The look", docs/specs/012-collaboration/action-panel.md "The card"):
// a conversation of bubbles over the composer, and a list of actions, each a
// round check, a name and an assignee, over the dashed Add Action bar.

import { Scene, Label, Avatar, Shape, Arrow } from './primitives';
import { CollabCard } from './palette-collaborate';

/** A comment panel beside the element it is about, joined by an ordinary
 *  arrow: its thread as chat bubbles (yours on the right), Resolve in the
 *  header's corner and the composer at the foot. */
export function CommentPanelCard() {
  const x = 190;
  const y = 12;
  return (
    <Scene w={420} h={222}>
      <Shape x={22} y={86} w={104} h={54} kind="rect" label="Auth service" />
      <Arrow from={[126, 113]} to={[188, 113]} />
      <CollabCard x={x} y={y} w={210} h={198} title="Comments">
        {/* Resolve: the thread's other act, top right. No count there. */}
        <rect x={x + 136} y={y + 10} width={62} height={18} rx={9} className="fill-brand-50" />
        <Label x={x + 167} y={y + 19.5} anchor="middle" size={10} weight={600} tone="accent">
          ✓ Resolve
        </Label>
        <Avatar cx={x + 22} cy={y + 50} r={9} initial="R" colour="emerald" />
        <rect x={x + 36} y={y + 40} width={136} height={22} rx={9} className="fill-slate-100" />
        <Label x={x + 44} y={y + 52} size={10} tone="body">
          Is this call async?
        </Label>
        <Avatar cx={x + 188} cy={y + 82} r={9} initial="Y" colour="brand" />
        <rect x={x + 50} y={y + 72} width={124} height={22} rx={9} className="fill-brand-100" />
        <Label x={x + 58} y={y + 84} size={10} tone="body">
          Yes, via the queue.
        </Label>
        <Avatar cx={x + 22} cy={y + 114} r={9} initial="P" colour="violet" />
        <rect x={x + 36} y={y + 104} width={112} height={22} rx={9} className="fill-slate-100" />
        <Label x={x + 44} y={y + 116} size={10} tone="body">
          Add a DLQ too?
        </Label>
        {/* The composer: Enter sends. */}
        <rect
          x={x + 12}
          y={y + 150}
          width={186}
          height={34}
          rx={14}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.2}
        />
        <Label x={x + 24} y={y + 168} size={10} tone="muted">
          Reply…
        </Label>
        <circle cx={x + 182} cy={y + 167} r={9} className="fill-brand-500" />
        <path
          d={`M${x + 182} ${y + 171}v-7M${x + 179} ${y + 167}l3-3 3 3`}
          className="fill-none stroke-white help-art-as-drawn"
          strokeWidth={1.3}
        />
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
                size={10.5}
                weight={600}
                tone={r.done ? 'muted' : 'strong'}
              >
                {r.name}
              </Label>
              {r.done ? (
                <line
                  x1={x + 39}
                  y1={ry + 13}
                  x2={x + 41 + r.name.length * 5.6}
                  y2={ry + 13}
                  className="stroke-slate-400"
                  strokeWidth={1.2}
                />
              ) : null}
              <Avatar
                cx={x + 45}
                cy={ry + 27}
                r={5}
                initial={r.who[0]!}
                colour={r.done ? 'emerald' : 'brand'}
              />
              <Label x={x + 54} y={ry + 27.5} size={10} tone="muted">
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
        <Label x={x + w / 2} y={y + 180} anchor="middle" size={10} weight={600} tone="accent">
          + Add Action
        </Label>
      </CollabCard>
    </Scene>
  );
}
