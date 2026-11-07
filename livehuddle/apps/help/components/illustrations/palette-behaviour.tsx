// Meeting-element illustrations (docs/specs/018-help/help-app.md, drawing docs/specs/009-elements/mode-button.md and
// docs/specs/002-project-scope/not-in-livehuddle.md): the meeting palette's Space categories, plus one scene per
// element that does something when somebody presses it: the Avatar Selection Mode button.
//
// One scene per sub-article, so each small article can show the surface it
// describes with the real labels the editor prints on it. Composed from the
// shared primitives; raw shapes only for motifs the kit lacks (glyph chips,
// confetti).

import type { ReactNode } from 'react';

import {
  Scene,
  Label,
  TextBar,
  Avatar,
  Panel,
  Cursor,
} from '@liveworkspace/help-site/art/primitives';

// --- Small motifs the primitive kit does not carry -------------------------

/** A round glyph chip, the way a Selection Mode button draws its tool icon above
 *  the words. */
function Chip({
  x,
  y,
  r = 15,
  children,
}: {
  x: number;
  y: number;
  r?: number;
  children: ReactNode;
}) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} className="fill-brand-50 stroke-brand-200" strokeWidth={1.5} />
      <g transform={`translate(${x} ${y})`}>{children}</g>
    </g>
  );
}

const glyph = { className: 'stroke-brand-600', strokeWidth: 1.8, fill: 'none' } as const;

/** A 24-unit editor glyph, scaled down onto a chip. */
function Lucide({ children }: { children: ReactNode }) {
  return (
    <g
      transform="scale(0.68) translate(-12 -12)"
      className="stroke-brand-600"
      strokeWidth={2.6}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </g>
  );
}
/** An armchair, the Seats glyph. */
function ArmchairGlyph() {
  return (
    <Lucide>
      <path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3" />
      <path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z" />
      <path d="M5 18v2M19 18v2" />
    </Lucide>
  );
}
/** A floor plan of panels, the Rooms glyph. */
function PanelsGlyph() {
  return (
    <Lucide>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </Lucide>
  );
}
/** A coffee cup, the Perks glyph. */
function CoffeeGlyph() {
  return (
    <Lucide>
      <path d="M10 2v2M14 2v2M6 2v2" />
      <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
    </Lucide>
  );
}
/** An arrow through a doorway, the Travel glyph. */
function DoorGlyph() {
  return (
    <Lucide>
      <path d="M4 20V6.5a1 1 0 0 1 .8-1l7-1.4a1 1 0 0 1 1.2 1V20" />
      <path d="M2.6 20h12.8M17 9.5h4.4M19.2 7.3l2.2 2.2-2.2 2.2" />
    </Lucide>
  );
}
/** A little walking character, the Avatar mode glyph. */
function AvatarGlyph() {
  return (
    <g {...glyph} strokeLinecap="round">
      <circle cy={-4.5} r={3} />
      <path d="M0 -1.5 V4 M-4 7 L0 4 L4 7 M-3.5 1 H3.5" />
    </g>
  );
}

// --- Scenes ----------------------------------------------------------------

/** The meeting palette's Meet band on the strip: **Travel**, **Seats**, **Rooms** and **Perks**,
 *  one of them open (the first named in `lit`, else Travel) with its elements in the flyout under it. */
export function MeetingCategories({ lit = [] }: { lit?: readonly string[] }) {
  const categories: { label: string; icon: ReactNode; x: number; w: number }[] = [
    { label: 'Travel', icon: <DoorGlyph />, x: 22, w: 66 },
    { label: 'Seats', icon: <ArmchairGlyph />, x: 92, w: 72 },
    { label: 'Rooms', icon: <PanelsGlyph />, x: 168, w: 66 },
    { label: 'Perks', icon: <CoffeeGlyph />, x: 238, w: 84 },
  ];
  const open = categories.find((c) => lit.includes(c.label)) ?? categories[0]!;
  return (
    <Scene w={420} h={236} bg="plain">
      {/* The Meet band of the strip, the open category pressed. */}
      <rect
        x={16}
        y={10}
        width={312}
        height={32}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {categories.map((c) => {
        const on = c === open;
        return (
          <g key={c.label}>
            {on ? (
              <rect x={c.x} y={14} width={c.w} height={24} rx={6} className="fill-brand-100" />
            ) : null}
            <Chip x={c.x + 14} y={26} r={8}>
              {c.icon}
            </Chip>
            <Label
              x={c.x + 26}
              y={30}
              size={10}
              weight={on ? 700 : 500}
              className={on ? 'fill-brand-700' : 'fill-slate-600'}
            >
              {c.label}
            </Label>
            {on ? (
              <rect
                x={c.x + 6}
                y={37}
                width={c.w - 12}
                height={2}
                rx={1}
                className="fill-brand-500"
              />
            ) : null}
          </g>
        );
      })}
      {/* The open category's flyout: its elements, one row each. */}
      <Panel x={86} y={50} w={280} h={176}>
        <Label x={100} y={70} size={10} weight={700} tone="strong">
          {open.label}
        </Label>
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect
              x={100}
              y={82 + i * 44}
              width={252}
              height={36}
              rx={8}
              className="fill-white stroke-slate-200"
              strokeWidth={1}
            />
            <Chip x={118} y={100 + i * 44} r={10}>
              {open.icon}
            </Chip>
            <TextBar x={134} y={93 + i * 44} w={96} tone="muted" />
            <TextBar x={134} y={104 + i * 44} w={150} tone="faint" />
          </g>
        ))}
      </Panel>
    </Scene>
  );
}

/** An Avatar button before and after it is pressed: it offers Avatar mode, then the way back out of it
 *  (docs/specs/009-elements/mode-button.md "Only Avatar"). */
export function ModeButtonBar() {
  // The face: the icon chip that is the button, a small capitalised kicker,
  // then the mode in bold. A button for the mode you are in says LEAVE.
  const buttons: { kicker: string; mode: string; icon: ReactNode }[] = [
    { kicker: 'SWITCH TO', mode: 'Avatar', icon: <AvatarGlyph /> },
    { kicker: 'LEAVE', mode: 'Avatar', icon: <AvatarGlyph /> },
  ];
  return (
    <Scene w={420} h={218}>
      {buttons.map((b, i) => {
        const bx = 26 + i * 126;
        return (
          <g key={b.kicker}>
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
