// Explorer feed illustrations (docs/specs/018-help/help-app.md): Home (Jump Back In and What
// Happened), and the Timeline feed and its stacking. Drawn from the real labels in the shared
// Explorer (@liveworkspace/explorer's HomePane and timeline). Composed from the shared primitives,
// so the house style holds.

import type { ReactNode } from 'react';
import { Avatar, Label, Scene, Tabs } from './primitives';

// --- Local parts -------------------------------------------------------------

/** The white Explorer pane every scene here sits in. */
function Pane({ x = 16, y = 12, w = 388, h }: { x?: number; y?: number; w?: number; h: number }) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={10}
      className="fill-white stroke-slate-200"
      strokeWidth={1.5}
    />
  );
}

/** A section heading with its quiet link at the right and the hairline rule under it (Home). */
function SectionHeading({ y, title, link }: { y: number; title: string; link: string }) {
  return (
    <g>
      <Label x={32} y={y} size={12} weight={700} tone="strong">
        {title}
      </Label>
      <Label x={388} y={y} size={10} weight={600} tone="accent" anchor="end">
        {link}
      </Label>
      <line x1={32} y1={y + 10} x2={388} y2={y + 10} className="stroke-slate-200" strokeWidth={1} />
    </g>
  );
}

/** A small canvas snapshot: a box or two joined by a line, on a pale well. */
function Snapshot({
  x,
  y,
  w,
  h,
  motif = 0,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  motif?: number;
}) {
  const cy = y + h / 2;
  // Too narrow for a motif: one shape stands in for the drawing.
  if (w < 50) {
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={4}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1}
        />
        <rect
          x={x + w / 2 - 7}
          y={cy - 4}
          width={14}
          height={8}
          rx={2}
          className={motif % 2 ? 'fill-brand-200' : 'fill-brand-300'}
        />
      </g>
    );
  }
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={6}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1}
      />
      {motif % 3 === 0 && (
        <g>
          <rect x={x + 10} y={cy - 5} width={16} height={10} rx={2} className="fill-brand-300" />
          <path
            d={`M${x + 26} ${cy} H${x + w - 26}`}
            className="stroke-brand-400"
            strokeWidth={1.4}
          />
          <rect
            x={x + w - 26}
            y={cy - 5}
            width={16}
            height={10}
            rx={2}
            className="fill-brand-100"
          />
        </g>
      )}
      {motif % 3 === 1 && (
        <g>
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              x={x + 10 + i * ((w - 20) / 3)}
              y={y + 6}
              width={(w - 20) / 3 - 4}
              height={h - 12}
              rx={2}
              className={i === 1 ? 'fill-brand-200' : 'fill-brand-100'}
            />
          ))}
        </g>
      )}
      {motif % 3 === 2 && (
        <g>
          <circle cx={x + w / 2} cy={cy - 3} r={5} className="fill-brand-300" />
          <path
            d={`M${x + w / 2} ${cy + 2} V${cy + 6} M${x + w / 2 - 14} ${cy + 6} H${x + w / 2 + 14}`}
            className="stroke-slate-300"
            strokeWidth={1.4}
            fill="none"
          />
        </g>
      )}
    </g>
  );
}

/** A solid pill with white text (New, Today). White on a hue deepens to its 700 in dark. */
function SolidPill({
  x,
  y,
  w,
  label,
  className = 'fill-brand-500',
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  className?: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={15} rx={4} className={className} />
      <Label x={x + w / 2} y={y + 8} anchor="middle" size={10} weight={700} tone="onAccent">
        {label}
      </Label>
    </g>
  );
}

const TONE = {
  create: { dot: 'fill-emerald-500', well: 'fill-emerald-50', ink: 'stroke-emerald-500' },
  structural: { dot: 'fill-amber-500', well: 'fill-amber-50', ink: 'stroke-amber-500' },
  danger: { dot: 'fill-rose-500', well: 'fill-rose-50', ink: 'stroke-rose-500' },
} as const;

type Tone = keyof typeof TONE;

