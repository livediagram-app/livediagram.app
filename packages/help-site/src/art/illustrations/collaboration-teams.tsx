// Collaboration illustrations: Teams (members, their roles, and the shared tree). Re-exported
// from ./collaboration, where the help pages import them.
import { Scene, Avatar, Panel, Button, Label } from '../primitives';
import { plural } from '../noun';

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

/** A team's shared library: the Team designs breadcrumb (the product's `noun`) with the view toggle and
 *  Create, above the folders and work of the level you are in. */
export function TeamSharedTree({ noun }: { noun: string }) {
  const rows: { label: string; folder: boolean; meta: string }[] = [
    { label: 'Architecture', folder: true, meta: `4 ${plural(noun)}` },
    { label: 'Onboarding', folder: true, meta: `2 ${plural(noun)}` },
    { label: 'System overview', folder: false, meta: 'Edited 2h ago' },
    { label: 'Retro notes', folder: false, meta: 'Edited yesterday' },
  ];
  return (
    <Scene w={420} h={230} bg="plain">
      <Panel x={50} y={16} w={320} h={198}>
        <rect x={51} y={17} width={318} height={32} rx={9} className="fill-slate-50" />
        <line x1={51} y1={49} x2={369} y2={49} className="stroke-slate-200" strokeWidth={1} />
        <Label x={66} y={34} size={9.5} weight={700} tone="muted">
          {`TEAM ${plural(noun).toUpperCase()}`}
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
