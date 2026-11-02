// Dot-voting illustrations (docs/specs/018-help/help-app.md, drawing docs/specs/012-collaboration/session-tools.md): the Vote set-up in the
// session panel, the votable-layer picker, the two privacy switches, the Vote
// panel's turnout view, and the results walkthrough.
//
// Split out from collaboration.tsx (already at size) per the no-god-files
// rule. The casting scene itself stays there as `DotVoting`, since the tally
// pill is shared with the session-tools overview.

import {
  Scene,
  Label,
  Shape,
  Panel,
  Button,
  Avatar,
} from '@liveworkspace/help-site/art/primitives';

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

/** Setting a vote up, as the Vote popover lays it out (VotePane): the dot budget drawn as the dots,
 *  Dots per item, and the two Privacy cards, over Start vote. */
export function VoteSetup() {
  const x = 86;
  const y = 12;
  const card = (cy: number, title: string, hint: string, on: boolean) => (
    <g>
      <rect
        x={x + 14}
        y={cy}
        width={220}
        height={38}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <Label x={x + 26} y={cy + 15} size={10} weight={600} tone="strong">
        {title}
      </Label>
      <Label x={x + 26} y={cy + 29} size={8.5} tone="muted">
        {hint}
      </Label>
      {/* The switch sits on the title's line, clear of the hint below. */}
      <Switch x={x + 196} y={cy + 5} on={on} />
    </g>
  );
  return (
    <Scene w={420} h={300} bg="plain">
      <Panel x={x} y={y} w={248} h={278} title="Vote">
        <Label x={x + 14} y={y + 42} size={10} weight={600} tone="body">
          Dots per person
        </Label>
        <Label x={x + 234} y={y + 42} anchor="end" size={9} tone="muted">
          3 each
        </Label>
        {/* The budget as the dots themselves: three of ten filled. */}
        {Array.from({ length: 10 }, (_, i) => (
          <circle
            key={i}
            cx={x + 22 + i * 22}
            cy={y + 58}
            r={i < 3 ? 6 : 4}
            className={i < 3 ? 'fill-brand-500' : 'fill-white stroke-slate-300'}
            strokeWidth={1.2}
          />
        ))}
        <Label x={x + 14} y={y + 84} size={10} weight={600} tone="body">
          Dots per item
        </Label>
        <rect x={x + 14} y={y + 92} width={220} height={22} rx={6} className="fill-slate-100" />
        <rect
          x={x + 16}
          y={y + 94}
          width={108}
          height={18}
          rx={5}
          className="fill-white stroke-slate-200"
          strokeWidth={1}
        />
        <Label x={x + 70} y={y + 104} anchor="middle" size={9.5} weight={600} tone="accent">
          Any number
        </Label>
        <Label x={x + 179} y={y + 104} anchor="middle" size={9.5} tone="muted">
          One each
        </Label>
        <Label x={x + 14} y={y + 136} size={10} weight={600} tone="body">
          Privacy
        </Label>
        {card(y + 144, 'Hide cursors', 'Nobody can watch where others are pointing.', true)}
        {card(y + 188, 'Hide running counts', 'Totals stay secret until you reveal them.', false)}
        <Button x={x + 14} y={y + 238} w={220} h={26} label="Start vote" variant="primary" />
      </Panel>
    </Scene>
  );
}

/** Only one layer takes dots: the Votable layer choice in the Vote set-up (All layers, then one
 *  button per layer), its elements ringed, everything else dimmed but still readable. */