/** A Timeline card: preview box, subject with its menu, the reason in its tone, the meta. */
function FeedCard({
  x,
  y,
  w = 108,
  subject,
  reason,
  meta,
  tone,
  preview,
  isNew = false,
  dimmed = false,
}: {
  x: number;
  y: number;
  w?: number;
  subject: string;
  reason: string;
  meta?: string;
  tone: Tone;
  /** A canvas snapshot motif, or a glyph drawn on the tone's tint. */
  preview: { motif: number } | { glyph: ReactNode };
  isNew?: boolean;
  /** A card with nothing left to open (a deleted folder) is dimmed. */
  dimmed?: boolean;
}) {
  const t = TONE[tone];
  return (
    <g opacity={dimmed ? 0.6 : 1}>
      <rect
        x={x}
        y={y}
        width={w}
        height={104}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {'motif' in preview ? (
        <Snapshot x={x + 6} y={y + 6} w={w - 12} h={46} motif={preview.motif} />
      ) : (
        <g>
          <rect x={x + 6} y={y + 6} width={w - 12} height={46} rx={6} className={t.well} />
          <g transform={`translate(${x + w / 2} ${y + 29})`}>{preview.glyph}</g>
        </g>
      )}
      {isNew && <SolidPill x={x + w - 40} y={y + 10} w={30} label="New" />}
      <Label x={x + 8} y={y + 64} size={10.5} weight={700} tone="strong">
        {subject}
      </Label>
      <g className="fill-slate-400">
        <circle cx={x + w - 18} cy={y + 64} r={1.3} />
        <circle cx={x + w - 13} cy={y + 64} r={1.3} />
        <circle cx={x + w - 8} cy={y + 64} r={1.3} />
      </g>
      <circle cx={x + 11} cy={y + 80} r={3} className={t.dot} />
      <Label x={x + 18} y={y + 80} size={10} weight={600} tone="body">
        {reason}
      </Label>
      {meta && (
        <Label x={x + 8} y={y + 94} size={10} tone="muted">
          {meta}
        </Label>
      )}
    </g>
  );
}

/** A large stroked glyph for a pictureless card: people (a team), a pencil (edits). */
function BigGlyph({ kind, tone }: { kind: 'team' | 'pencil'; tone: Tone }) {
  const cls = `${TONE[tone].ink} fill-none`;
  if (kind === 'team') {
    return (
      <g className={cls} strokeWidth={2} strokeLinecap="round">
        <circle cx={-6} cy={-6} r={4.5} />
        <path d="M-14 10 a8 7 0 0 1 16 0" />
        <circle cx={8} cy={-4} r={3.8} />
        <path d="M3 10 a6.5 6 0 0 1 12 0" />
      </g>
    );
  }
  return (
    <g className={cls} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M-9 9 L-8 3 L5 -10 L10 -5 L-3 8 Z" />
      <path d="M2 -7 L7 -2" />
    </g>
  );
}

/** Home: Jump Back In (most used on top, last used below) and What Happened, with a summary entry. */
export function HomeOverview() {
  const tiles = [
    ['Roadmap', 'Payments', 'Onboarding', 'Data model'],
    ['Retro', 'Auth flow', 'Sprint 12', 'Brainstorm'],
  ];
  return (
    <Scene w={420} h={262} bg="plain">
      <Pane h={238} />
      <SectionHeading y={30} title="Jump Back In" link="See More" />
      {tiles.map((row, r) =>
        row.map((name, c) => (
          <g key={name}>
            <Snapshot x={32 + c * 90} y={50 + r * 52} w={80} h={30} motif={r * 4 + c} />
            <Label x={32 + c * 90} y={89 + r * 52} size={10} tone="body">
              {name}
            </Label>
          </g>
        )),
      )}
      <SectionHeading y={168} title="What Happened" link="See Timeline" />
      <Label x={32} y={192} size={10} weight={700} tone="muted">
        Today
      </Label>
      <Avatar cx={58} cy={212} r={9} initial="L" colour="amber" />
      <Avatar cx={47} cy={212} r={9} initial="S" colour="emerald" />
      <Avatar cx={36} cy={212} r={9} initial="P" colour="violet" />
      <Label x={76} y={207} size={10.5} tone="strong">
        Priya, Sam and Lee commented and edited in <tspan fontWeight={700}>Payments</tspan>
      </Label>
      <Label x={76} y={222} size={10} tone="muted">
        Platform team · 5 updates · 14:05
      </Label>
      <SolidPill x={256} y={215} w={30} label="New" />
      <path
        d="M380 206 l4 4 l4 -4"
        className="stroke-slate-400"
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Scene>
  );
}

