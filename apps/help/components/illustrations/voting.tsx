// Dot-voting illustrations (spec/55, drawing spec/39): the Vote set-up in the
// session panel, the votable-layer picker, the two privacy switches, the Vote
// panel's turnout view, and the results walkthrough.
//
// Split out from collaboration.tsx (already at size) per the no-god-files
// rule. The casting scene itself stays there as `DotVoting`, since the tally
// pill is shared with the session-tools overview.

import { Scene, Label, Shape, Panel, Button, Avatar } from './primitives';

/** A settings toggle, on or off. */
function Switch({ x, y, on = false }: { x: number; y: number; on?: boolean }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={28}
        height={16}
        rx={8}
        className={on ? 'fill-brand-500' : 'fill-slate-200'}
      />
      <circle cx={on ? x + 20 : x + 8} cy={y + 8} r={6} className="fill-white" />
    </g>
  );
}

/** A row of pips: dots spent filled, dots left hollow. */
function Pips({ x, y, spent, budget }: { x: number; y: number; spent: number; budget: number }) {
  return (
    <g>
      {Array.from({ length: budget }, (_, i) => (
        <circle
          key={i}
          cx={x + i * 11}
          cy={y}
          r={4}
          className={i < spent ? 'fill-brand-500' : 'fill-slate-200'}
        />
      ))}
    </g>
  );
}

/** Setting a vote up: the dots-per-person stepper over Start vote. */
export function VoteSetup() {
  const x = 96;
  const y = 16;
  return (
    <Scene w={420} h={200} bg="plain">
      <Panel x={x} y={y} w={228} h={170} title="SESSION · VOTE">
        <Label x={x + 16} y={y + 44} size={10} weight={600} tone="body">
          Dots per person
        </Label>
        <rect
          x={x + 148}
          y={y + 34}
          width={64}
          height={22}
          rx={7}
          className="fill-white stroke-slate-300"
          strokeWidth={1.5}
        />
        <Label x={x + 158} y={y + 45} size={12} weight={700} tone="muted">
          −
        </Label>
        <Label x={x + 180} y={y + 45} anchor="middle" size={12} weight={700} tone="strong">
          3
        </Label>
        <Label x={x + 200} y={y + 45} size={12} weight={700} tone="muted">
          +
        </Label>
        <Label x={x + 16} y={y + 78} size={10} weight={600} tone="body">
          Hide cursors
        </Label>
        <Switch x={x + 184} y={y + 70} on />
        <Label x={x + 16} y={y + 106} size={10} weight={600} tone="body">
          Hide running counts
        </Label>
        <Switch x={x + 184} y={y + 98} />
        <Button x={x + 16} y={y + 124} w={196} h={26} label="Start vote" variant="primary" />
      </Panel>
    </Scene>
  );
}

/** Only one layer takes dots: its elements are ringed, everything else is
 *  dimmed but still readable. */
export function VoteLayerPicker() {
  return (
    <Scene w={420} h={210}>
      {/* Off-layer, dimmed but still on the canvas */}
      <g opacity={0.35}>
        <Shape x={24} y={122} w={104} h={44} kind="rect" label="Frame" />
        <Shape x={150} y={122} w={104} h={44} kind="rect" label="Notes" />
      </g>
      {/* The votable layer: ringed, so there is no guessing where to click */}
      <g>
        <rect
          x={20}
          y={46}
          width={112}
          height={52}
          rx={11}
          className="fill-none stroke-brand-400"
          strokeWidth={2}
          strokeDasharray="5 4"
        />
        <Shape x={24} y={50} w={104} h={44} kind="rect" label="Reduce WIP" />
        <rect
          x={146}
          y={46}
          width={112}
          height={52}
          rx={11}
          className="fill-none stroke-brand-400"
          strokeWidth={2}
          strokeDasharray="5 4"
        />
        <Shape x={150} y={50} w={104} h={44} kind="rect" label="Pair more" />
      </g>
      <Panel x={276} y={30} w={128} h={92} title="VOTE">
        <Label x={288} y={64} size={9} weight={600} tone="body">
          Votable layer
        </Label>
        <rect
          x={288}
          y={76}
          width={104}
          height={22}
          rx={7}
          className="fill-white stroke-slate-300"
          strokeWidth={1.5}
        />
        <Label x={298} y={87} size={10} weight={600} tone="accent">
          Ideas
        </Label>
        <path
          d="M0 0 L4 4 L8 0"
          transform="translate(372 85)"
          className="stroke-slate-400"
          strokeWidth={1.5}
          fill="none"
        />
      </Panel>
      <Label x={210} y={192} anchor="middle" size={10} tone="muted">
        Other layers stay on the canvas, dimmed, so you can see what you are voting against.
      </Label>
    </Scene>
  );
}

