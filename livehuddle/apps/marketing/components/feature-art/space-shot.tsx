// The Spaces card art's one drawing (docs/specs/019-marketing/marketing-site.md "Feature category pages"): a crop of
// a real Space in use, the same room drawings and Avatar mode stills the landing beats' scenes play
// (public/hero/<id>-light.svg, -dark.svg and -cast.svg, written by lib/hero-space-room.test.tsx), with the few marks a
// card adds over it (a bubble, a status, a note). Every card that shows a Space draws through this, so a card
// never shows a diagram and every room, chair and character is the product's own.

import type { CSSProperties, ReactNode } from 'react';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
import type { AvatarStatus } from '@livehuddle/avatar/status';
import { avatarBox } from '@livehuddle/avatar/walk';
import { AvatarChip, CHIP_CLEARANCE } from '../avatar-chip';
import { FONT } from '../art-tokens';
import { RoomArt } from '../room-art';
import {
  SPACE_AVATAR_SCALE,
  castHref,
  restOf,
  roomHref,
  stillId,
  type CastMember,
  type SpaceSceneSpec,
  type StillKey,
} from '../hero-space-cast';

const BOX = avatarBox(SPACE_AVATAR_SCALE);

/** A build delay for the shared card keyframes (app/feature-art/canvas.css's fa-a-*). */
export const at = (seconds: number) => ({ '--d': `${seconds}s` }) as CSSProperties;

/** One character in a shot: who (a cast member of the shot's Space), which still, and where if not at rest. */
export type ShotCast = {
  name: string;
  still?: StillKey;
  x?: number;
  y?: number;
  // No chip (a character the card labels its own way); the status inside it (Focusing for anyone in headphones,
  // unless the card gives another); the chip nudged sideways.
  chip?: boolean;
  status?: AvatarStatus;
  chipDx?: number;
};

function member(spec: SpaceSceneSpec, name: string): CastMember {
  const found = spec.cast.find((m) => m.name === name);
  if (!found) throw new Error(`${spec.id} has no ${name}`);
  return found;
}

/** Where a shot's character stands: its rest unless the shot moves it. */
export function shotPoint(spec: SpaceSceneSpec, cast: ShotCast) {
  const rest = restOf(member(spec, cast.name));
  return { x: cast.x ?? rest.x, y: cast.y ?? rest.y };
}

/** The name chip over a character's head, as the canvas labels a peer: their colour, their status inside. */
export { AvatarChip as NameChip } from '../avatar-chip';

/** A speech bubble, its tail at (0, 0): a white card edged in the speaker's colour, as the editor draws one. */
export function SpeechBubble({
  text,
  name,
  colour,
}: {
  text: string;
  name: string;
  colour: string;
}) {
  const width = Math.round([...text].length * 7.2 + 28);
  const height = 46;
  return (
    <g transform={`translate(${-width / 2} ${-height - 8})`}>
      <rect
        width={width}
        height={height}
        rx={14}
        stroke={colour}
        strokeWidth={1.5}
        className="fill-white dark:fill-slate-900"
      />
      <path
        d={`M${width / 2 - 7} ${height - 1.5}L${width / 2} ${height + 7}L${width / 2 + 7} ${height - 1.5}`}
        stroke={colour}
        strokeWidth={1.5}
        className="fill-white dark:fill-slate-900"
      />
      <text
        x={14}
        y={21}
        fontFamily={FONT}
        fontSize={13}
        className="fill-slate-800 dark:fill-slate-100"
      >
        {text}
      </text>
      <text x={14} y={36} fontFamily={FONT} fontSize={10} fontWeight={600} fill={colour}>
        {name}
      </text>
    </g>
  );
}

/**
 * The height of a character's drawn figure above its feet, where its name chip stands: a sitter's at rest (its
 * `stand` still is seated) is five rows lower.
 */
export function headOf(spec: SpaceSceneSpec, name: string, still: StillKey = 'stand') {
  const seated = member(spec, name).sits && still === 'stand';
  return (seated ? 19 : 24) * 2.5 * SPACE_AVATAR_SCALE;
}

/** How far above a character's feet whatever a card hangs over its head starts: over the head and its name chip. */
export function overHeadOf(spec: SpaceSceneSpec, name: string, still?: StillKey) {
  return headOf(spec, name, still) + CHIP_CLEARANCE;
}

/**
 * A crop of one Space: the room drawing (light or dark with the appearance), the characters named, and whatever the
 * card draws over them (`children`, in the Space's canvas coordinates, after the characters; `under`, before them).
 */
export function SpaceShot({
  spec,
  box,
  cast = [],
  under,
  children,
}: {
  spec: SpaceSceneSpec;
  box: readonly [number, number, number, number];
  cast?: readonly ShotCast[];
  under?: ReactNode;
  children?: ReactNode;
}) {
  const { x, y, width, height } = spec.stage;
  const sheet = castHref(spec);
  const placed = cast
    .map((c) => ({ c, m: member(spec, c.name), p: shotPoint(spec, c) }))
    .sort((a, b) => a.p.y - b.p.y);
  return (
    <Frame canvas>
      <svg
        viewBox={box.join(' ')}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <RoomArt
          light={roomHref(spec, 'light')}
          dark={roomHref(spec, 'dark')}
          x={x}
          y={y}
          width={width}
          height={height}
        />
        {under}
        {placed.map(({ c, m, p }) => (
          <g key={c.name} transform={`translate(${p.x} ${p.y})`}>
            <use
              href={`${sheet}#${stillId(m, c.still ?? 'stand')}`}
              x={-BOX.offsetX}
              y={-BOX.offsetY}
              width={BOX.width}
              height={BOX.height}
            />
            {c.chip === false ? null : (
              <AvatarChip
                name={m.name}
                colour={m.colour}
                head={headOf(spec, c.name, c.still)}
                status={c.status ?? (m.headphones ? 'focus' : undefined)}
                dx={c.chipDx}
              />
            )}
          </g>
        ))}
        {children}
      </svg>
    </Frame>
  );
}
