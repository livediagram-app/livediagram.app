// The Session Tabs articles' shared scenes (liveplanner/docs/specs/026-plan/session-tabs.md): a Refinement session's
// page (the sidebar with its header, progress bar and queue, the card, the action bar), the set-up dialog, the
// Refined fill button's three moments and Session Complete. The kinds' own parts are in ./session-kinds.

import {
  Button,
  Dialog,
  Label,
  Panel,
  Scene,
  TextBar,
} from '@liveworkspace/help-site/art/primitives';
import {
  BarButton,
  Chip,
  ChipRow,
  FillButton,
  MarkGlyph,
  ProgressBar,
  QueueRow,
  SidebarHeader,
} from './session-parts';

/** A Refinement session: the queue on the left (three decided, the room on the fourth), the card in full on the
 *  right, and the facilitator's action bar under it. */
export function SessionTabPage() {
  return (
    <Scene w={420} h={250}>
      <Panel x={10} y={10} w={158} h={230} />
      <SidebarHeader
        x={20}
        y={26}
        kind="Refinement"
        count="4 of 9"
        line="Backlog · Priority (Highest First)"
      />
      <ProgressBar
        x={20}
        y={74}
        w={138}
        segments={['done', 'skip', 'flag', 'current', 'todo', 'todo', 'todo', 'todo', 'todo']}
      />
      <QueueRow x={16} y={88} w={146} place={1} cardRef="WI-12" title="Export to CSV" mark="tick" />
      <QueueRow x={16} y={118} w={146} place={2} cardRef="WI-15" title="Dark mode" mark="skip" />
      <QueueRow x={16} y={148} w={146} place={3} cardRef="WI-18" title="SSO sign-in" mark="flag" />
      <QueueRow
        x={16}
        y={178}
        w={146}
        place={4}
        cardRef="WI-21"
        title="Retry failed payments"
        current
      />
      <QueueRow x={16} y={208} w={146} place={5} cardRef="WI-22" title="Onboarding emails" />

      <Panel x={176} y={10} w={234} h={186} />
      <Label x={190} y={28} size={8.5} weight={500} tone="muted">
        WI-21 · Backlog
      </Label>
      <Label x={190} y={44} size={12} weight={700} tone="strong">
        Retry failed payments
      </Label>
      {['Description', 'Estimate', 'Comments', 'Activity'].map((t, i) => (
        <Label
          key={t}
          x={190 + [0, 58, 106, 160][i]!}
          y={64}
          size={9}
          weight={i === 0 ? 600 : 500}
          tone={i === 0 ? 'accent' : 'muted'}
        >
          {t}
        </Label>
      ))}
      <line x1={186} y1={72} x2={400} y2={72} className="stroke-slate-100" strokeWidth={0.75} />
      <TextBar x={190} y={84} w={190} />
      <TextBar x={190} y={96} w={170} />
      <TextBar x={190} y={108} w={182} />
      <TextBar x={190} y={128} w={120} tone="faint" />
      <TextBar x={190} y={140} w={150} tone="faint" />
      <TextBar x={190} y={152} w={96} tone="faint" />

      <BarButton x={176} y={210} w={44} label="Skip" mark="skip" />
      <BarButton x={223} y={210} w={48} label="Flag" mark="flag" />
      <Label x={276} y={222.5} size={8} tone="muted">
        Moves to Ready
      </Label>
      <FillButton x={340} y={209} w={70} label="Refined" shortcut="R" />
    </Scene>
  );
}

/** Set Up Refinement: the card types and stages as chips (each stage's count), the order, where Refined takes each
 *  type, the timebox, and the queue the set-up makes, over Start Session. */