/** A blind vote in progress: your own tally is all you can see. */
export function VoteBlindTally() {
  return (
    <Scene w={420} h={190}>
      <Label x={210} y={26} anchor="middle" size={10} weight={700} tone="muted">
        HIDE RUNNING COUNTS · ON
      </Label>
      {[
        { label: 'Reduce WIP', mine: 2 },
        { label: 'Pair more', mine: 0 },
        { label: 'Auto tests', mine: 1 },
      ].map((s, i) => {
        const sx = 22 + i * 134;
        return (
          <g key={s.label}>
            <Shape x={sx} y={58} w={116} h={56} kind="rect" label={s.label} />
            <rect
              x={sx + 62}
              y={102}
              width={54}
              height={22}
              rx={11}
              className="fill-white stroke-brand-300"
              strokeWidth={1.5}
            />
            <Label x={sx + 74} y={113} anchor="middle" size={11} weight={700} tone="muted">
              −
            </Label>
            <Label x={sx + 89} y={113} anchor="middle" size={11} weight={700} tone="accent">
              {s.mine}
            </Label>
            <Label x={sx + 104} y={113} anchor="middle" size={11} weight={700} tone="muted">
              +
            </Label>
          </g>
        );
      })}
      <Label x={210} y={158} anchor="middle" size={10} tone="muted">
        Each pill shows only your own dots until the results are shown.
      </Label>
    </Scene>
  );
}

/** The Vote panel while casting is open: how far through the room the vote
 *  has got. */
export function VotePanelProgress() {
  const x = 110;
  const y = 14;
  return (
    <Scene w={420} h={214} bg="plain">
      <Panel x={x} y={y} w={200} h={190} title="VOTE">
        <Label x={x + 14} y={y + 44} size={10} weight={600} tone="body">
          2 of 5 finished
        </Label>
        <Label x={x + 186} y={y + 44} anchor="end" size={10} weight={700} tone="muted">
          9/15
        </Label>
        <rect x={x + 14} y={y + 54} width={172} height={6} rx={3} className="fill-slate-100" />
        <rect x={x + 14} y={y + 54} width={103} height={6} rx={3} className="fill-brand-500" />
        {[3, 3, 2, 1, 0].map((spent, i) => (
          <g key={i}>
            <Pips x={x + 20} y={y + 78 + i * 18} spent={spent} budget={3} />
            <Label x={x + 186} y={y + 78 + i * 18} anchor="end" size={9} tone="muted">
              {3 - spent} left
            </Label>
          </g>
        ))}
        <Label x={x + 14} y={y + 176} size={9} tone="muted">
          3 people haven’t voted yet
        </Label>
      </Panel>
    </Scene>
  );
}

/** The results walkthrough: the banner driving the room, the ranked list, and
 *  the pick everyone is looking at. */
export function VoteResultsWalkthrough() {
  return (
    <Scene w={420} h={220}>
      {/* The shared banner */}
      <g transform="translate(84 10)">
        <rect width={252} height={26} rx={13} className="fill-brand-500" />
        <circle cx={16} cy={13} r={4} className="fill-amber-400" />
        <Label x={28} y={14} size={10} weight={600} tone="onAccent">
          Top result 1 of 4
        </Label>
        <rect x={162} y={5} width={38} height={16} rx={6} className="fill-white/25" />
        <Label x={181} y={14} anchor="middle" size={9} weight={600} tone="onAccent">
          Previous
        </Label>
        <rect x={206} y={5} width={38} height={16} rx={6} className="fill-white" />
        <Label x={225} y={14} anchor="middle" size={9} weight={700} tone="accent">
          Next
        </Label>
      </g>
      {/* The pick the room is centred on */}
      <rect
        x={20}
        y={64}
        width={132}
        height={62}
        rx={12}
        className="fill-none stroke-amber-400"
        strokeWidth={3}
      />
      <Shape x={26} y={70} w={120} h={50} kind="rect" label="Reduce WIP" />
      <g opacity={0.5}>
        <Shape x={26} y={146} w={120} h={44} kind="rect" label="Pair more" />
      </g>
      <Avatar cx={168} cy={95} r={12} initial="R" colour="emerald" />
      <Avatar cx={168} cy={124} r={12} initial="P" colour="violet" />
      <Panel x={200} y={54} w={200} h={144} title="VOTE · RESULTS">
        {[
          { name: 'Reduce WIP', votes: 5, winner: true },
          { name: 'Auto tests', votes: 3 },
          { name: 'Pair more', votes: 2 },
          { name: 'Trim standup', votes: 1 },
        ].map((r, i) => {
          const ry = 88 + i * 26;
          return (
            <g key={r.name}>
              <rect
                x={212}
                y={ry}
                width={176}
                height={22}
                rx={7}
                className={
                  i === 0 ? 'fill-brand-50 stroke-brand-300' : 'fill-white stroke-slate-200'
                }
                strokeWidth={1.5}
              />
              <Label
                x={222}
                y={ry + 11}
                size={10}
                weight={i === 0 ? 700 : 500}
                tone={i === 0 ? 'accent' : 'body'}
              >
                {r.name}
              </Label>
              <Label x={380} y={ry + 11} anchor="end" size={10} weight={700} tone="muted">
                {r.votes}
              </Label>
            </g>
          );
        })}
      </Panel>
    </Scene>
  );
}
