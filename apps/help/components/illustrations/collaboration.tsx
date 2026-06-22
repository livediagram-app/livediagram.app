// Collaboration-category illustrations (spec/55): comments, live presence,
// sharing (links, passwords, expiry, embeds), teams, and session tools.
// Composed only from the shared primitives so the house style holds.

import { Scene, Shape, Cursor, Avatar, Panel, Dialog, Button, Label, TextBar } from './primitives';

// --- Comments ----------------------------------------------------------------

/** A comment pin on the canvas opening a threaded popover with avatars and a
 *  resolve check. */
export function CommentThread() {
  return (
    <Scene w={420} h={240}>
      <Shape x={36} y={92} w={96} h={52} kind="rect" label="Checkout" />
      {/* Comment pin anchored to the shape's corner */}
      <g transform="translate(126 84)">
        <path
          d="M0 14 a14 14 0 1 1 0.1 0 L0 28 Z"
          className="fill-brand-500 stroke-white"
          strokeWidth={2}
        />
        <Label x={0} y={13} anchor="middle" size={14} weight={700} tone="onAccent">
          1
        </Label>
      </g>
      {/* Threaded popover */}
      <Panel x={176} y={36} w={224} h={168} title="COMMENT">
        {/* First message */}
        <Avatar cx={194} cy={70} r={11} initial="A" colour="brand" />
        <Label x={212} y={64} size={10} weight={700} tone="strong">
          Aria
        </Label>
        <TextBar x={212} y={78} w={160} />
        <TextBar x={212} y={88} w={120} tone="faint" />
        {/* Reply */}
        <Avatar cx={194} cy={120} r={11} initial="J" colour="violet" />
        <Label x={212} y={114} size={10} weight={700} tone="strong">
          Jae
        </Label>
        <TextBar x={212} y={128} w={140} />
        {/* Resolve check */}
        <circle cx={356} cy={50} r={10} className="fill-emerald-500" />
        <path
          d="M351 50 l4 4 l6 -8"
          fill="none"
          className="stroke-white"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Label x={336} y={50} anchor="end" size={9} weight={600} tone="muted">
          Resolve
        </Label>
        <Button x={192} y={170} w={200} h={22} label="Reply" variant="default" />
      </Panel>
    </Scene>
  );
}

// --- Live presence -----------------------------------------------------------

/** A shared canvas with several live cursors carrying name tags, plus a
 *  presence avatar stack in the corner. */
export function LiveCursors() {
  return (
    <Scene w={420} h={240}>
      <Shape x={60} y={64} w={92} h={48} kind="rect" label="Idea" />
      <Shape x={236} y={150} w={92} h={48} kind="circle" label="Review" />
      {/* Presence avatar stack, top-right */}
      <g>
        <Avatar cx={336} cy={28} r={13} initial="A" colour="brand" />
        <Avatar cx={358} cy={28} r={13} initial="J" colour="violet" />
        <Avatar cx={380} cy={28} r={13} initial="M" colour="emerald" />
      </g>
      {/* Live cursors with name tags */}
      <Cursor x={120} y={120} name="Aria" colour="brand" />
      <Cursor x={250} y={86} name="Jae" colour="violet" />
      <Cursor x={184} y={184} name="Mara" colour="emerald" />
    </Scene>
  );
}

/** A selected element badged with a teammate's initials and a "Locked to" note,
 *  showing how presence gently locks what someone is editing. */
export function PresenceSelection() {
  return (
    <Scene w={420} h={210}>
      <Shape x={70} y={62} w={104} h={56} kind="rect" label="Schema" />
      {/* Selection outline in the collaborator's colour */}
      <rect
        x={66}
        y={58}
        width={112}
        height={64}
        rx={6}
        className="fill-none stroke-violet-500"
        strokeWidth={2}
        strokeDasharray="4 3"
      />
      <Avatar cx={174} cy={58} r={11} initial="J" colour="violet" />
      <g transform="translate(196 78)">
        <rect width={132} height={22} rx={6} className="fill-violet-500" />
        <Label x={11} y={12} tone="onAccent" size={10} weight={600}>
          Locked to Jae
        </Label>
      </g>
      <Shape x={232} y={140} w={104} h={48} kind="circle" label="API" />
    </Scene>
  );
}

// --- Sharing (shared dialog with variants) -----------------------------------

type ShareVariant = 'links' | 'password' | 'expiry';

