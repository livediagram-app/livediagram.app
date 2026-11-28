// Each session kind's own parts (liveplanner/docs/specs/026-plan/session-tabs.md "Sprint Planning", "Bug Triage",
// "Sprint Review", "Stand-up"): the Stand-up's people with their cards, Sprint Planning's tally and Estimate strip, Bug
// Triage's Close dialog and Sprint Review's demo strip and feedback box. Shared pieces from ./session-parts.

import {
  Avatar,
  Button,
  Dialog,
  DiscText,
  Label,
  Panel,
  Scene,
  TextBar,
} from '@liveworkspace/help-site/art/primitives';
import {
  BarButton,
  ChipRow,
  FillButton,
  MarkGlyph,
  ProgressBar,
  QueueRow,
  RowPill,
  SidebarHeader,
} from './session-parts';

// A person row in the Stand-up's sidebar: their disc (dashed "?" for Unassigned), name, card count, and a tick once
// Done (the row greyed).
function PersonRow({
  x,
  y,
  w,
  name,
  cards,
  colour,
  done = false,
  open = false,
}: {
  x: number;
  y: number;
  w: number;
  name: string;
  cards: number;
  colour?: 'brand' | 'emerald' | 'amber' | 'rose';
  done?: boolean;
  open?: boolean;
}) {
  return (
    <g opacity={done ? 0.6 : 1}>
      <rect
        x={x}
        y={y}
        width={w}
        height={24}
        rx={6}
        className={open ? 'fill-brand-50 stroke-brand-300' : 'fill-white stroke-transparent'}
        strokeWidth={0.75}
      />
      {colour ? (
        <Avatar cx={x + 13} cy={y + 12} r={7} initial={name[0]} colour={colour} />
      ) : (
        <g>
          <circle
            cx={x + 13}
            cy={y + 12}
            r={7}
            className="fill-white stroke-slate-300"
            strokeDasharray="2 1.5"
          />
          <DiscText cx={x + 13} cy={y + 12} size={8} className="fill-slate-400">
            ?
          </DiscText>
        </g>
      )}
      <Label x={x + 26} y={y + 12.5} size={9.5} weight={600} tone="strong">
        {name}
      </Label>
      <Label x={x + w - (done ? 24 : 8)} y={y + 12.5} size={8.5} anchor="end" tone="muted">
        {cards}
      </Label>
      {done ? <MarkGlyph cx={x + w - 12} cy={y + 12} mark="tick" /> : null}
    </g>
  );
}

/** A Stand-up: people in the sidebar, Priya's row unfolded to her in-flight cards, and the action bar's line, Blocked,
 *  Stage and the Done fill button, with the comment strip over it. */
export function StandupScene() {
  return (
    <Scene w={420} h={262}>
      <Panel x={10} y={10} w={168} h={242} />
      <SidebarHeader
        x={20}
        y={26}
        kind="Stand-up"
        count="2 of 4 people"
        line="In Progress, Review"
      />
      <ProgressBar x={20} y={74} w={148} segments={['done', 'current', 'todo', 'todo']} />
      <PersonRow x={16} y={86} w={156} name="Sam" cards={2} colour="emerald" done />
      <PersonRow x={16} y={112} w={156} name="Priya" cards={3} colour="rose" open />
      <QueueRow
        x={24}
        y={138}
        w={148}
        place={1}
        cardRef="WI-41 · In Progress"
        title="Retry failed payments"
        current
      />
      <QueueRow x={24} y={168} w={148} place={2} cardRef="WI-44 · Review" title="Webhook retries" />
      <PersonRow x={16} y={198} w={156} name="Alex" cards={1} colour="amber" />
      <PersonRow x={16} y={224} w={156} name="Unassigned" cards={2} />

      <Panel x={186} y={10} w={224} h={150} />
      <Label x={198} y={28} size={8.5} weight={500} tone="muted">
        WI-41 · In Progress
      </Label>
      <Label x={198} y={44} size={11.5} weight={700} tone="strong">
        Retry failed payments
      </Label>
      <TextBar x={198} y={62} w={180} />
      <TextBar x={198} y={74} w={160} />
      <TextBar x={198} y={86} w={170} />
      <TextBar x={198} y={106} w={110} tone="faint" />
      <TextBar x={198} y={118} w={140} tone="faint" />

      <rect
        x={186}
        y={168}
        width={142}
        height={22}
        rx={6}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <Label x={194} y={179.5} size={8.5} tone="muted">
        Add a note to WI-41
      </Label>
      <Button x={332} y={168} w={78} h={22} label="Add Comment" />
      <Label x={186} y={204} size={9} weight={600} tone="strong">
        Priya · card 1 of 3 · Blocked: Waiting on Review
      </Label>
      <BarButton x={186} y={218} w={66} label="Blocked" mark="flag" />
      <BarButton x={256} y={218} w={78} label="In Progress ▾" />
      <FillButton x={340} y={217} w={70} label="Done" shortcut="D" />
    </Scene>
  );
}

