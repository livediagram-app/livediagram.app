import type { CSSProperties, ReactNode } from 'react';
import { stickerArt } from '@livediagram/icons';
import { FONT } from '@/components/art-tokens';

// The small pieces the Town Hall window (hero-townhall-board.tsx, hero-townhall-kit.tsx) is drawn
// from: its palette, set text, an initials disc, a card on its shadow, a sticker and a section
// heading, each as the editor draws the element it stands for.

// The Q&A board's accent: the Default theme's sky stroke, as the editor's CollabAccentScope takes
// it from the element, and the accent as text (darker in light, lighter in dark).
export const ACCENT = '#0ea5e9';
export const ACCENT_INK = 'fill-sky-700 dark:fill-sky-300';
export const INK = 'fill-slate-800 dark:fill-slate-100';
export const MUTED = 'fill-slate-500 dark:fill-slate-400';
export const FAINT = 'fill-slate-400 dark:fill-slate-500';
export const CARD = 'fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700';
// A collab panel's surface: the theme's unpainted fill and stroke, as the Q&A board, the agenda and
// the checklist wear them on the Default theme.
export const PANEL = 'fill-(--art-ink-fill) stroke-(--art-ink-stroke)';
// A row inside a panel: the panel's ink at a whisper, as the editor's tint(textColor, 0.04).
export const ROW = 'fill-slate-900/[0.045] dark:fill-white/[0.05]';
export const TRACK = 'fill-slate-200/80 dark:fill-slate-700/70';
export const EMOJI = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

export type Box = { x: number; y: number; w: number; h: number };
export type Person = { initials: string; name: string; colour: string };

export function Txt({
  x,
  y,
  size,
  weight = 400,
  className = INK,
  anchor,
  children,
  ...rest
}: {
  x: number;
  y: number;
  size: number;
  weight?: number;
  className?: string;
  anchor?: 'middle' | 'end';
  children: ReactNode;
  style?: CSSProperties;
  fill?: string;
  letterSpacing?: number;
  fontStyle?: string;
  textDecoration?: string;
}) {
  return (
    <text
      x={x}
      y={y}
      fontFamily={FONT}
      fontSize={size}
      fontWeight={weight}
      textAnchor={anchor}
      className={className}
      stroke="none"
      {...rest}
    >
      {children}
    </text>
  );
}

// A card on the canvas: a soft offset shadow under a rounded body, as the editor lifts its cards.
export function Card({
  box,
  rx = 10,
  className = CARD,
  children,
}: {
  box: Box;
  rx?: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <>
      <rect
        x={box.x}
        y={box.y + 2}
        width={box.w}
        height={box.h}
        rx={rx}
        fill="#0f172a"
        opacity="0.06"
      />
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={rx} className={className} />
      {children}
    </>
  );
}

export function Avatar({
  cx,
  cy,
  r,
  person,
}: {
  cx: number;
  cy: number;
  r: number;
  person: Person;
}) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={person.colour} />
      {/* Baseline half a cap height below the centre (about 0.365 of the font size), so the
          initials' ink sits on the disc's centre (the optical audit holds it to 0.5px). */}
      <Txt
        x={cx}
        y={cy + r * 0.8 * 0.365}
        size={r * 0.8}
        weight={800}
        anchor="middle"
        className=""
        fill="white"
      >
        {person.initials}
      </Txt>
    </>
  );
}

// A section heading as the template sets one: a large bold title over its panel.
export function Heading({
  x,
  y,
  size = 12,
  children,
}: {
  x: number;
  y: number;
  size?: number;
  children: string;
}) {
  return (
    <Txt x={x} y={y} size={size} weight={800}>
      {children}
    </Txt>
  );
}

// A panel's "···" handle, as every collab element's header leads with its menu.
export function Handle({ x, y }: { x: number; y: number }) {
  return (
    <g className={ACCENT_INK}>
      {[0, 4, 8].map((dx) => (
        <circle key={dx} cx={x + dx} cy={y} r="1.1" />
      ))}
    </g>
  );
}

// A sticker drawn with the editor's own artwork (stickerArt, @livediagram/icons): the die-cut white
// plate on its shadow, the emoji on it.
export function Sticker({
  x,
  y,
  size,
  glyph,
  label,
}: {
  x: number;
  y: number;
  size: number;
  glyph: string;
  label: string;
}) {
  const art = stickerArt({ id: `hero-${label}`, kind: 'emoji', glyph, label, keywords: '' });
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox={art.viewBox}
      overflow="visible"
      dangerouslySetInnerHTML={{ __html: art.markup }}
    />
  );
}

// An up-arrow over a count, the Q&A board's VotePill: tinted, or filled in the accent once it is
// yours (or in the spotlight).
export function UpArrow({ x, y, className }: { x: number; y: number; className?: string }) {
  return (
    <path
      d={`M${x - 4} ${y + 2.5} l4 -4 l4 4`}
      fill="none"
      className={className}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export function Check({
  x,
  y,
  className,
  size = 1,
}: {
  x: number;
  y: number;
  className?: string;
  size?: number;
}) {
  return (
    <path
      d={`M${x - 3 * size} ${y} l${2.2 * size} ${2.2 * size} l${4 * size} ${-4.4 * size}`}
      fill="none"
      className={className}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