export function SessionSetupDialog() {
  const W = 420;
  const H = 318;
  const x = 46;
  return (
    <Scene w={W} h={H}>
      <Dialog
        x={30}
        y={8}
        w={360}
        h={H - 16}
        title="Set Up Refinement"
        sceneW={W}
        sceneH={H}
        scrim={false}
      >
        <Label x={x} y={58} size={9} weight={700} tone="muted">
          CARD TYPES
        </Label>
        <ChipRow
          x={x}
          y={66}
          chips={[{ label: 'Story', on: true }, { label: 'Bug', on: true }, { label: 'Task' }]}
        />
        <Label x={x} y={100} size={9} weight={700} tone="muted">
          STAGES
        </Label>
        <ChipRow
          x={x}
          y={108}
          chips={[
            { label: 'Backlog', on: true, count: 12 },
            { label: 'Needs Detail', on: true, count: 3 },
            { label: 'Ready', count: 5 },
          ]}
        />
        <Label x={x} y={142} size={9} weight={700} tone="muted">
          ORDER
        </Label>
        <Label x={x} y={160} size={9.5}>
          Sort By
        </Label>
        <Chip x={x + 52} y={151} label="Priority · Highest First" w={132} />
        <Label x={x} y={182} size={9.5}>
          Then By
        </Label>
        <Chip x={x + 52} y={173} label="Created At · Earliest First" w={150} />
        <Label x={x} y={206} size={9} weight={700} tone="muted">
          WHEN REFINED
        </Label>
        <Label x={x} y={223} size={9.5} tone="strong">
          Story
        </Label>
        <Chip x={x + 52} y={214} label="Next Stage" w={88} />
        <Label x={x + 160} y={223} size={9.5} tone="strong">
          Bug
        </Label>
        <Chip x={x + 190} y={214} label="Ready" w={64} />
        <Label x={x} y={248} size={9} weight={700} tone="muted">
          TIMEBOX
        </Label>
        <ChipRow
          x={x + 52}
          y={239}
          chips={[
            { label: 'Off' },
            { label: '2' },
            { label: '3' },
            { label: '5', on: true },
            { label: '10' },
          ]}
        />
        <line x1={30} y1={266} x2={390} y2={266} className="stroke-slate-100" strokeWidth={0.75} />
        <Label x={x} y={286} size={9.5} tone="muted">
          15 cards, Priority highest first
        </Label>
        <Button x={290} y={273} w={86} label="Start Session" variant="primary" />
      </Dialog>
    </Scene>
  );
}

/** The fill button's three moments: Refined at rest, the accent wash running across it, then the tick before it
 *  drains back out. */
export function RefinedFill() {
  const frames = [
    { phase: 'idle' as const, caption: 'Press Refined' },
    { phase: 'fill' as const, caption: 'It fills' },
    { phase: 'tick' as const, caption: 'A tick, then it drains' },
  ];
  return (
    <Scene w={420} h={92} bg="plain">
      {frames.map((f, i) => {
        const x = 28 + i * 132;
        return (
          <g key={f.phase}>
            <FillButton x={x} y={20} w={100} label="Refined" shortcut="R" phase={f.phase} />
            <Label x={x + 50} y={66} size={9.5} anchor="middle" tone="muted">
              {f.caption}
            </Label>
            {i < 2 ? (
              <path
                d={`M${x + 108} 33h16 m-4 -4 4 4 -4 4`}
                fill="none"
                className="stroke-slate-300"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </g>
        );
      })}
    </Scene>
  );
}

/** Session Complete: how many were refined, skipped and flagged, then Undo Last, Review Skipped and Start Again. */
export function SessionCompleteScene() {
  const counts = [
    { mark: 'tick' as const, label: 'Refined', n: 6 },
    { mark: 'skip' as const, label: 'Skipped', n: 2 },
    { mark: 'flag' as const, label: 'Flagged', n: 1 },
  ];
  return (
    <Scene w={420} h={206}>
      <Panel x={70} y={12} w={280} h={182} />
      <circle cx={210} cy={44} r={16} className="fill-brand-50" />
      <MarkGlyph cx={210} cy={44} mark="tick" />
      <Label x={210} y={76} size={12} weight={700} anchor="middle" tone="strong">
        Session Complete
      </Label>
      {counts.map((c, i) => (
        <g key={c.label}>
          <MarkGlyph cx={120 + i * 80} cy={102} mark={c.mark} />
          <Label x={130 + i * 80} y={102.5} size={9.5}>
            {c.label}
          </Label>
          <Label x={136 + i * 80} y={120} size={13} weight={700} anchor="middle" tone="strong">
            {c.n}
          </Label>
        </g>
      ))}
      <Chip x={154} y={136} label="Flagged WI-18 · Undo" w={112} />
      <Button x={112} y={162} w={100} label="Review Skipped" />
      <Button x={218} y={162} w={90} label="Start Again" />
    </Scene>
  );
}