/** Sprint Planning: the tally under the progress bar (13 committed of 30, the room's card's 5 as a lighter segment),
 *  rows with estimate pills (a "?" for none), the Estimate strip, and Commit. */
export function PlanningScene() {
  const meter = 148;
  return (
    <Scene w={420} h={250}>
      <Panel x={10} y={10} w={168} h={230} />
      <SidebarHeader x={20} y={26} kind="Sprint Planning" count="5 of 12" line="Ready, Selected" />
      <ProgressBar
        x={20}
        y={74}
        w={meter}
        segments={[
          'done',
          'done',
          'skip',
          'done',
          'current',
          'todo',
          'todo',
          'todo',
          'todo',
          'todo',
          'todo',
          'todo',
        ]}
      />
      <Label x={20} y={92} size={8.5} weight={600} tone="muted">
        Committed
      </Label>
      <Label x={168} y={92} size={8.5} anchor="end" tone="body">
        13 of 30 points
      </Label>
      <rect x={20} y={99} width={meter} height={6} rx={3} className="fill-slate-100" />
      <rect x={20} y={99} width={(meter * 13) / 30} height={6} rx={3} className="fill-brand-600" />
      <rect
        x={20 + (meter * 13) / 30}
        y={99}
        width={(meter * 5) / 30}
        height={6}
        className="fill-brand-200"
      />
      <QueueRow
        x={16}
        y={116}
        w={156}
        place={1}
        cardRef="WI-30"
        title="Saved filters"
        mark="tick"
        aside={<RowPill x={168} y={123} label="5" />}
      />
      <QueueRow
        x={16}
        y={146}
        w={156}
        place={3}
        cardRef="WI-33"
        title="Bulk archive"
        mark="skip"
        aside={<RowPill x={168} y={153} label="?" dashed />}
      />
      <QueueRow
        x={16}
        y={176}
        w={156}
        place={5}
        cardRef="WI-36"
        title="Usage export"
        current
        aside={<RowPill x={168} y={183} label="5" />}
      />
      <QueueRow
        x={16}
        y={206}
        w={156}
        place={6}
        cardRef="WI-38"
        title="Team invites"
        aside={<RowPill x={168} y={213} label="8" />}
      />

      <Panel x={186} y={10} w={224} h={132} />
      <Label x={198} y={28} size={8.5} weight={500} tone="muted">
        WI-36 · Ready
      </Label>
      <Label x={198} y={44} size={11.5} weight={700} tone="strong">
        Usage export
      </Label>
      <TextBar x={198} y={62} w={180} />
      <TextBar x={198} y={74} w={150} />
      <TextBar x={198} y={94} w={120} tone="faint" />

      <Label x={186} y={156} size={9} weight={700} tone="muted">
        ESTIMATE
      </Label>
      <ChipRow
        x={186}
        y={164}
        chips={['1', '2', '3', '5', '8', '13', '21'].map((n) => ({ label: n, on: n === '5' }))}
      />
      <Label x={186} y={196} size={9}>
        Commit makes it 18 of 30
      </Label>
      <BarButton x={186} y={216} w={50} label="Skip" mark="skip" />
      <Label x={242} y={228.5} size={8.5} tone="muted">
        Moves to To Do
      </Label>
      <FillButton x={330} y={215} w={80} label="Commit" shortcut="C" />
    </Scene>
  );
}

/** Bug Triage's Close dialog: the reason with its chips, Link Duplicate, where the bug goes, and Close Bug. */
export function TriageCloseScene() {
  const W = 420;
  const H = 250;
  const x = 56;
  return (
    <Scene w={W} h={H}>
      <Dialog x={40} y={8} w={340} h={H - 16} title="Close Bug" sceneW={W} sceneH={H} scrim={false}>
        <Label x={130} y={28.5} size={9} tone="muted">
          BUG-12 · Basket empties
        </Label>
        <Label x={x} y={58} size={9} weight={700} tone="muted">
          REASON
        </Label>
        <rect
          x={x}
          y={66}
          width={308}
          height={24}
          rx={6}
          className="fill-white stroke-brand-300"
          strokeWidth={1}
        />
        <Label x={x + 8} y={78.5} size={9.5} tone="strong">
          Can&apos;t reproduce on the latest build
        </Label>
        <ChipRow
          x={x}
          y={98}
          chips={[
            { label: "Won't Fix" },
            { label: "Can't Reproduce", on: true },
            { label: 'Duplicate' },
            { label: 'Not a Bug' },
          ]}
        />
        <Label x={x} y={136} size={9} weight={700} tone="muted">
          DUPLICATE OF
        </Label>
        <Button x={x} y={144} w={98} h={24} label="Link Duplicate" />
        <Label x={x} y={188} size={9.5}>
          Moves to Won&apos;t Fix
        </Label>
        <line x1={40} y1={200} x2={380} y2={200} className="stroke-slate-100" strokeWidth={0.75} />
        <Button x={240} y={208} w={56} label="Cancel" />
        <Button x={302} y={208} w={66} label="Close Bug" variant="primary" />
      </Dialog>
    </Scene>
  );
}

