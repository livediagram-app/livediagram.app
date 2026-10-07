// Explorer feed illustrations (docs/specs/018-help/help-app.md): Home (Jump back in and What
// happened), the All activity feed and its stacking, the Activity inbox, Recent, Shared with me,
// and the Spaces group of the sidebar with its teams. Drawn from the real labels in apps/live
// (sidebar-structure.ts, home-copy.ts, ActivityPane.tsx, views.tsx, the @livediagram/ui timeline).
// Composed from the shared primitives plus the Explorer parts, so the house style holds.

import type { ReactNode } from 'react';
import { Avatar, Label, Scene, Tabs } from './primitives';
import { SidebarGlyph, SidebarRow } from './explorer-parts';

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

/** A small document snapshot: a box or two joined by a line, on a pale well. */
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

/** An All activity card: preview box, subject with its menu, the reason in its tone, the meta. */
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
  /** A document snapshot motif, or a glyph drawn on the tone's tint. */
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

/** A large stroked glyph for a pictureless card: people (a team), a folder, a pencil (edits). */
function BigGlyph({ kind, tone }: { kind: 'team' | 'folder' | 'pencil'; tone: Tone }) {
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
  if (kind === 'folder') {
    return (
      <path
        d="M-12 -8 h8 l3 4 h13 v13 h-24 Z"
        className={cls}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    );
  }
  return (
    <g className={cls} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M-9 9 L-8 3 L5 -10 L10 -5 L-3 8 Z" />
      <path d="M2 -7 L7 -2" />
    </g>
  );
}

/** The row of the Activity page: kind glyph, title (and hint), the document chip and where, the person. */
function ActivityRow({
  y,
  kind,
  title,
  hint,
  chip,
  where,
  who,
  colour,
  time,
}: {
  y: number;
  kind: 'action' | 'comment' | 'card';
  title: string;
  hint?: string;
  chip: string;
  where: string;
  who: string;
  colour: 'brand' | 'emerald' | 'violet' | 'amber';
  time: string;
}) {
  const chipW = chip.length * 5.6 + 12;
  return (
    <g>
      <rect
        x={32}
        y={y}
        width={356}
        height={34}
        rx={6}
        className="fill-white stroke-slate-200"
        strokeWidth={1}
      />
      <g
        transform={`translate(46 ${y + 12})`}
        className="stroke-slate-400"
        strokeWidth={1.5}
        fill="none"
        strokeLinejoin="round"
      >
        {kind === 'action' && (
          <g>
            <rect x={-5} y={-6} width={10} height={12} rx={1.5} />
            <path d="M-2 -6 V-8 H2 V-6 M-2.5 0 L-0.5 2 L2.5 -1.5" />
          </g>
        )}
        {kind === 'comment' && <path d="M-6 -5 H6 V3 H-1 L-4 6 V3 H-6 Z" />}
        {kind === 'card' && <rect x={-5} y={-5} width={10} height={10} rx={2} />}
      </g>
      <Label x={60} y={y + 11} size={10.5} weight={600} tone="strong">
        {title}
      </Label>
      {hint && (
        <g>
          <rect
            x={60 + title.length * 5.9 + 6}
            y={y + 4}
            width={hint.length * 6.2 + 10}
            height={14}
            rx={7}
            className="fill-amber-50 stroke-amber-400"
            strokeWidth={1}
          />
          <Label
            x={60 + title.length * 5.9 + 11}
            y={y + 11}
            size={10}
            weight={600}
            className="fill-amber-600 dark:fill-amber-300"
          >
            {hint}
          </Label>
        </g>
      )}
      <rect x={60} y={y + 19} width={chipW} height={12} rx={6} className="fill-slate-100" />
      <Label x={66} y={y + 25.5} size={10} weight={600} tone="body">
        {chip}
      </Label>
      <Label x={60 + chipW + 6} y={y + 25.5} size={10} tone="muted">
        {where}
      </Label>
      <Avatar cx={372} cy={y + 13} r={8} initial={who} colour={colour} />
      <Label x={358} y={y + 13} size={10} tone="muted" anchor="end">
        {time}
      </Label>
    </g>
  );
}

