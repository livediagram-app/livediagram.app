// Collaboration-category illustrations (docs/specs/018-help/help-app.md): comments, live presence,
// sharing (links, passwords, expiry, embeds), teams, and session tools.
// Composed only from the shared primitives so the house style holds.
import { Scene, Shape, Arrow, Cursor, Avatar, Button, Label, BarTab, TextBar } from '../primitives';
import { Chip } from '../parts';

export { TeamMembers, TeamSharedTree } from './collaboration-teams';
export { DotVoting, SessionTools, TimerControl } from './collaboration-sessions';

// --- Comments ----------------------------------------------------------------

/** An element's comment indicator (top-right, with its count) opening the Comments popover: the
 *  thread, Resolve in the header, and the Add a comment box with its Comment button. */
export function CommentThread() {
  return (
    <Scene w={420} h={258}>
      <Shape x={30} y={92} w={110} h={56} kind="rect" label="Checkout" />
      {/* The comment indicator near the element's top-right, with its count. */}
      <g transform="translate(116 98)">
        <path
          d="M0 1.5 a1.5 1.5 0 0 1 1.5 -1.5 h9 a1.5 1.5 0 0 1 1.5 1.5 v6 a1.5 1.5 0 0 1 -1.5 1.5 h-5 l-3 2.5 v-2.5 h-1 a1.5 1.5 0 0 1 -1.5 -1.5 Z"
          className="fill-none stroke-brand-500"
          strokeWidth={1.3}
        />
      </g>
      <Label x={132} y={104} size={10} weight={700} tone="accent">
        2
      </Label>
      {/* The thread popover */}
      <rect
        x={170}
        y={24}
        width={234}
        height={214}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <Label x={184} y={44} size={12} weight={700} tone="strong">
        Comments (2)
      </Label>
      <Label x={360} y={44} anchor="end" size={10} weight={600} tone="body">
        Resolve
      </Label>
      <path d="M380 39 l9 9 M389 39 l-9 9" className="stroke-slate-400" strokeWidth={1.5} />
      <line x1={170} y1={58} x2={404} y2={58} className="stroke-slate-200" strokeWidth={1.5} />
      {/* First message */}
      <Avatar cx={190} cy={78} r={10} initial="A" colour="brand" />
      <Label x={206} y={74} size={10} weight={700} tone="strong">
        Aria
      </Label>
      <Label x={238} y={74} size={10} tone="muted">
        5m ago
      </Label>
      <TextBar x={206} y={86} w={160} />
      {/* Reactions: the chips under the comment, yours highlighted (CommentReactions) */}
      <Chip x={206} y={94} w={34} h={16} size={9.5} label="👍 2" tone="brand" />
      <Chip x={244} y={94} w={34} h={16} size={9.5} label="🎉 1" tone="slate" />
      <Chip x={282} y={94} w={34} h={16} size={9.5} label="👀 1" tone="slate" />
      {/* Reply */}
      <Avatar cx={190} cy={134} r={10} initial="J" colour="violet" />
      <Label x={206} y={130} size={10} weight={700} tone="strong">
        Jae
      </Label>
      <Label x={232} y={130} size={10} tone="muted">
        just now
      </Label>
      <TextBar x={206} y={142} w={130} />
      {/* Composer */}
      <rect
        x={182}
        y={162}
        width={210}
        height={38}
        rx={7}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <Label x={192} y={175} size={10} tone="muted">
        Add a comment…
      </Label>
      <Button x={322} y={206} w={70} h={24} label="Comment" variant="primary" />
    </Scene>
  );
}

// --- Live presence -----------------------------------------------------------

/** A shared canvas with several live cursors carrying name tags, plus a
 *  presence avatar stack in the corner. */
export function LiveCursors() {
  // A tab with the initials of who is on that tab at its right.
  const pill = (x: number, w: number, label: string, on: boolean, people: Person[]) => (
    <BarTab x={x} y={206} w={w} h={32} label={label} active={on} anchor="start">
      {people.map((p, i) => (
        <Avatar
          key={p.initial}
          cx={x + w - 12 - (people.length - 1 - i) * 11}
          cy={223}
          r={7}
          initial={p.initial}
          colour={p.colour}
        />
      ))}
    </BarTab>
  );
  return (
    <Scene w={420} h={246}>
      <Shape x={60} y={48} w={92} h={48} kind="rect" label="Idea" />
      <Shape x={236} y={116} w={92} h={48} kind="circle" label="Review" />
      {/* Live cursors with name tags */}
      <Cursor x={120} y={104} name="Aria" colour="brand" />
      <Cursor x={250} y={60} name="Jae" colour="violet" />
      <Cursor x={170} y={158} name="Mara" colour="emerald" />
      {/* The tab bar: each tab carries the initials of who is on it. */}
      <rect x={0} y={198} width={420} height={40} className="fill-slate-50" />
      <line x1={0} y1={198} x2={420} y2={198} className="stroke-slate-200" strokeWidth={1} />
      {pill(16, 118, 'Overview', true, [
        { initial: 'A', colour: 'brand' },
        { initial: 'J', colour: 'violet' },
        { initial: 'M', colour: 'emerald' },
      ])}
      {pill(142, 96, 'Backlog', false, [{ initial: 'R', colour: 'amber' }])}
      {pill(246, 72, 'Notes', false, [])}
    </Scene>
  );
}

