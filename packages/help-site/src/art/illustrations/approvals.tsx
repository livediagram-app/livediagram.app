// Request Approval scenes for the Request Approval article of livediagram, livedocuments and livedesign
// (liveworkspace/docs/specs/017-help/help-centre.md; liveworkspace/docs/specs/004-index/approvals.md "In the editor"). Drawn once here,
// since the badge, the banner and the Share dialog's Approval tab are the platform's (@liveworkspace/explorer's
// approvals kit) and the same in every app that offers them; a scene that names the work takes the product's `noun`.
// Labels are the real UI strings.

import { Avatar, Button, Dialog, Label, Scene, TextBar } from '../primitives';

type Pill = {
  label: string;
  fill: string;
  stroke: string;
  text: string;
  glyph: 'clock' | 'flag' | 'check' | 'pencil';
  means: string;
};

const PILLS: Pill[] = [
  {
    label: 'Awaiting 1 of 3',
    fill: 'fill-amber-50',
    stroke: 'stroke-amber-300',
    text: 'fill-amber-700',
    glyph: 'clock',
    means: 'Waiting on answers',
  },
  {
    label: 'Changes Requested',
    fill: 'fill-rose-50',
    stroke: 'stroke-rose-300',
    text: 'fill-rose-700',
    glyph: 'flag',
    means: 'Someone asked for a change',
  },
  {
    label: 'Approved',
    fill: 'fill-emerald-50',
    stroke: 'stroke-emerald-300',
    text: 'fill-emerald-700',
    glyph: 'check',
    means: 'Everyone approved',
  },
  {
    label: 'Changed Since Approval',
    fill: 'fill-white',
    stroke: 'stroke-amber-400',
    text: 'fill-amber-700',
    glyph: 'pencil',
    means: 'Saved after approval',
  },
];

function Glyph({ kind, x, y, tone }: { kind: Pill['glyph']; x: number; y: number; tone: string }) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      className={`fill-none ${tone}`}
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === 'clock' && (
        <>
          <circle cx={0} cy={0} r={5} />
          <path d="M0 -2.4V0l2 1.4" />
        </>
      )}
      {kind === 'flag' && <path d="M-3 5V-5M-3 -4.5h7l-1.8 2.4 1.8 2.4h-7" />}
      {kind === 'check' && <path d="M-4.5 0.4l3 3 6-6.4" />}
      {kind === 'pencil' && <path d="M-4 4.5l.8-3L2.6 -4.4a1.6 1.6 0 0 1 2.2 2.2L-1 3.7z" />}
    </g>
  );
}

/** The four badge states, as the header's pills show them after the visibility pill. */
export function ApprovalBadges() {
  return (
    <Scene w={420} h={150} bg="plain">
      {PILLS.map((p, i) => {
        const y = 14 + i * 32;
        const w = 40 + p.label.length * 6;
        return (
          <g key={p.label}>
            <rect
              x={20}
              y={y}
              width={w}
              height={24}
              rx={12}
              className={`${p.fill} ${p.stroke}`}
              strokeWidth={1.5}
            />
            <Glyph kind={p.glyph} x={34} y={y + 12} tone={p.stroke} />
            <Label x={46} y={y + 13} size={11} weight={600} className={p.text}>
              {p.label}
            </Label>
            <Label x={250} y={y + 13} size={11} tone="muted">
              {p.means}
            </Label>
          </g>
        );
      })}
    </Scene>
  );
}

/** The banner an approver sees under the header, before and after they answer. */
export function ApprovalBanner({ noun }: { noun: string }) {
  return (
    <Scene w={420} h={170} bg="plain">
      <rect
        x={12}
        y={12}
        width={396}
        height={64}
        rx={10}
        className="fill-amber-50 stroke-amber-300"
        strokeWidth={1.5}
      />
      <Avatar cx={34} cy={34} r={11} initial="A" colour="violet" />
      <Label x={52} y={30} size={11} weight={600} tone="strong">
        {`Ada asked you to approve this ${noun}`}
      </Label>
      <Label x={52} y={48} size={10} tone="body">
        Check the dates. Due 14 Dec
      </Label>
      <Button x={226} y={50} w={104} h={20} label="Request Changes" />
      <Button x={338} y={50} w={60} h={20} label="Approve" variant="primary" />

      <rect
        x={12}
        y={92}
        width={396}
        height={64}
        rx={10}
        className="fill-emerald-50 stroke-emerald-300"
        strokeWidth={1.5}
      />
      <Label x={28} y={112} size={11} weight={600} tone="strong">
        You approved this. Waiting on 2 more.
      </Label>
      <TextBar x={28} y={126} w={150} tone="faint" />
      <Button x={290} y={104} w={108} h={22} label="Change Decision" />
    </Scene>
  );
}