/** The Timeline: the header's Cards / Calendar switch and Filter, the day rail, and one day's
 *  cards, each coloured by what happened (green made, amber changed, red removed). */
export function TimelineFeed() {
  return (
    <Scene w={420} h={206} bg="plain">
      <Pane h={182} />
      <Label x={32} y={31} size={12} weight={700} tone="strong">
        Timeline
      </Label>
      <Tabs x={232} y={20} items={['Cards', 'Calendar']} tabW={54} h={22} />
      <rect
        x={346}
        y={20}
        width={46}
        height={22}
        rx={7}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <Label x={369} y={31.5} anchor="middle" size={10} weight={600} tone="body">
        Filter
      </Label>
      <line x1={16} y1={50} x2={404} y2={50} className="stroke-slate-200" strokeWidth={1.5} />
      <line x1={36} y1={68} x2={36} y2={182} className="stroke-slate-200" strokeWidth={1.5} />
      <circle cx={36} cy={66} r={4.5} className="fill-brand-500" />
      <SolidPill x={46} y={59} w={42} label="Today" />
      <Label x={96} y={67} size={10.5} weight={700} tone="strong">
        Tue, 5 Aug
      </Label>
      <FeedCard
        x={48}
        y={82}
        subject="Payments"
        reason="Comment Added"
        meta="10:40 · Priya"
        tone="create"
        preview={{ motif: 0 }}
        isNew
      />
      <FeedCard
        x={166}
        y={82}
        subject="Platform"
        reason="Member Joined"
        meta="09:30 · Sam"
        tone="structural"
        preview={{ glyph: <BigGlyph kind="team" tone="structural" /> }}
      />
      <FeedCard
        x={284}
        y={82}
        subject="Old project"
        reason="Team Deleted"
        meta="08:15 · You"
        tone="danger"
        preview={{ glyph: <BigGlyph kind="team" tone="danger" /> }}
        dimmed
      />
    </Scene>
  );
}

/** A busy day: five edits fold into one stacked card, while a comment always keeps its own card. */
export function TimelineStack() {
  const x = 60;
  const y = 50;
  const w = 160;
  return (
    <Scene w={420} h={180} bg="plain">
      <Pane h={156} />
      <line x1={36} y1={36} x2={36} y2={160} className="stroke-slate-200" strokeWidth={1.5} />
      <circle cx={36} cy={32} r={4.5} className="fill-slate-300" />
      <Label x={48} y={33} size={10.5} weight={700} tone="strong">
        Wed, 6 Aug
      </Label>
      {/* The faux layers stepping out behind the head card are the rest of the run. */}
      <rect
        x={x + 10}
        y={y + 8}
        width={w}
        height={104}
        rx={8}
        className="fill-slate-100 stroke-slate-200"
        strokeWidth={1}
      />
      <rect
        x={x + 5}
        y={y + 4}
        width={w}
        height={104}
        rx={8}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1}
      />
      <FeedCard
        x={x}
        y={y}
        w={w}
        subject="Canvases Updated"
        reason="5 events · click to expand"
        tone="create"
        preview={{ glyph: <BigGlyph kind="pencil" tone="create" /> }}
      />
      {/* The run's size, in the head card's corner. */}
      <rect x={x + w - 30} y={y + 10} width={22} height={15} rx={7.5} className="fill-slate-700" />
      <Label
        x={x + w - 19}
        y={y + 18}
        anchor="middle"
        size={10}
        weight={700}
        className="fill-white"
      >
        5
      </Label>
      <FeedCard
        x={250}
        y={y}
        w={140}
        subject="Checkout"
        reason="Comment Added"
        meta="11:02 · Lee"
        tone="create"
        preview={{ motif: 1 }}
      />
    </Scene>
  );
}
