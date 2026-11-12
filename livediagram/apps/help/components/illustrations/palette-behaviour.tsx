// Behaviour-category illustrations (docs/specs/018-help/help-app.md, drawing docs/specs/009-elements/mode-button.md to docs/specs/012-collaboration/picker.md and
// docs/specs/009-elements/reaction-pad.md): the palette's Behaviour groups, plus one scene per element that
// does something when somebody presses it: Selection Mode buttons, Session
// buttons, the Done check, Reaction pads, Reveal zones and the Picker.
//
// One scene per sub-article, so each small article can show the surface it
// describes with the real labels the editor prints on it. Composed from the
// shared primitives; raw shapes only for motifs the kit lacks (glyph chips,
// confetti, an eye).

import type { ReactNode } from 'react';

import {
  Scene,
  Label,
  TextBar,
  Avatar,
  Button,
  Panel,
  Cursor,
} from '@liveworkspace/help-site/art/primitives';
import {
  AskGlyph,
  Chip,
  DoorGlyph,
  LaserGlyph,
  PollGlyph,
  RecordGlyph,
  SelectGlyph,
  SmileGlyph,
  SpotlightGlyph,
  StopwatchGlyph,
  VoteGlyph,
  WorkshopGlyph,
} from './palette-behaviour-glyphs';

// The Reaction pads, Reveal zone and Picker scenes live in palette-behaviour-reactions.tsx.
export { ReactionPads, RevealZone, PickerCard } from './palette-behaviour-reactions';

// --- Scenes ----------------------------------------------------------------

/** The Collaborate elements on Workshop's palette strip: **Ask** on its own, then **Session**, open, with its five
 *  groups down the side, room-first, and the open group's elements beside them. `lit` picks out what an article is
 *  about (Ask, and any of Session's groups; the first lit group is the one shown open). */
export function CollaborateCategories({ lit = [] }: { lit?: readonly string[] }) {
  const groups: { label: string; icon: ReactNode }[] = [
    { label: 'Tools', icon: <WorkshopGlyph /> },
    { label: 'Record', icon: <RecordGlyph /> },
    { label: 'React', icon: <SmileGlyph /> },
    { label: 'Selection Mode', icon: <SelectGlyph /> },
    { label: 'Navigate', icon: <DoorGlyph /> },
  ];
  const open = groups.find((g) => lit.includes(g.label)) ?? groups[0]!;
  const askLit = lit.includes('Ask');
  return (
    <Scene w={420} h={236} bg="plain">
      {/* The end of the strip: Ask, then Session, open. */}
      <rect
        x={196}
        y={10}
        width={168}
        height={32}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <rect
        x={202}
        y={14}
        width={58}
        height={24}
        rx={6}
        className={askLit ? 'fill-brand-50 stroke-brand-300' : 'fill-white stroke-transparent'}
        strokeWidth={1}
      />
      <Chip x={216} y={26} r={8}>
        <AskGlyph />
      </Chip>
      <Label x={228} y={30} size={10} weight={600} tone={askLit ? 'accent' : 'body'}>
        Ask
      </Label>
      <rect x={266} y={14} width={92} height={24} rx={6} className="fill-brand-100" />
      <Chip x={280} y={26} r={8}>
        <WorkshopGlyph />
      </Chip>
      <Label x={292} y={30} size={10} weight={700} className="fill-brand-700">
        Session
      </Label>
      <rect x={272} y={37} width={80} height={2} rx={1} className="fill-brand-500" />
      {/* Session's flyout: its groups down the side, the open one's elements beside them. */}
      <Panel x={56} y={50} w={308} h={176}>
        <rect x={57} y={51} width={112} height={174} rx={9} className="fill-slate-50" />
        <path d="M169 52 V225" className="stroke-slate-200" strokeWidth={1} />
        {groups.map((g, i) => {
          const gy = 60 + i * 32;
          const on = g === open;
          const named = lit.includes(g.label);
          return (
            <g key={g.label}>
              {on ? (
                <rect
                  x={62}
                  y={gy}
                  width={102}
                  height={26}
                  rx={7}
                  className="fill-white stroke-slate-200"
                  strokeWidth={1}
                />
              ) : null}
              <Chip x={76} y={gy + 13} r={8}>
                {g.icon}
              </Chip>
              <Label
                x={88}
                y={gy + 17}
                size={9.5}
                weight={on || named ? 700 : 500}
                tone={on || named ? 'accent' : 'body'}
              >
                {g.label}
              </Label>
            </g>
          );
        })}
        <Label x={180} y={70} size={10} weight={700} tone="strong">
          {open.label}
        </Label>
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect
              x={180}
              y={82 + i * 44}
              width={172}
              height={36}
              rx={8}
              className="fill-white stroke-slate-200"
              strokeWidth={1}
            />
            <Chip x={198} y={100 + i * 44} r={10}>
              {open.icon}
            </Chip>
            <TextBar x={214} y={93 + i * 44} w={88} tone="muted" />
            <TextBar x={214} y={104 + i * 44} w={120} tone="faint" />
          </g>
        ))}
      </Panel>
    </Scene>
  );
}

