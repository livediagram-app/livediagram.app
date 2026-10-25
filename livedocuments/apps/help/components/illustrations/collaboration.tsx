// Collaboration-category illustrations (docs/specs/018-help/help-app.md): comments, live presence,
// sharing (links, passwords, expiry, embeds) and teams.
// Composed only from the shared primitives so the house style holds.

import {
  Scene,
  Shape,
  Arrow,
  Cursor,
  Avatar,
  Panel,
  Button,
  Label,
  TextBar,
} from '@liveworkspace/help-site/art/primitives';

// --- Comments ----------------------------------------------------------------

/** An element's comment indicator (top-right, with its count) opening the Comments popover: the
 *  thread, Resolve in the header, and the Add a comment box with its Comment button. */
export function CommentThread() {
  return (
    <Scene w={420} h={240}>
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
        height={196}
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
      {/* Reply */}
      <Avatar cx={190} cy={114} r={10} initial="J" colour="violet" />
      <Label x={206} y={110} size={10} weight={700} tone="strong">
        Jae
      </Label>
      <Label x={232} y={110} size={10} tone="muted">
        just now
      </Label>
      <TextBar x={206} y={122} w={130} />
      {/* Composer */}
      <rect
        x={182}
        y={144}
        width={210}
        height={38}
        rx={7}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <Label x={192} y={157} size={10} tone="muted">
        Add a comment…
      </Label>
      <Button x={322} y={188} w={70} h={24} label="Comment" variant="primary" />
    </Scene>
  );
}

// --- Live presence -----------------------------------------------------------

/** A shared canvas with several live cursors carrying name tags, plus a
 *  presence avatar stack in the corner. */