/** Sprint Review: the demo strip over the card (the presenter, a merged pull request, two designs), the feedback box,
 *  and the action bar with Follow-up and the Reviewed fill button. */
export function ReviewScene() {
  return (
    <Scene w={420} h={250}>
      <Panel x={10} y={10} w={400} h={150} />
      <rect x={10} y={10} width={400} height={44} rx={10} className="fill-slate-50" />
      <Avatar cx={30} cy={32} r={9} initial="M" colour="violet" />
      <Label x={44} y={28} size={8} tone="muted">
        PRESENTER
      </Label>
      <Label x={44} y={39} size={9.5} weight={600} tone="strong">
        Maya
      </Label>
      <rect
        x={100}
        y={21}
        width={150}
        height={22}
        rx={6}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <Label x={108} y={32.5} size={8.5} weight={600} tone="strong">
        #482
      </Label>
      <rect x={132} y={26} width={40} height={13} rx={6.5} className="fill-violet-100" />
      <Label x={152} y={32.5} size={8} weight={600} anchor="middle" className="fill-violet-700">
        Merged
      </Label>
      <Label x={178} y={32.5} size={8.5}>
        Dark mode
      </Label>
      <rect
        x={262}
        y={18}
        width={44}
        height={28}
        rx={4}
        className="fill-brand-100 stroke-slate-200"
        strokeWidth={0.75}
      />
      <rect
        x={312}
        y={18}
        width={44}
        height={28}
        rx={4}
        className="fill-slate-200 stroke-slate-200"
        strokeWidth={0.75}
      />
      <path
        d="M266 40l10-10 8 7 6-4 12 7"
        fill="none"
        className="stroke-brand-400"
        strokeWidth={1.2}
      />
      <path
        d="M316 40l9-8 9 6 8-5 10 7"
        fill="none"
        className="stroke-slate-400"
        strokeWidth={1.2}
      />
      <Label x={22} y={72} size={8.5} weight={500} tone="muted">
        WI-47 · Done
      </Label>
      <Label x={22} y={88} size={11.5} weight={700} tone="strong">
        Dark mode for the dashboard
      </Label>
      <TextBar x={22} y={104} w={260} />
      <TextBar x={22} y={116} w={220} />
      <TextBar x={22} y={136} w={160} tone="faint" />

      <rect
        x={10}
        y={170}
        width={300}
        height={24}
        rx={6}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <Label x={18} y={182.5} size={9} tone="muted">
        What did the room think?
      </Label>
      <Label x={302} y={182.5} size={8.5} anchor="end" tone="muted">
        2 so far
      </Label>
      <Button x={316} y={170} w={94} h={24} label="Add Feedback" />
      <BarButton x={10} y={212} w={50} label="Skip" mark="skip" />
      <BarButton x={64} y={212} w={72} label="Follow-up" />
      <Label x={142} y={224.5} size={8.5} tone="muted">
        Stays in Done
      </Label>
      <FillButton x={318} y={211} w={92} label="Reviewed" shortcut="R" />
    </Scene>
  );
}

/** Bug Triage's queue rows: each bug's priority as a pill in its colour, a dashed "?" for one with none, and the
 *  decided ones greyed with their outcome. */
export function TriageQueueScene() {
  return (
    <Scene w={420} h={150}>
      <Panel x={110} y={10} w={200} h={130} />
      <QueueRow
        x={116}
        y={18}
        w={188}
        place={1}
        cardRef="BUG-9"
        title="Login loops on Safari"
        mark="tick"
        aside={<RowPill x={300} y={25} label="Urgent" tone="rose" />}
      />
      <QueueRow
        x={116}
        y={48}
        w={188}
        place={2}
        cardRef="BUG-11"
        title="Typo on pricing"
        mark="close"
        aside={<RowPill x={300} y={55} label="Low" tone="sky" />}
      />
      <QueueRow
        x={116}
        y={78}
        w={188}
        place={3}
        cardRef="BUG-12"
        title="Basket empties"
        current
        aside={<RowPill x={300} y={85} label="?" dashed />}
      />
      <QueueRow
        x={116}
        y={108}
        w={188}
        place={4}
        cardRef="BUG-14"
        title="Slow search"
        aside={<RowPill x={300} y={115} label="High" tone="amber" />}
      />
    </Scene>
  );
}