function Check({ x, y, on }: { x: number; y: number; on: boolean }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={13}
        height={13}
        rx={3.5}
        className={on ? 'fill-brand-500 stroke-brand-600' : 'fill-white stroke-slate-300'}
        strokeWidth={1.4}
      />
      {on && (
        <path
          d={`M${x + 3} ${y + 6.8}l2.6 2.6 4.6-5.2`}
          className="fill-none stroke-white"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </g>
  );
}

/** The Share dialog's Approval tab with no request yet: who may be named, the note, the due day, the snapshot box. */
export function ApprovalShareTab({ noun }: { noun: string }) {
  const people = [
    { name: 'Ada Lovelace', via: 'Team', initial: 'A', colour: 'violet' as const, on: true },
    { name: 'Grace Hopper', via: 'Team', initial: 'G', colour: 'emerald' as const, on: true },
    { name: 'Alan Turing', via: 'Link', initial: 'T', colour: 'amber' as const, on: false },
  ];
  return (
    <Scene w={420} h={296} bg="plain">
      <Dialog x={20} y={10} w={380} h={276} title="Share" sceneW={420} sceneH={296} scrim={false}>
        <Label x={36} y={58} size={11} weight={600} tone="muted">
          Passes
        </Label>
        <Label x={96} y={58} size={11} weight={700} tone="accent">
          Approval
        </Label>
        <line x1={92} y1={67} x2={150} y2={67} className="stroke-brand-500" strokeWidth={2} />
        <Label x={36} y={86} size={10} weight={700} tone="muted">
          APPROVERS
        </Label>
        {people.map((p, i) => {
          const y = 98 + i * 28;
          return (
            <g key={p.name}>
              <Check x={36} y={y + 5} on={p.on} />
              <Avatar cx={65} cy={y + 11} r={9} initial={p.initial} colour={p.colour} />
              <Label x={81} y={y + 12} size={11} tone="strong">
                {p.name}
              </Label>
              <Label x={370} y={y + 12} size={10} tone="muted" anchor="end">
                {p.via}
              </Label>
            </g>
          );
        })}
        <Label x={36} y={192} size={10} weight={700} tone="muted">
          NOTE
        </Label>
        <rect
          x={36}
          y={198}
          width={230}
          height={22}
          rx={6}
          className="fill-white stroke-slate-300"
          strokeWidth={1.4}
        />
        <Label x={46} y={210} size={10} tone="body">{`What to look at in this ${noun}`}</Label>
        <Label x={282} y={192} size={10} weight={700} tone="muted">
          DUE
        </Label>
        <rect
          x={282}
          y={198}
          width={88}
          height={22}
          rx={6}
          className="fill-white stroke-slate-300"
          strokeWidth={1.4}
        />
        <Label x={292} y={210} size={10} tone="body">
          14 Dec 2026
        </Label>
        <Check x={36} y={232} on />
        <Label x={56} y={239} size={10} tone="body">
          Save this version as a snapshot
        </Label>
        <Button x={266} y={250} w={104} h={26} label="Request Approval" variant="primary" />
      </Dialog>
    </Scene>
  );
}

/** The same tab once a request is open: its status, who asked, and each approver's answer. */
export function ApprovalRequestOpen() {
  const rows = [
    {
      name: 'Ada Lovelace',
      state: 'Approved',
      note: '',
      initial: 'A',
      colour: 'violet' as const,
      tone: 'fill-emerald-700',
    },
    {
      name: 'Grace Hopper',
      state: 'Changes Requested',
      note: 'Check the dates',
      initial: 'G',
      colour: 'emerald' as const,
      tone: 'fill-rose-700',
    },
    {
      name: 'Alan Turing',
      state: 'Waiting',
      note: '',
      initial: 'T',
      colour: 'amber' as const,
      tone: 'fill-slate-500',
    },
  ];
  return (
    <Scene w={420} h={230} bg="plain">
      <Dialog x={20} y={10} w={380} h={210} title="Share" sceneW={420} sceneH={230} scrim={false}>
        <rect
          x={36}
          y={50}
          width={118}
          height={20}
          rx={10}
          className="fill-rose-50 stroke-rose-300"
          strokeWidth={1.4}
        />
        <Label x={46} y={61} size={10} weight={600} className="fill-rose-700">
          Changes Requested
        </Label>
        <Label x={166} y={61} size={10} tone="body">
          Asked by You, 2 days ago
        </Label>
        {rows.map((r, i) => {
          const y = 82 + i * 30;
          return (
            <g key={r.name}>
              <Avatar cx={46} cy={y + 12} r={9} initial={r.initial} colour={r.colour} />
              <Label x={62} y={y + 8} size={11} tone="strong">
                {r.name}
              </Label>
              {r.note && <Label x={62} y={y + 22} size={10} tone="muted">{`"${r.note}"`}</Label>}
              <Label x={370} y={y + 12} size={10} weight={600} anchor="end" className={r.tone}>
                {r.state}
              </Label>
            </g>
          );
        })}
        <Button x={36} y={178} w={104} h={26} label="Cancel Request" />
        <Button x={150} y={178} w={86} h={26} label="New Request" />
      </Dialog>
    </Scene>
  );
}