export function VoteLayerPicker() {
  const opts = ['All layers', 'Ideas', 'Notes'];
  return (
    <Scene w={420} h={190}>
      {/* Off-layer, dimmed but still on the canvas */}
      <g opacity={0.35}>
        <Shape x={24} y={118} w={104} h={44} kind="rect" label="Frame" />
        <Shape x={150} y={118} w={104} h={44} kind="rect" label="Notes" />
      </g>
      {/* The votable layer: ringed, so there is no guessing where to click */}
      {[24, 150].map((sx, i) => (
        <g key={sx}>
          <rect
            x={sx - 4}
            y={36}
            width={112}
            height={52}
            rx={10}
            className="fill-none stroke-brand-400"
            strokeWidth={2}
          />
          <Shape
            x={sx}
            y={40}
            w={104}
            h={44}
            kind="rect"
            label={i === 0 ? 'Reduce WIP' : 'Pair more'}
          />
        </g>
      ))}
      <Panel x={270} y={24} w={140} h={112} title="Vote">
        <Label x={280} y={58} size={9} weight={600} tone="body">
          Votable layer
        </Label>
        <rect x={280} y={66} width={120} height={22} rx={6} className="fill-slate-100" />
        {opts.map((o, i) => {
          const segW = 40;
          const sx = 280 + i * segW;
          const on = i === 1;
          return (
            <g key={o}>
              {on ? (
                <rect
                  x={sx + 2}
                  y={68}
                  width={segW - 4}
                  height={18}
                  rx={5}
                  className="fill-white stroke-slate-200"
                  strokeWidth={1}
                />
              ) : null}
              <Label
                x={sx + segW / 2}
                y={78}
                anchor="middle"
                size={o === 'All layers' ? 7.5 : 9}
                weight={on ? 700 : 500}
                tone={on ? 'accent' : 'muted'}
              >
                {o}
              </Label>
            </g>
          );
        })}
        <Label x={280} y={104} size={8} tone="muted">
          Only this layer takes dots.
        </Label>
        <Label x={280} y={116} size={8} tone="muted">
          The rest stay visible, dimmed.
        </Label>
      </Panel>
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
            <Shape x={sx} y={50} w={116} h={78} kind="rect" label={s.label} />
            <rect
              x={sx + 56}
              y={102}
              width={54}
              height={22}
              rx={11}
              className={
                s.mine > 0 ? 'fill-brand-50 stroke-brand-300' : 'fill-white stroke-slate-300'
              }
              strokeWidth={1.5}
            />
            <Label
              x={sx + 68}
              y={113}
              anchor="middle"
              size={11}
              weight={700}
              tone="muted"
              className={s.mine > 0 ? undefined : 'opacity-40'}
            >
              −
            </Label>
            <Label x={sx + 83} y={113} anchor="middle" size={11} weight={700} tone="accent">
              {s.mine}
            </Label>
            <Label x={sx + 98} y={113} anchor="middle" size={11} weight={700} tone="muted">
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
        {[3, 3, 2, 1].map((spent, i) => (
          <g key={i}>
            <Pips x={x + 20} y={y + 78 + i * 18} spent={spent} budget={3} />
            <Label x={x + 186} y={y + 78 + i * 18} anchor="end" size={9} tone="muted">
              {3 - spent} left
            </Label>
          </g>
        ))}
        <Label x={x + 14} y={y + 176} size={9} tone="muted">
          1 person hasn’t voted yet
        </Label>
      </Panel>
    </Scene>
  );
}

/** The results walkthrough: the Vote panel driving the room (the pick under review with Previous and
 *  Next, over the ranked list), and the pick everyone is looking at. */
export function VoteResultsWalkthrough() {
  return (
    <Scene w={420} h={220}>
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
      <Shape x={26} y={146} w={120} h={44} kind="rect" label="Pair more" />
      <Avatar cx={168} cy={95} r={12} initial="R" colour="emerald" />
      <Avatar cx={168} cy={124} r={12} initial="P" colour="violet" />
      <Panel x={196} y={8} w={212} h={204} title="VOTE">
        {/* The walkthrough, leading the panel */}
        <rect x={206} y={38} width={192} height={46} rx={7} className="fill-amber-50" />
        <circle cx={216} cy={50} r={3.5} className="fill-amber-400" />
        <Label x={224} y={51} size={10} weight={600} tone="body">
          Top result 1 of 4 · 5 votes
        </Label>
        <rect
          x={212}
          y={60}
          width={88}
          height={18}
          rx={5}
          className="fill-white stroke-slate-200"
          strokeWidth={1}
        />
        <Label x={256} y={69} anchor="middle" size={9} weight={600} tone="body">
          Previous
        </Label>
        <rect x={304} y={60} width={88} height={18} rx={5} className="fill-brand-500" />
        <Label x={348} y={69} anchor="middle" size={9} weight={700} tone="onAccent">
          Next
        </Label>
        {[
          { name: 'Reduce WIP', votes: 5 },
          { name: 'Auto tests', votes: 3 },
          { name: 'Pair more', votes: 2 },
          { name: 'Trim standup', votes: 1 },
        ].map((r, i) => {
          const ry = 92 + i * 28;
          return (
            <g key={r.name}>
              <rect
                x={206}
                y={ry}
                width={192}
                height={24}
                rx={7}
                className={
                  i === 0 ? 'fill-brand-50 stroke-brand-300' : 'fill-white stroke-slate-200'
                }
                strokeWidth={1.5}
              />
              <Label
                x={216}
                y={ry + 12}
                size={10}
                weight={i === 0 ? 700 : 500}
                tone={i === 0 ? 'accent' : 'body'}
              >
                {r.name}
              </Label>
              <Label x={390} y={ry + 12} anchor="end" size={10} weight={700} tone="muted">
                {r.votes}
              </Label>
            </g>
          );
        })}
      </Panel>
    </Scene>
  );
}