/** A control bar of Selection Mode buttons across the top of a canvas: two
 *  offering a mode, one offering the way back out. */
export function ModeButtonBar() {
  // The face: the icon chip that is the button, a small capitalised kicker,
  // then the mode in bold. A button for the mode you are in says LEAVE.
  const buttons: { kicker: string; mode: string; icon: ReactNode }[] = [
    { kicker: 'SWITCH TO', mode: 'Select', icon: <SelectGlyph /> },
    { kicker: 'SWITCH TO', mode: 'Laser', icon: <LaserGlyph /> },
    { kicker: 'LEAVE', mode: 'Spotlight', icon: <SpotlightGlyph /> },
  ];
  return (
    <Scene w={420} h={218}>
      {buttons.map((b, i) => {
        const bx = 26 + i * 126;
        return (
          <g key={b.mode}>
            <rect
              x={bx}
              y={20}
              width={112}
              height={80}
              rx={10}
              className="fill-white stroke-slate-300"
              strokeWidth={2}
            />
            <Chip x={bx + 56} y={45}>
              {b.icon}
            </Chip>
            <Label x={bx + 56} y={74} anchor="middle" size={8} weight={600} tone="muted">
              {b.kicker}
            </Label>
            <Label x={bx + 56} y={88} anchor="middle" size={11} weight={700} tone="strong">
              {b.mode}
            </Label>
          </g>
        );
      })}
      <Label x={26} y={132} size={10} weight={700} tone="muted">
        THE MODE CHANGES FOR WHOEVER PRESSED IT
      </Label>
      <Avatar cx={44} cy={174} r={14} initial="A" colour="brand" />
      <Avatar cx={80} cy={174} r={14} initial="R" colour="emerald" />
      <Avatar cx={116} cy={174} r={14} initial="P" colour="violet" />
      <Label x={140} y={174} size={11} tone="muted">
        everyone else stays where they were
      </Label>
      <Cursor x={216} y={44} name="You" />
    </Scene>
  );
}

/** The four session elements: a Timer, which is the clock itself, then the Stopwatch, Dot vote
 *  and Poll buttons, each labelled from its own setting. */
