// A peer's name chip, as Avatar mode draws one (@livehuddle/avatar AvatarWalker's chipEl): a small box, 4px round,
// filled with the person's colour and over their HEAD, their status inside it ("Leo · Focusing"). Every Space the
// marketing art draws (the card shots, the feature scenes, the hero's floor) labels its characters through this, so
// a chip never drifts from the product's. The fill is the product's identity fill (@liveworkspace/ui identity-fill):
// the colour itself in light mode under the dark ink white cannot read on it, its deep shade under white in dark.

import type { CSSProperties } from 'react';
import {
  avatarStatusColour,
  avatarStatusLabel,
  type AvatarStatus,
} from '@livehuddle/avatar/status';
import { FONT } from './art-tokens';

// Each presence colour's dark-mode shade, its Tailwind 700 step (@liveworkspace/settings presence.ts PRESENCE_COLOURS).
const DEEP: Record<string, string> = {
  '#0ea5e9': '#0369a1',
  '#10b981': '#047857',
  '#f59e0b': '#b45309',
  '#ef4444': '#b91c1c',
  '#8b5cf6': '#6d28d9',
  '#ec4899': '#be185d',
  '#14b8a6': '#0f766e',
  '#f97316': '#c2410c',
  '#6366f1': '#4338ca',
  '#84cc16': '#4d7c0f',
};

// The dark ink, slate-950, where white falls below AA (IDENTITY_DARK_INK).
const DARK_INK = '#020617';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const whiteContrast = (hex: string) => 1.05 / (luminance(hex) + 0.05);

/** The darker shade of a colour white reads on at AA, for a colour off the presence palette. */
function deepOf(colour: string): string {
  const known = DEEP[colour.toLowerCase()];
  if (known) return known;
  for (let amount = 0; amount < 1; amount += 0.05) {
    const shade = `#${[1, 3, 5]
      .map((i) =>
        Math.round(parseInt(colour.slice(i, i + 2), 16) * (1 - amount))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')}`;
    if (whiteContrast(shade) >= 4.5) return shade;
  }
  return '#000000';
}

/** The custom properties a chip's fill and ink read, in both appearances. */
export function identityPaint(colour: string): CSSProperties {
  return {
    '--identity': colour,
    '--identity-ink': whiteContrast(colour) >= 4.5 ? '#ffffff' : DARK_INK,
    '--identity-deep': deepOf(colour),
  } as CSSProperties;
}

// The chip in the art's canvas px: a little larger than the product's 10px type, so it reads at a card's scale.
export const CHIP_HEIGHT = 20;
// The gap from the top of the head to the chip's foot.
export const CHIP_GAP = 4;
// How far over the head anything else hanging there (a bubble, a camera, a hand) must start: the chip and a gap.
export const CHIP_CLEARANCE = CHIP_GAP + CHIP_HEIGHT + 6;

const PAD = 7;
const DOT = 8;
const GAP = 4;

/** About how wide the name (6.4px a letter, semibold) and its status (5.6px, medium) run at 12px. */
function textWidth(name: string, status?: AvatarStatus) {
  const nameWidth = [...name].length * 6.4;
  const statusWidth = status ? GAP + `· ${avatarStatusLabel(status)}`.length * 5.6 : 0;
  return { nameWidth, statusWidth };
}

/** A chip's width, for whatever must stand clear of it. */
export function chipWidth(name: string, status?: AvatarStatus): number {
  const { nameWidth, statusWidth } = textWidth(name, status);
  return Math.round(PAD * 2 + (status ? DOT + GAP : 0) + nameWidth + statusWidth);
}

/** The status dot: its colour with a white rim; Do Not Disturb a touch larger with a white bar (StatusDot). */
function StatusDot({ status, x, y }: { status: AvatarStatus; x: number; y: number }) {
  const fill = avatarStatusColour(status);
  if (status === 'dnd')
    return (
      <g transform={`translate(${x} ${y})`}>
        <circle r={5} fill={fill} stroke="#ffffff" strokeWidth={1.5} />
        <rect x={-3} y={-1} width={6} height={2} rx={1} fill="#ffffff" />
      </g>
    );
  return <circle cx={x} cy={y} r={4} fill={fill} stroke="#ffffff" strokeWidth={1.5} />;
}

/**
 * The chip over a character whose head's top is `head` px above its feet, in a group placed on the feet. `dx` moves
 * it sideways, as the canvas moves a chip off a seated neighbour's.
 */
export function AvatarChip({
  name,
  colour,
  head,
  status,
  dx = 0,
}: {
  name: string;
  colour: string;
  head: number;
  status?: AvatarStatus;
  dx?: number;
}) {
  const width = chipWidth(name, status);
  const textX = PAD + (status ? DOT + GAP : 0);
  return (
    <g
      transform={`translate(${dx - width / 2} ${-head - CHIP_GAP - CHIP_HEIGHT})`}
      style={identityPaint(colour)}
    >
      <rect
        width={width}
        height={CHIP_HEIGHT}
        rx={4}
        className="fill-(--identity) dark:fill-(--identity-deep)"
      />
      {status ? <StatusDot status={status} x={PAD + DOT / 2} y={CHIP_HEIGHT / 2} /> : null}
      <text
        x={textX}
        y={14.2}
        fontFamily={FONT}
        fontSize={12}
        fontWeight={600}
        className="fill-(--identity-ink) dark:fill-white"
      >
        {name}
        {status ? (
          <tspan dx={GAP} fontWeight={500} opacity={0.9}>
            · {avatarStatusLabel(status)}
          </tspan>
        ) : null}
      </text>
    </g>
  );
}