/** The Share dialog. One scene drawn three ways: the base link list, a password
 *  row, or an expiry dropdown, so the recurring surface is never redrawn. */
function ShareDialog({ variant }: { variant: ShareVariant }) {
  const dx = 56;
  const dy = 18;
  const dw = 308;
  const dh = variant === 'links' ? 204 : 212;
  // The expiry variant floats an open dropdown below the dialog, so the scene
  // needs extra height for it to land inside the viewBox.
  const sceneH = variant === 'expiry' ? 284 : 240;
  return (
    <Scene w={420} h={sceneH} bg="plain">
      <Dialog x={dx} y={dy} w={dw} h={dh} title="Share" sceneW={420} sceneH={sceneH} scrim={false}>
        {/* Edit link row */}
        <ShareLinkRow x={dx + 16} y={dy + 50} role="Edit" />
        {/* View link row */}
        <ShareLinkRow x={dx + 16} y={dy + 92} role="View" />

        {variant === 'password' && (
          <g>
            <line
              x1={dx}
              y1={dy + 132}
              x2={dx + dw}
              y2={dy + 132}
              className="stroke-slate-200"
              strokeWidth={1.5}
            />
            <Label x={dx + 16} y={dy + 150} size={8} weight={700} tone="muted">
              PASSWORD
            </Label>
            <rect
              x={dx + 16}
              y={dy + 160}
              width={dw - 110}
              height={26}
              rx={7}
              className="fill-white stroke-slate-300"
              strokeWidth={1.5}
            />
            <Label x={dx + 28} y={dy + 174} size={11} tone="body">
              spring-otter-42
            </Label>
            <Button x={dx + dw - 80} y={dy + 160} w={64} h={26} label="Save" variant="primary" />
          </g>
        )}

        {variant === 'expiry' && (
          <g>
            <line
              x1={dx}
              y1={dy + 132}
              x2={dx + dw}
              y2={dy + 132}
              className="stroke-slate-200"
              strokeWidth={1.5}
            />
            <Label x={dx + 16} y={dy + 150} size={8} weight={700} tone="muted">
              LINK EXPIRES
            </Label>
            {/* Dropdown */}
            <rect
              x={dx + 16}
              y={dy + 160}
              width={120}
              height={26}
              rx={7}
              className="fill-white stroke-brand-500"
              strokeWidth={2}
            />
            <Label x={dx + 28} y={dy + 174} size={11} weight={600} tone="body">
              1 Month
            </Label>
            <path
              d={`M${dx + 122} ${dy + 170} l5 5 l5 -5`}
              fill="none"
              className="stroke-slate-400"
              strokeWidth={2}
              strokeLinecap="round"
            />
            {/* Open option list */}
            <rect
              x={dx + 16}
              y={dy + 188}
              width={120}
              height={62}
              rx={8}
              className="fill-white stroke-slate-200"
              strokeWidth={1.5}
            />
            {['1 Week', '1 Month', '6 Months'].map((opt, i) => {
              const oy = dy + 192 + i * 19;
              const on = i === 1;
              return (
                <g key={opt}>
                  {on && (
                    <rect
                      x={dx + 20}
                      y={oy}
                      width={112}
                      height={18}
                      rx={5}
                      className="fill-brand-50"
                    />
                  )}
                  <Label
                    x={dx + 28}
                    y={oy + 9}
                    size={10}
                    tone={on ? 'accent' : 'body'}
                    weight={on ? 600 : 400}
                  >
                    {opt}
                  </Label>
                </g>
              );
            })}
          </g>
        )}
      </Dialog>
    </Scene>
  );
}

/** A single share-link row: a role badge, a faux URL field, and a Copy button. */
function ShareLinkRow({ x, y, role }: { x: number; y: number; role: 'Edit' | 'View' }) {
  const edit = role === 'Edit';
  return (
    <g>
      {/* Role pill (a role dropdown): label left, caret clear to its right */}
      <rect
        x={x}
        y={y}
        width={54}
        height={26}
        rx={7}
        className={edit ? 'fill-brand-500 stroke-brand-600' : 'fill-slate-100 stroke-slate-300'}
        strokeWidth={1.5}
      />
      <Label x={x + 12} y={y + 13} size={10} weight={600} tone={edit ? 'onAccent' : 'body'}>
        {role}
      </Label>
      <path
        d={`M${x + 42} ${y + 11} l3.5 3.5 l3.5 -3.5`}
        fill="none"
        className={edit ? 'stroke-white' : 'stroke-slate-400'}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* URL field */}
      <rect
        x={x + 60}
        y={y}
        width={150}
        height={26}
        rx={7}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={x + 70} y={y + 13} size={10} tone="muted">
        livediagram.app/d/…
      </Label>
      {/* Copy button */}
      <Button x={x + 216} y={y} w={60} h={26} label="Copy" variant="default" />
    </g>
  );
}