/** A section heading of the Activity page with its count. */
function ActivitySectionTitle({ y, title, count }: { y: number; title: string; count: number }) {
  const w = title.length * 7;
  return (
    <g>
      <Label x={34} y={y} size={10} weight={700} tone="muted">
        {title}
      </Label>
      <rect
        x={34 + w + 4}
        y={y - 7}
        width={16}
        height={14}
        rx={7}
        className="fill-slate-200 dark:fill-(--help-art-slate-800)"
      />
      <Label x={34 + w + 12} y={y} anchor="middle" size={10} weight={700} tone="muted">
        {count}
      </Label>
    </g>
  );
}

/** A small folder chip beside a document's name on Recent. */
function FolderChip({ x, y, label }: { x: number; y: number; label: string }) {
  const w = label.length * 5.6 + 24;
  return (
    <g>
      <rect x={x} y={y - 7} width={w} height={14} rx={7} className="fill-slate-100" />
      <g transform={`translate(${x + 9} ${y}) scale(0.7)`}>
        <SidebarGlyph kind="folder" />
      </g>
      <Label x={x + 17} y={y + 0.5} size={10} tone="body">
        {label}
      </Label>
    </g>
  );
}

// --- Scenes ------------------------------------------------------------------

/** Home: Jump back in (most used on top, last used below) and What happened, with a summary entry. */
export function HomeOverview() {
  const tiles = [
    ['Roadmap', 'Payments', 'Onboarding', 'Data model'],
    ['Retro', 'Auth flow', 'Sprint 12', 'Brainstorm'],
  ];
  return (
    <Scene w={420} h={262} bg="plain">
      <Pane h={238} />
      <SectionHeading y={30} title="Jump back in" link="See more" />
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
      <SectionHeading y={168} title="What happened" link="See all activity" />
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

/** All activity: the header's Cards / Calendar switch and Filter, the day rail, and one day's
 *  cards, each coloured by what happened (green made, amber changed, red removed). */
export function AllActivityFeed() {
  return (
    <Scene w={420} h={206} bg="plain">
      <Pane h={182} />
      <Label x={32} y={31} size={12} weight={700} tone="strong">
        All activity
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
        subject="Old drafts"
        reason="Folder Deleted"
        meta="08:15 · You"
        tone="danger"
        preview={{ glyph: <BigGlyph kind="folder" tone="danger" /> }}
        dimmed
      />
    </Scene>
  );
}

/** A busy day: five edits fold into one stacked card, while a comment always keeps its own card. */
export function AllActivityStack() {
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
        subject="Documents Updated"
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

/** The Activity page: Assigned to You, You Assigned, then Open Comment Threads, each with a count. */
export function ActivitySections() {
  return (
    <Scene w={420} h={274} bg="plain">
      <Pane h={250} />
      <Label x={32} y={30} size={12} weight={700} tone="strong">
        Activity
      </Label>
      <line x1={16} y1={42} x2={404} y2={42} className="stroke-slate-200" strokeWidth={1.5} />
      <ActivitySectionTitle y={56} title="ASSIGNED TO YOU" count={2} />
      <ActivityRow
        y={64}
        kind="action"
        title="Confirm the retry budget"
        chip="Payments"
        where="Checkout · Flow"
        who="Y"
        colour="brand"
        time="2h"
      />
      <ActivityRow
        y={102}
        kind="card"
        title="#12 Add the audit table"
        chip="Ledger"
        where="Sprint board · Plan"
        who="Y"
        colour="brand"
        time="1d"
      />
      <ActivitySectionTitle y={152} title="YOU ASSIGNED" count={1} />
      <ActivityRow
        y={160}
        kind="action"
        title="Draft the rollout note"
        chip="Payments"
        where="Release · Plan"
        who="S"
        colour="emerald"
        time="3d"
      />
      <ActivitySectionTitle y={208} title="OPEN COMMENT THREADS" count={1} />
      <ActivityRow
        y={216}
        kind="comment"
        title="Checkout"
        hint="Mentioned You"
        chip="Payments"
        where="Checkout · Flow"
        who="P"
        colour="violet"
        time="5m"
      />
    </Scene>
  );
}

/** Recent: Home › Recent, newest first, each row naming where the document lives. */
export function RecentView() {
  const rows: { name: string; chip?: string; meta: string }[] = [
    { name: 'Q3 roadmap', chip: 'Planning', meta: '4m ago' },
    { name: 'Onboarding flow', chip: 'My documents', meta: '1h ago' },
    { name: 'Incident runbook', chip: 'Platform team', meta: 'yesterday' },
    { name: 'Hiring plan', meta: '2 days ago' },
  ];
  return (
    <Scene w={420} h={214} bg="plain">
      <Pane h={190} />
      <Label x={32} y={30} size={11} weight={600} tone="accent">
        Home
      </Label>
      <Label x={68} y={30} size={11} tone="muted">
        ›
      </Label>
      <Label x={80} y={30} size={11} weight={700} tone="strong">
        Recent
      </Label>
      <line x1={16} y1={44} x2={404} y2={44} className="stroke-slate-200" strokeWidth={1.5} />
      {rows.map((r, i) => {
        const y = 54 + i * 36;
        return (
          <g key={r.name}>
            <rect
              x={32}
              y={y}
              width={356}
              height={30}
              rx={6}
              className="fill-white stroke-slate-200"
              strokeWidth={1}
            />
            <Snapshot x={38} y={y + 5} w={30} h={20} motif={i} />
            <Label x={76} y={y + 15.5} size={10.5} weight={600} tone="strong">
              {r.name}
            </Label>
            {r.chip && <FolderChip x={76 + r.name.length * 6 + 8} y={y + 15} label={r.chip} />}
            <Label x={364} y={y + 15.5} size={10} tone="muted" anchor="end">
              {r.meta}
            </Label>
            <g className="fill-slate-400">
              <circle cx={378} cy={y + 11} r={1.3} />
              <circle cx={378} cy={y + 15} r={1.3} />
              <circle cx={378} cy={y + 19} r={1.3} />
            </g>
          </g>
        );
      })}
    </Scene>
  );
}

/** Shared with me: a table of name, owner, role, last update, and the dismiss cross. */
export function SharedWithMeTable() {
  const rows = [
    { name: 'Sprint board', owner: 'Maya Patel', role: 'Edit', at: '2h ago' },
    { name: 'System map', owner: 'Alex Kim', role: 'View', at: 'yesterday' },
    { name: 'Hiring plan', owner: 'Rosa Diaz', role: 'Edit', at: '3 days ago' },
  ];
  return (
    <Scene w={420} h={196} bg="plain">
      <Pane h={172} />
      <g transform="translate(40 30)">
        <SidebarGlyph kind="shared" active />
      </g>
      <Label x={54} y={30} size={12} weight={700} tone="strong">
        Shared with me
      </Label>
      <line x1={16} y1={44} x2={404} y2={44} className="stroke-slate-200" strokeWidth={1.5} />
      <rect x={28} y={52} width={364} height={20} rx={4} className="fill-slate-50" />
      {(
        [
          ['NAME', 40],
          ['OWNER', 196],
          ['ROLE', 276],
          ['UPDATED', 318],
        ] as const
      ).map(([h, x]) => (
        <Label key={h} x={x} y={62.5} size={10} weight={700} tone="muted">
          {h}
        </Label>
      ))}
      {rows.map((r, i) => {
        const y = 76 + i * 34;
        return (
          <g key={r.name}>
            <Snapshot x={38} y={y + 5} w={30} h={22} motif={i + 1} />
            <Label x={76} y={y + 16.5} size={10.5} weight={600} tone="strong">
              {r.name}
            </Label>
            <Label x={196} y={y + 16.5} size={10} tone="body">
              {r.owner}
            </Label>
            <rect
              x={276}
              y={y + 9}
              width={30}
              height={15}
              rx={7.5}
              className="fill-emerald-50 stroke-emerald-400"
              strokeWidth={1}
            />
            <Label
              x={291}
              y={y + 17}
              anchor="middle"
              size={10}
              weight={600}
              className="fill-emerald-600 dark:fill-emerald-300"
            >
              {r.role}
            </Label>
            <Label x={318} y={y + 16.5} size={10} tone="muted">
              {r.at}
            </Label>
            <path
              d={`M380 ${y + 12.5} l7 7 M387 ${y + 12.5} l-7 7`}
              className="stroke-slate-400"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
            {i < rows.length - 1 && (
              <line
                x1={28}
                y1={y + 33}
                x2={392}
                y2={y + 33}
                className="stroke-slate-200"
                strokeWidth={1}
              />
            )}
          </g>
        );
      })}
    </Scene>
  );
}

/** The sidebar's Spaces group when signed in: My documents, each team (expandable to its shared
 *  folders, with a member count), Invites while one waits, and New team. */
export function TeamSpacesSidebar() {
  const x = 100;
  const w = 220;
  const chevron = (cx: number, cy: number, open: boolean) => (
    <path
      d={open ? `M${cx - 3} ${cy - 1.5} l3 3 l3 -3` : `M${cx - 1.5} ${cy - 3} l3 3 l-3 3`}
      className="stroke-slate-400"
      strokeWidth={1.5}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
  return (
    <Scene w={420} h={232} bg="plain">
      <rect
        x={x}
        y={12}
        width={w}
        height={208}
        rx={10}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={x + 18} y={30} size={10} weight={700} tone="muted">
        SPACES
      </Label>
      {chevron(x + w - 18, 49, false)}
      <SidebarRow x={x} y={38} w={w - 20} label="My documents" glyph="folder" />
      {chevron(x + w - 18, 73, true)}
      <SidebarRow x={x} y={62} w={w - 20} label="Platform team" glyph="team" count={5} active />
      <SidebarRow x={x} y={86} w={w - 20} label="Roadmaps" glyph="folder" indent={16} />
      <SidebarRow x={x} y={110} w={w - 20} label="Runbooks" glyph="folder" indent={16} />
      {chevron(x + w - 18, 145, false)}
      <SidebarRow x={x} y={134} w={w - 20} label="Design team" glyph="team" count={3} />
      {/* Invites: an envelope glyph, with the waiting count. */}
      <g transform={`translate(${x + 16} 169)`}>
        <rect
          x={-6}
          y={-4.5}
          width={12}
          height={9}
          rx={1.5}
          className="fill-none stroke-slate-400"
          strokeWidth={1.6}
        />
        <path
          d="M-6 -3.5 L0 1 L6 -3.5"
          className="fill-none stroke-slate-400"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </g>
      <Label x={x + 32} y={169} size={10} weight={500} tone="body">
        Invites
      </Label>
      <rect
        x={x + w - 50}
        y={162}
        width={22}
        height={14}
        rx={7}
        className="fill-slate-200 dark:fill-(--help-art-slate-800)"
      />
      <Label x={x + w - 39} y={169} anchor="middle" size={10} weight={700} tone="muted">
        1
      </Label>
      {/* New team: a plus, last in Spaces. */}
      <path
        d={`M${x + 16} 188 v10 M${x + 11} 193 h10`}
        className="stroke-slate-400"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Label x={x + 32} y={193} size={10} weight={500} tone="body">
        New team
      </Label>
    </Scene>
  );
}
