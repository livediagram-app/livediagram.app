// Meeting-element illustrations (liveworkspace/docs/specs/017-help/help-centre.md, drawing docs/specs/009-elements/mode-button.md and
// docs/specs/002-project-scope/not-in-livehuddle.md): the meeting palette's Space categories, plus one scene per
// element that does something when somebody presses it: the Avatar Selection Mode button.
//
// One scene per sub-article, so each small article can show the surface it
// describes with the real labels the editor prints on it. Composed from the
// shared primitives; raw shapes only for motifs the kit lacks (glyph chips,
// confetti).

import type { ReactNode } from 'react';
import { Card, Icon, ICONS, STRIP_W, Strip, stripSlot, type StripItem } from './editor-chrome';

import { Scene, Label, TextBar, Avatar, Cursor } from '@liveworkspace/help-site/art/primitives';

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

/** The meeting elements' part of the strip, in its order: **Rooms**, **Seats**, **Perks**, **Play**, **Garden** and
 *  **Meet**, then **Travel** set apart by a divider; one of them open (the first named in `lit`, else Travel) with its
 *  elements in the flyout under it. */
export function MeetingCategories({ lit = [] }: { lit?: readonly string[] }) {
  const categories: { label: string; item: StripItem }[] = [
    { label: 'Rooms', item: 'rooms' },
    { label: 'Seats', item: 'seats' },
    { label: 'Perks', item: 'perks' },
    { label: 'Play', item: 'play' },
    { label: 'Garden', item: 'garden' },
    { label: 'Meet', item: 'meet' },
    { label: 'Travel', item: 'travel' },
  ];
  const open = categories.find((c) => lit.includes(c.label)) ?? categories.at(-1)!;
  const sx = 20;
  const fx = Math.min(Math.max(stripSlot(sx, open.item) - 110, sx), sx + STRIP_W - 220);
  return (
    <Scene w={360} h={200} bg="plain">
      <Strip x={sx} y={10} open={open.item} />
      <Card x={fx} y={42} w={220} h={148} r={7}>
        <rect x={fx + 8} y={50} width={20} height={20} rx={5} className="fill-brand-100" />
        <Icon prims={ICONS[open.item]} x={fx + 18} y={60} size={10} className="stroke-brand-700" />
        <Label x={fx + 34} y={60.5} size={10.5} weight={650} tone="strong">
          {open.label}
        </Label>
        <line
          x1={fx}
          y1={78}
          x2={fx + 220}
          y2={78}
          className="stroke-slate-100"
          strokeWidth={0.75}
        />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect
              x={fx + 10}
              y={88 + i * 32}
              width={20}
              height={20}
              rx={5}
              className="fill-white stroke-slate-200"
              strokeWidth={0.75}
            />
            <Icon prims={ICONS[open.item]} x={fx + 20} y={98 + i * 32} size={9} />
            <TextBar x={fx + 38} y={91 + i * 32} w={70} tone="muted" />
            <TextBar x={fx + 38} y={101 + i * 32} w={130} tone="faint" />
          </g>
        ))}
      </Card>
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