type Person = { initial: string; colour: 'brand' | 'violet' | 'emerald' | 'amber' };

/** An element a teammate has selected: their initials sit on its top-left corner, and the
 *  selection outline in their colour shows it is theirs while they hold it. */
export function PresenceSelection() {
  return (
    <Scene w={420} h={170}>
      <Shape x={70} y={62} w={112} h={56} kind="rect" label="Schema" />
      {/* Selection outline in the collaborator's colour */}
      <rect
        x={66}
        y={58}
        width={120}
        height={64}
        rx={6}
        className="fill-none stroke-violet-500"
        strokeWidth={2}
        strokeDasharray="4 3"
      />
      <Avatar cx={68} cy={60} r={10} initial="J" colour="violet" />
      <Cursor x={196} y={124} name="Jae" colour="violet" />
      <Shape x={262} y={56} w={104} h={48} kind="circle" label="API" />
    </Scene>
  );
}

// --- Sharing ------------------------------------------------------------------

/** A visitor on a one-tab link: their tab's canvas above a tab bar where the
 *  shared tab sits between two nameless "Not shared" tabs. */
export function OneTabShare() {
  const pill = (x: number, w: number, label: string, shared: boolean) => (
    <BarTab x={x} y={202} w={w} h={38} label={label} active={shared} />
  );
  return (
    <Scene w={420} h={240}>
      <Shape x={70} y={60} w={112} h={56} kind="rect" label="Q3: beta" />
      <Shape x={238} y={60} w={112} h={56} kind="rect" label="Q4: launch" />
      <rect x={0} y={184} width={420} height={56} className="fill-slate-100" />
      {pill(40, 104, 'Not shared', false)}
      {pill(158, 104, 'Roadmap', true)}
      {pill(276, 104, 'Not shared', false)}
    </Scene>
  );
}

/** A product's live work embedded in another page: the canvas with the embed's only chrome (the
 *  Open in {product} badge and the tab switcher bottom-left, the zoom dock bottom-right),
 *  beside the iframe snippet the Share dialog copies. */
export function EmbeddedWork({ product }: { product: string }) {
  return (
    <Scene w={420} h={240} bg="plain">
      {/* Host page card */}
      <rect
        x={14}
        y={12}
        width={392}
        height={216}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <TextBar x={30} y={26} w={120} h={8} />
      <TextBar x={30} y={42} w={360} tone="faint" />
      {/* Embedded work frame */}
      <rect
        x={30}
        y={58}
        width={250}
        height={124}
        rx={8}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <Shape x={48} y={74} w={64} h={36} kind="rect" label="Web" />
      <Shape x={176} y={74} w={72} h={36} kind="cylinder" label="DB" />
      <Arrow connector from={[114, 92]} to={[172, 92]} />
      {/* Bottom-left: Open in the product, then the tab switcher. */}
      <rect x={38} y={154} width={128} height={20} rx={10} className="fill-slate-100" />
      <Label x={50} y={165} size={10} weight={600} tone="body">
        {`Open in ${product}`}
      </Label>
      <rect x={172} y={154} width={66} height={20} rx={10} className="fill-slate-100" />
      <Label x={182} y={165} size={10} weight={600} tone="body">
        Overview
      </Label>
      {/* Bottom-right: the zoom dock. */}
      <rect x={244} y={150} width={28} height={26} rx={7} className="fill-slate-100" />
      <Label x={258} y={164} anchor="middle" size={12} weight={700} tone="body">
        +
      </Label>
      {/* The iframe snippet, dark in both appearances */}
      <g className="help-art-as-drawn">
        <rect x={290} y={58} width={100} height={124} rx={8} className="fill-slate-800" />
        <Label x={300} y={76} size={10} weight={600} className="fill-emerald-400">
          &lt;iframe
        </Label>
        <Label x={306} y={94} size={10} className="fill-slate-300">
          src=&quot;…/embed&quot;
        </Label>
        <Label x={306} y={112} size={10} className="fill-slate-300">
          width=&quot;800&quot;
        </Label>
        <Label x={306} y={130} size={10} className="fill-slate-300">
          height=&quot;500&quot;
        </Label>
        <Label x={300} y={148} size={10} weight={600} className="fill-emerald-400">
          &gt;&lt;/iframe&gt;
        </Label>
      </g>
      <TextBar x={30} y={196} w={360} tone="faint" />
      <TextBar x={30} y={212} w={240} tone="faint" />
    </Scene>
  );
}