export function SessionButtons() {
  const cards: { kicker: string; action: string; icon: ReactNode }[] = [
    { kicker: 'START', action: 'a stopwatch', icon: <StopwatchGlyph /> },
    { kicker: 'START VOTE', action: '3 dots each', icon: <VoteGlyph /> },
    { kicker: 'ASK', action: 'Ready to ship?', icon: <PollGlyph /> },
  ];
  return (
    <Scene w={420} h={226}>
      {/* The Timer element: the same clock as the top-bar pill, idle at its length. */}
      <rect
        x={98}
        y={14}
        width={224}
        height={50}
        rx={12}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <Label x={114} y={40} size={13} weight={700} tone="muted">
        …
      </Label>
      {/* The idle face's dial: ticks round the edge, no chip. */}
      <g className="stroke-brand-300" strokeWidth={1.5} strokeLinecap="round">
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d="M0 -12 V-9" transform={`translate(146 39) rotate(${i * 30})`} />
        ))}
      </g>
      <Label x={168} y={40} size={10} weight={600} tone="muted">
        TIMER
      </Label>
      <Label x={210} y={40} size={15} weight={700} tone="strong">
        5:00
      </Label>
      <circle cx={292} cy={39} r={11} className="fill-brand-500" />
      <path d="M288.5 33.5 L297 39 L288.5 44.5 Z" className="fill-white" />
      {cards.map((c, i) => {
        const cx = 34 + i * 122;
        return (
          <g key={c.kicker}>
            <rect
              x={cx}
              y={80}
              width={108}
              height={88}
              rx={10}
              className="fill-white stroke-brand-300"
              strokeWidth={2}
            />
            <Label x={cx + 96} y={92} anchor="middle" size={13} weight={700} tone="muted">
              …
            </Label>
            <Chip x={cx + 54} y={107}>
              {c.icon}
            </Chip>
            <Label x={cx + 54} y={137} anchor="middle" size={10} weight={600} tone="muted">
              {c.kicker}
            </Label>
            <Label x={cx + 54} y={153} anchor="middle" size={11} weight={700} tone="strong">
              {c.action}
            </Label>
          </g>
        );
      })}
      <Label x={210} y={192} anchor="middle" size={11} tone="body">
        Pressing one starts that tool for everyone in the room.
      </Label>
      <Label x={210} y={212} anchor="middle" size={10} tone="muted">
        The … menu holds the setting you change most.
      </Label>
    </Scene>
  );
}

/** The Done check: the ring with the count, who has finished, and who it is still waiting on. */
export function DoneCheckCard() {
  const x = 70;
  const y = 14;
  const w = 280;
  const ringX = x + 62;
  const ringY = y + 96;
  const r = 34;
  const circ = 2 * Math.PI * r;
  return (
    <Scene w={420} h={222}>
      <rect
        x={x}
        y={y}
        width={w}
        height={194}
        rx={11}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <Label x={x + 14} y={y + 20} size={13} weight={700} tone="muted">
        …
      </Label>
      <Label x={x + 32} y={y + 20} size={12} weight={700} tone="strong">
        Everyone done?
      </Label>
      <Label x={x + w - 14} y={y + 20} anchor="end" size={11} weight={600} tone="accent">
        2/4
      </Label>
      {/* The ring fills as people finish, with the count in the middle. */}
      <circle cx={ringX} cy={ringY} r={r} className="fill-none stroke-slate-200" strokeWidth={7} />
      <circle
        cx={ringX}
        cy={ringY}
        r={r}
        className="fill-none stroke-brand-500"
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={`${circ / 2} ${circ}`}
        transform={`rotate(-90 ${ringX} ${ringY})`}
      />
      <Label x={ringX} y={ringY + 1} anchor="middle" size={16} weight={700} tone="strong">
        2/4
      </Label>
      <Label x={x + 124} y={y + 50} size={10} weight={700} tone="muted">
        Done · 2
      </Label>
      <Avatar cx={x + 136} cy={y + 72} r={12} initial="A" colour="emerald" />
      <Avatar cx={x + 166} cy={y + 72} r={12} initial="R" colour="brand" />
      <Label x={x + 124} y={y + 104} size={10} weight={700} tone="muted">
        Waiting · 2
      </Label>
      <g opacity={0.45}>
        <Avatar cx={x + 136} cy={y + 126} r={12} initial="P" colour="slate" />
        <Avatar cx={x + 166} cy={y + 126} r={12} initial="J" colour="slate" />
      </g>
      <Button x={x + 14} y={y + 156} w={w - 28} h={26} label="I'm done" variant="primary" />
    </Scene>
  );
}