export function LiveCursors() {
  // A tab pill with the initials of who is on that tab at its right.
  const pill = (x: number, w: number, label: string, on: boolean, people: Person[]) => (
    <g>
      <rect
        x={x}
        y={206}
        width={w}
        height={24}
        rx={7}
        className={on ? 'fill-white stroke-brand-400' : 'fill-slate-100 stroke-slate-200'}
        strokeWidth={1.4}
      />
      <Label x={x + 10} y={219} size={10} weight={on ? 700 : 500} tone={on ? 'accent' : 'body'}>
        {label}
      </Label>
      {people.map((p, i) => (
        <Avatar
          key={p.initial}
          cx={x + w - 12 - (people.length - 1 - i) * 11}
          cy={218}
          r={7}
          initial={p.initial}
          colour={p.colour}
        />
      ))}
    </g>
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
 *  shared tab sits between two nameless "Not shared" pills. */
export function OneTabShare() {
  const pill = (x: number, w: number, label: string, shared: boolean) => (
    <g transform={`translate(${x} 196)`}>
      <rect
        width={w}
        height={24}
        rx={7}
        className={shared ? 'fill-white stroke-brand-400' : 'fill-transparent stroke-slate-400'}
        strokeWidth={1.5}
        strokeDasharray={shared ? undefined : '4 3'}
      />
      <Label
        x={w / 2}
        y={13}
        anchor="middle"
        size={10}
        weight={600}
        tone={shared ? 'strong' : 'muted'}
      >
        {label}
      </Label>
    </g>
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

/** A live document embedded in another page: the canvas with the embed's only chrome (the
 *  Open in livedocuments badge and the tab switcher bottom-left, the zoom dock bottom-right),
 *  beside the iframe snippet the Share dialog copies. */
export function EmbeddedDocument() {
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
      {/* Embedded document frame */}
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
      <Arrow from={[114, 92]} to={[172, 92]} />
      {/* Bottom-left: Open in livedocuments, then the tab switcher. */}
      <rect x={38} y={154} width={128} height={20} rx={10} className="fill-slate-100" />
      <Label x={50} y={165} size={10} weight={600} tone="body">
        Open in livedocuments
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

// --- Teams -------------------------------------------------------------------

type Member = {
  initial: string;
  name: string;
  role: 'Admin' | 'Member';
  colour: 'brand' | 'violet' | 'emerald' | 'amber';
};

function RoleBadge({ x, y, role }: { x: number; y: number; role: 'Admin' | 'Member' }) {
  const admin = role === 'Admin';
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={admin ? 50 : 58}
        height={20}
        rx={6}
        className={admin ? 'fill-brand-100 stroke-brand-300' : 'fill-slate-100 stroke-slate-300'}
        strokeWidth={1.5}
      />
      <Label
        x={x + (admin ? 25 : 29)}
        y={y + 11}
        anchor="middle"
        size={10}
        weight={600}
        tone={admin ? 'accent' : 'body'}
      >
        {role}
      </Label>
    </g>
  );
}

/** A role picker as an Admin sees it on another member's row: the role with a caret. */
function RoleSelect({ x, y, role }: { x: number; y: number; role: 'Admin' | 'Member' }) {
  return (
    <g>
      <Label x={x} y={y + 11} size={10} weight={600} tone="body">
        {role}
      </Label>
      <path
        d={`M${x + role.length * 6.2 + 6} ${y + 8} l3.5 3.5 l3.5 -3.5`}
        className="fill-none stroke-slate-400"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** One member row: avatar, name (with an Invited pill while pending), the email under it, and the
 *  role at the right. */
function MemberRow({
  y,
  left,
  right,
  m,
  email,
  invited = false,
  select = false,
}: {
  y: number;
  left: number;
  right: number;
  m: Member;
  email: string;
  invited?: boolean;
  select?: boolean;
}) {
  return (
    <g>
      <Avatar cx={left + 12} cy={y} r={12} initial={m.initial} colour={m.colour} />
      <Label x={left + 32} y={y - 5} size={11} weight={600} tone="strong">
        {m.name}
      </Label>
      {invited ? (
        <g>
          <rect
            x={left + 38 + m.name.length * 6.6}
            y={y - 13}
            width={42}
            height={15}
            rx={7.5}
            className="fill-amber-100 stroke-amber-200"
            strokeWidth={1}
          />
          <Label
            x={left + 59 + m.name.length * 6.6}
            y={y - 5}
            anchor="middle"
            size={9}
            weight={500}
            className="fill-amber-700"
          >
            Invited
          </Label>
        </g>
      ) : null}
      <Label x={left + 32} y={y + 9} size={9.5} tone="muted">
        {email}
      </Label>
      {select ? (
        <RoleSelect x={right - 58} y={y - 10} role={m.role} />
      ) : (
        <RoleBadge x={right - (m.role === 'Admin' ? 50 : 58)} y={y - 10} role={m.role} />
      )}
    </g>
  );
}

/** A team's card with its member list and Admin / Member role badges, as a Member sees it. */
export function TeamMembers() {
  const members: (Member & { email: string })[] = [
    { initial: 'A', name: 'Aria', role: 'Admin', colour: 'brand', email: 'aria@acme.com' },
    { initial: 'J', name: 'Jae', role: 'Member', colour: 'violet', email: 'jae@acme.com' },
    { initial: 'M', name: 'Mara', role: 'Member', colour: 'emerald', email: 'mara@acme.com' },
  ];
  return (
    <Scene w={420} h={210} bg="plain">
      <Panel x={70} y={16} w={280} h={180}>
        <Label x={86} y={36} size={10} tone="muted">
          Acme · 3 members
        </Label>
        {members.map((m, i) => {
          const ry = 70 + i * 42;
          return (
            <g key={m.name}>
              <MemberRow y={ry} left={84} right={336} m={m} email={m.email} />
              {i < members.length - 1 && (
                <line
                  x1={84}
                  y1={ry + 21}
                  x2={336}
                  y2={ry + 21}
                  className="stroke-slate-100"
                  strokeWidth={1.5}
                />
              )}
            </g>
          );
        })}
      </Panel>
    </Scene>
  );
}

/** A team's shared library: the Team documents breadcrumb with the view toggle and Create, above
 *  the folders and documents of the level you are in. */
export function TeamSharedTree() {
  const rows: { label: string; folder: boolean; meta: string }[] = [
    { label: 'Architecture', folder: true, meta: '4 documents' },
    { label: 'Onboarding', folder: true, meta: '2 documents' },
    { label: 'System overview', folder: false, meta: 'Edited 2h ago' },
    { label: 'Retro notes', folder: false, meta: 'Edited yesterday' },
  ];
  return (
    <Scene w={420} h={230} bg="plain">
      <Panel x={50} y={16} w={320} h={198}>
        <rect x={51} y={17} width={318} height={32} rx={9} className="fill-slate-50" />
        <line x1={51} y1={49} x2={369} y2={49} className="stroke-slate-200" strokeWidth={1} />
        <Label x={66} y={34} size={9.5} weight={700} tone="muted">
          TEAM DOCUMENTS
        </Label>
        {/* View toggle: list and grid. */}
        <rect
          x={256}
          y={24}
          width={40}
          height={18}
          rx={5}
          className="fill-white stroke-slate-200"
          strokeWidth={1}
        />
        <rect x={258} y={26} width={18} height={14} rx={3} className="fill-brand-100" />
        <path
          d="M262 30 h10 M262 33 h10 M262 36 h10"
          className="stroke-brand-600"
          strokeWidth={1}
        />
        <path
          d="M281 29 h4 v4 h-4 Z M287 29 h4 v4 h-4 Z M281 35 h4 v4 h-4 Z M287 35 h4 v4 h-4 Z"
          className="fill-none stroke-slate-400"
          strokeWidth={0.9}
        />
        <Button x={302} y={23} w={56} h={20} label="Create" variant="primary" />
        {rows.map((r, i) => {
          const ry = 72 + i * 36;
          return (
            <g key={r.label}>
              {r.folder ? (
                <path
                  d={`M68 ${ry - 6} h7 l2 3 h8 v10 h-17 Z`}
                  className="fill-brand-200 stroke-brand-400"
                  strokeWidth={1.5}
                />
              ) : (
                <rect
                  x={70}
                  y={ry - 7}
                  width={13}
                  height={16}
                  rx={2}
                  className="fill-white stroke-slate-300"
                  strokeWidth={1.5}
                />
              )}
              <Label x={94} y={ry + 1} size={11} weight={500} tone="strong">
                {r.label}
              </Label>
              <Label x={352} y={ry + 1} anchor="end" size={9.5} tone="muted">
                {r.meta}
              </Label>
              {i < rows.length - 1 && (
                <line
                  x1={64}
                  y1={ry + 18}
                  x2={356}
                  y2={ry + 18}
                  className="stroke-slate-100"
                  strokeWidth={1.2}
                />
              )}
            </g>
          );
        })}
      </Panel>
    </Scene>
  );
}