export function ShareLinks() {
  return <ShareDialog variant="links" />;
}

export function SharePassword() {
  return <ShareDialog variant="password" />;
}

export function ShareExpiry() {
  return <ShareDialog variant="expiry" />;
}

/** A read-only embedded diagram inside another page, with an embed-code
 *  snippet beneath it. */
export function EmbeddedDiagram() {
  return (
    <Scene w={420} h={240} bg="plain">
      {/* Host page card */}
      <rect
        x={28}
        y={16}
        width={364}
        height={208}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <TextBar x={44} y={32} w={120} h={8} />
      <TextBar x={44} y={48} w={320} tone="faint" />
      {/* Embedded diagram frame */}
      <rect
        x={44}
        y={66}
        width={232}
        height={96}
        rx={8}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <Shape x={60} y={88} w={64} h={36} kind="rect" label="A" />
      <Shape x={176} y={108} w={64} h={36} kind="circle" label="B" />
      {/* Open-in-livediagram badge */}
      <g transform="translate(196 70)">
        <rect width={74} height={16} rx={5} className="fill-slate-800/80" />
        <Label x={8} y={9} size={8} weight={600} tone="onAccent">
          Open in app
        </Label>
      </g>
      {/* Embed code snippet */}
      <rect x={288} y={66} width={88} height={96} rx={8} className="fill-slate-800" />
      <Label x={300} y={82} size={8} weight={600} className="fill-emerald-400">
        &lt;iframe
      </Label>
      <Label x={306} y={96} size={8} className="fill-slate-300">
        src=&quot;…&quot;
      </Label>
      <Label x={306} y={110} size={8} className="fill-slate-300">
        width=600
      </Label>
      <Label x={306} y={124} size={8} className="fill-slate-300">
        height=400
      </Label>
      <Label x={300} y={138} size={8} weight={600} className="fill-emerald-400">
        /&gt;
      </Label>
      <TextBar x={44} y={184} w={320} tone="faint" />
      <TextBar x={44} y={200} w={240} tone="faint" />
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

/** A team panel with a member list and Admin / Member role badges. */
export function TeamMembers() {
  const members: Member[] = [
    { initial: 'A', name: 'Aria', role: 'Admin', colour: 'brand' },
    { initial: 'J', name: 'Jae', role: 'Member', colour: 'violet' },
    { initial: 'M', name: 'Mara', role: 'Member', colour: 'emerald' },
  ];
  return (
    <Scene w={420} h={210} bg="plain">
      <Panel x={70} y={20} w={280} h={172} title="DESIGN TEAM">
        {members.map((m, i) => {
          const ry = 52 + i * 44;
          return (
            <g key={m.name}>
              <Avatar cx={92} cy={ry} r={13} initial={m.initial} colour={m.colour} />
              <Label x={114} y={ry} size={10} weight={600} tone="strong">
                {m.name}
              </Label>
              <RoleBadge x={272} y={ry - 10} role={m.role} />
              {i < members.length - 1 && (
                <line
                  x1={80}
                  y1={ry + 22}
                  x2={340}
                  y2={ry + 22}
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

/** Role badges alongside a pending email-invite row. */
export function RolesAndInvites() {
  return (
    <Scene w={420} h={220} bg="plain">
      <Panel x={56} y={18} w={308} h={184} title="MEMBERS & INVITES">
        {/* Member rows */}
        <Avatar cx={80} cy={56} r={12} initial="A" colour="brand" />
        <Label x={100} y={56} size={10} weight={600} tone="strong">
          Aria
        </Label>
        <RoleBadge x={286} y={46} role="Admin" />
        <line x1={72} y1={78} x2={348} y2={78} className="stroke-slate-100" strokeWidth={1.5} />
        <Avatar cx={80} cy={98} r={12} initial="J" colour="violet" />
        <Label x={100} y={98} size={10} weight={600} tone="strong">
          Jae
        </Label>
        <RoleBadge x={286} y={88} role="Member" />
        {/* Invite-by-email row */}
        <line x1={72} y1={124} x2={348} y2={124} className="stroke-slate-200" strokeWidth={1.5} />
        <Label x={72} y={142} size={8} weight={700} tone="muted">
          INVITE BY EMAIL
        </Label>
        <rect
          x={72}
          y={154}
          width={196}
          height={28}
          rx={7}
          className="fill-white stroke-slate-300"
          strokeWidth={1.5}
        />
        <Label x={84} y={168} size={11} tone="muted">
          mara@acme.com
        </Label>
        <Button x={278} y={154} w={70} h={28} label="Invite" variant="primary" />
      </Panel>
    </Scene>
  );
}

/** A per-team shared folder tree. */
export function TeamSharedTree() {
  const rows: { label: string; depth: number; folder: boolean; badge?: boolean }[] = [
    { label: 'Design Team', depth: 0, folder: true },
    { label: 'Architecture', depth: 1, folder: true },
    { label: 'System overview', depth: 2, folder: false, badge: true },
    { label: 'Data flow', depth: 2, folder: false, badge: true },
    { label: 'Onboarding', depth: 1, folder: true },
    { label: 'Unsorted', depth: 1, folder: true },
  ];
  return (
    <Scene w={420} h={230} bg="plain">
      <Panel x={70} y={16} w={280} h={198} title="TEAM DIAGRAMS">
        {rows.map((r, i) => {
          const ry = 48 + i * 28;
          const tx = 88 + r.depth * 22;
          return (
            <g key={r.label}>
              {r.folder ? (
                <path
                  d={`M${tx} ${ry - 4} h7 l2 3 h7 v9 h-16 Z`}
                  className="fill-brand-200 stroke-brand-400"
                  strokeWidth={1.5}
                />
              ) : (
                <rect
                  x={tx}
                  y={ry - 5}
                  width={13}
                  height={15}
                  rx={2}
                  className="fill-white stroke-slate-300"
                  strokeWidth={1.5}
                />
              )}
              <Label
                x={tx + 20}
                y={ry + 2}
                size={11}
                weight={r.depth === 0 ? 700 : 500}
                tone={r.depth === 0 ? 'strong' : 'body'}
              >
                {r.label}
              </Label>
              {r.badge && (
                <g transform={`translate(${308} ${ry - 6})`}>
                  <rect
                    width={34}
                    height={16}
                    rx={5}
                    className="fill-brand-100 stroke-brand-300"
                    strokeWidth={1}
                  />
                  <Label x={17} y={9} anchor="middle" size={8} weight={600} tone="accent">
                    Team
                  </Label>
                </g>
              )}
            </g>
          );
        })}
      </Panel>
    </Scene>
  );
}

// --- Session tools -----------------------------------------------------------

/** A countdown timer pill, shared at the top of the canvas. `mode` switches the
 *  display between a countdown and a stopwatch. */
function TimerPill({ x, y, time, label }: { x: number; y: number; time: string; label: string }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={148}
        height={34}
        rx={17}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      {/* clock ring */}
      <circle
        cx={x + 19}
        cy={y + 17}
        r={9}
        className="fill-none stroke-brand-500"
        strokeWidth={2}
      />
      <path
        d={`M${x + 19} ${y + 12} v5 l4 3`}
        fill="none"
        className="stroke-brand-500"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Label x={x + 36} y={y + 17} size={15} weight={700} tone="strong">
        {time}
      </Label>
      <Label x={x + 36} y={y + 28} size={8} weight={600} tone="muted">
        {label}
      </Label>
      {/* pause control */}
      <circle
        cx={x + 128}
        cy={y + 17}
        r={11}
        className="fill-brand-50 stroke-brand-300"
        strokeWidth={1.5}
      />
      <rect x={x + 124} y={y + 12} width={3} height={10} rx={1} className="fill-brand-600" />
      <rect x={x + 130} y={y + 12} width={3} height={10} rx={1} className="fill-brand-600" />
    </g>
  );
}

/** A votable shape carrying a tally pill of dots. */
function VoteShape({
  x,
  y,
  label,
  count,
  mine = false,
  winner = false,
}: {
  x: number;
  y: number;
  label: string;
  count: number;
  mine?: boolean;
  winner?: boolean;
}) {
  const w = 96;
  const h = 52;
  return (
    <g>
      {winner && (
        <rect
          x={x - 6}
          y={y - 6}
          width={w + 12}
          height={h + 12}
          rx={11}
          className="fill-none stroke-emerald-500"
          strokeWidth={2.5}
        />
      )}
      <Shape x={x} y={y} w={w} h={h} kind="rect" label={label} />
      {/* tally pill */}
      <g transform={`translate(${x + w - 14} ${y - 10})`}>
        <rect
          width={30}
          height={20}
          rx={10}
          className={mine ? 'fill-brand-500 stroke-brand-600' : 'fill-white stroke-slate-300'}
          strokeWidth={1.5}
        />
        <circle cx={9} cy={10} r={3.5} className={mine ? 'fill-white' : 'fill-brand-500'} />
        <Label
          x={20}
          y={10}
          anchor="middle"
          size={10}
          weight={700}
          tone={mine ? 'onAccent' : 'strong'}
        >
          {count}
        </Label>
      </g>
    </g>
  );
}

/** A shared countdown timer pill above a dot-voting tally: the two session
 *  tools at a glance. */
export function SessionTools() {
  return (
    <Scene w={420} h={230}>
      <TimerPill x={136} y={16} time="4:32" label="COUNTDOWN" />
      <VoteShape x={24} y={110} label="Idea A" count={3} mine winner />
      <VoteShape x={158} y={110} label="Idea B" count={1} />
      <VoteShape x={292} y={110} label="Idea C" count={2} />
    </Scene>
  );
}

/** The timer set-up: countdown and stopwatch controls with duration presets. */
export function TimerControl() {
  const presets = ['1', '3', '5', '10'];
  return (
    <Scene w={420} h={230} bg="plain">
      <Panel x={88} y={20} w={244} h={188} title="SESSION · TIMER">
        {/* Mode toggle */}
        <rect
          x={104}
          y={52}
          width={212}
          height={28}
          rx={8}
          className="fill-slate-100 stroke-slate-200"
          strokeWidth={1.5}
        />
        <rect
          x={106}
          y={54}
          width={104}
          height={24}
          rx={6}
          className="fill-white stroke-slate-200"
          strokeWidth={1}
        />
        <Label x={158} y={66} anchor="middle" size={11} weight={700} tone="accent">
          Countdown
        </Label>
        <Label x={262} y={66} anchor="middle" size={11} weight={500} tone="muted">
          Stopwatch
        </Label>
        {/* Duration presets */}
        <Label x={104} y={100} size={8} weight={700} tone="muted">
          MINUTES
        </Label>
        {presets.map((p, i) => {
          const px = 104 + i * 54;
          const on = i === 2;
          return (
            <g key={p}>
              <rect
                x={px}
                y={110}
                width={46}
                height={32}
                rx={7}
                className={on ? 'fill-brand-500 stroke-brand-600' : 'fill-white stroke-slate-300'}
                strokeWidth={1.5}
              />
              <Label
                x={px + 23}
                y={126}
                anchor="middle"
                size={13}
                weight={700}
                tone={on ? 'onAccent' : 'body'}
              >
                {p}
              </Label>
            </g>
          );
        })}
        {/* Start / Reset */}
        <Button x={104} y={160} w={130} label="Start" variant="primary" />
        <Button x={244} y={160} w={72} label="Reset" variant="default" />
      </Panel>
    </Scene>
  );
}

/** Dot voting in progress: shapes with vote dots and a running tally, plus the
 *  dots-remaining banner. */
export function DotVoting() {
  return (
    <Scene w={420} h={230}>
      {/* Dots-remaining banner */}
      <g transform="translate(120 14)">
        <rect width={180} height={28} rx={14} className="fill-brand-500" />
        <circle cx={22} cy={14} r={4} className="fill-white" />
        <circle cx={34} cy={14} r={4} className="fill-white" />
        <circle cx={46} cy={14} r={4} className="fill-white/40" />
        <Label x={62} y={15} size={11} weight={600} tone="onAccent">
          2 dots left · 7 cast
        </Label>
      </g>
      <VoteShape x={24} y={100} label="Reduce WIP" count={4} mine winner />
      <VoteShape x={158} y={100} label="Pair more" count={1} />
      <VoteShape x={292} y={100} label="Auto tests" count={2} mine />
    </Scene>
  );
}
