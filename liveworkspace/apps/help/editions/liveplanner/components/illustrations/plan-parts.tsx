// Plan mode illustrations' building blocks (docs/specs/026-plan/), shared by ./plan-board, ./plan-cards and the
// scenes that show a board: a card on a board (as liveplanner's PlanCard draws it: a type chip and its id badge,
// the title, then tags, dates and the assignee), a header widget, a column's settings button, a column and a plain
// pointer line. The window around a board (its header row, the corner cluster, the bottom bar) is ./planner-chrome.

import { Avatar, Label } from '@liveworkspace/help-site/art/primitives';
import { HAIR, HUE, textW, type Person, type TypeHue } from './planner-chrome';
export type { Person } from './planner-chrome';
import { Glyph, type GlyphName } from './planner-glyphs';

/** A plain straight pointer line with no head, for "this opens that". */
export function Arrow2({ from, to }: { from: [number, number]; to: [number, number] }) {
  return (
    <path
      d={`M${from[0]} ${from[1]} L${to[0]} ${to[1]}`}
      className="stroke-brand-300"
      strokeWidth={1.5}
      strokeDasharray="3 2"
    />
  );
}

// The card types the scenes show: the five built-in ones (Project, Task, Note, Idea, Action) and the Project
// Planner preset's User Story, Initiative and Bug, each with its hue, icon, name and id prefix.
export type CardType =
  'project' | 'task' | 'note' | 'idea' | 'action' | 'story' | 'initiative' | 'bug';

export const TYPE: Record<
  CardType,
  { hue: TypeHue; icon: GlyphName; name: string; prefix: string }
> = {
  project: { hue: 'slate', icon: 'board', name: 'Project', prefix: 'P' },
  task: { hue: 'teal', icon: 'task', name: 'Task', prefix: 'T' },
  note: { hue: 'indigo', icon: 'form', name: 'Note', prefix: 'N' },
  idea: { hue: 'amber', icon: 'initiative', name: 'Idea', prefix: 'I' },
  action: { hue: 'rose', icon: 'action', name: 'Action', prefix: 'A' },
  story: { hue: 'violet', icon: 'story', name: 'User Story', prefix: 'US' },
  initiative: { hue: 'indigo', icon: 'initiative', name: 'Initiative', prefix: 'I' },
  bug: { hue: 'rose', icon: 'bug', name: 'Bug', prefix: 'B' },
};

/** Each type's solid fill (its id badge, a type swatch in a list). */
export const STRIPE: Record<CardType, string> = Object.fromEntries(
  Object.entries(TYPE).map(([k, t]) => [k, HUE[t.hue].solid]),
) as Record<CardType, string>;

/** A card's id badge: the type's prefix and number, white on the type's solid hue. */
export function IdBadge({
  x,
  y,
  type,
  num,
}: {
  x: number;
  y: number;
  type: CardType;
  num: number;
}) {
  const id = `${TYPE[type].prefix}-${num}`;
  const w = textW(id, 8.5) + 7;
  return (
    <g>
      <rect x={x} y={y} width={w} height={11} rx={2.5} className={STRIPE[type]} />
      <Label x={x + w / 2} y={y + 6} size={8.5} weight={700} anchor="middle" tone="onAccent">
        {id}
      </Label>
    </g>
  );
}

/** A card type's chip: its icon and name on the type's tint. Returns its width through `typeChipW`. */
export function TypeChip({ x, y, type }: { x: number; y: number; type: CardType }) {
  const t = TYPE[type];
  const hue = HUE[t.hue];
  return (
    <g>
      <rect x={x} y={y} width={typeChipW(type)} height={11} rx={2.5} className={hue.tint} />
      <Glyph name={t.icon} x={x + 6} y={y + 5.5} s={0.6} className={hue.stroke} />
      <Label x={x + 11} y={y + 6} size={8.5} weight={500} className={hue.ink}>
        {t.name}
      </Label>
    </g>
  );
}

export function typeChipW(type: CardType): number {
  return textW(TYPE[type].name, 8.5) + 15;
}

/** A small rounded chip (a tag, a date): an optional dot or glyph, then its words. */
export function Chip({
  x,
  y,
  label,
  dot,
  glyph,
}: {
  x: number;
  y: number;
  label: string;
  dot?: TypeHue;
  glyph?: GlyphName;
}) {
  const lead = dot || glyph ? 9 : 4;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={lead + textW(label, 8.5) + 4}
        height={11}
        rx={dot ? 5.5 : 2.5}
        className={dot ? HUE[dot].tint : 'fill-slate-100'}
      />
      {dot && <circle cx={x + 5} cy={y + 5.5} r={1.6} className={HUE[dot].solid} />}
      {glyph && <Glyph name={glyph} x={x + 5} y={y + 5.5} s={0.5} />}
      <Label x={x + lead} y={y + 6} size={8.5} className={dot ? HUE[dot].ink : 'fill-slate-600'}>
        {label}
      </Label>
    </g>
  );
}

export function chipW(label: string, lead = true): number {
  return (lead ? 9 : 4) + textW(label, 8.5) + 4;
}

/**
 * One card on a board, as liveplanner's PlanCard draws it. `face="compact"` (the default, about 30 tall) is the
 * Compact Overview layout: the type's dot and the title, then the id badge and the assignee. `face="full"` is the
 * Simple Columns card: the type chip and its id badge (the priority at the right), the title, then any tags, the
 * due date and the assignee; it is `cardH(...)` tall.
 */
export function Card({
  x,
  y,
  w = 80,
  h,
  type = 'task',
  num,
  title,
  muted = false,
  lifted = false,
  face = 'compact',
  who,
  tags = [],
  due,
  priority,
  selected = false,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  type?: CardType;
  num: number;
  title: string;
  muted?: boolean;
  lifted?: boolean;
  face?: 'compact' | 'full';
  who?: Person;
  tags?: { label: string; hue: TypeHue }[];
  due?: string;
  priority?: 'High' | 'Medium' | 'Low';
  selected?: boolean;
}) {
  const ch = h ?? cardH(face, tags.length > 0, Boolean(due || who));
  const t = TYPE[type];
  return (
    <g
      transform={lifted ? `rotate(-3 ${x + w / 2} ${y + ch / 2})` : undefined}
      opacity={muted ? 0.6 : 1}
    >
      {lifted ? (
        <rect x={x + 1.5} y={y + 3} width={w} height={ch} rx={4} className="fill-slate-900/10" />
      ) : (
        <rect x={x} y={y + 0.8} width={w} height={ch} rx={4} className="fill-slate-900/[0.04]" />
      )}
      <rect
        x={x}
        y={y}
        width={w}
        height={ch}
        rx={4}
        className={
          lifted || selected ? 'fill-white stroke-brand-500' : 'fill-white stroke-slate-200'
        }
        strokeWidth={lifted || selected ? 1.2 : HAIR}
      />
      {face === 'compact' ? (
        <g>
          <circle cx={x + 6.5} cy={y + 8.5} r={1.8} className={STRIPE[type]} />
          <Label x={x + 11} y={y + 9} size={9} weight={600} tone="strong">
            {title}
          </Label>
          <IdBadge x={x + 5} y={y + 15.5} type={type} num={num} />
          {who && (
            <Avatar
              cx={x + 5 + textW(`${t.prefix}-${num}`, 8.5) + 7 + 8}
              cy={y + 21}
              r={4.8}
              initial={who.initial}
              colour={who.colour}
            />
          )}
        </g>
      ) : (
        <g>
          <TypeChip x={x + 6} y={y + 6} type={type} />
          <IdBadge x={x + 6 + typeChipW(type) + 3} y={y + 6} type={type} num={num} />
          {priority &&
            typeChipW(type) + textW(`${t.prefix}-${num}`, 8.5) + 7 + textW(priority, 8.5) + 34 <
              w && <Priority right={x + w - 6} y={y + 11.5} level={priority} />}
          <Label x={x + 6} y={y + 26} size={9.5} weight={600} tone="strong">
            {title}
          </Label>
          {tags.length > 0 &&
            (() => {
              let at = x + 6;
              return tags.map((tg) => {
                const cx = at;
                at += chipW(tg.label) + 3;
                return <Chip key={tg.label} x={cx} y={y + 34} label={tg.label} dot={tg.hue} />;
              });
            })()}
          {due && <Chip x={x + 6} y={y + ch - 16} label={`Due ${due}`} glyph="calendar" />}
          {who && (
            <Avatar
              cx={x + w - 11}
              cy={y + ch - 10.5}
              r={6}
              initial={who.initial}
              colour={who.colour}
            />
          )}
        </g>
      )}
    </g>
  );
}

/** A card's height for its face and what it carries. */
export function cardH(face: 'compact' | 'full', tags = false, footer = false): number {
  if (face === 'compact') return 30;
  return 34 + (tags ? 14 : 0) + (footer ? 16 : 0);
}

/** A card's priority at its top right: three rising bars, as many lit as the level, then its name. */
export function Priority({
  right,
  y,
  level,
}: {
  right: number;
  y: number;
  level: 'High' | 'Medium' | 'Low';
}) {
  const lit = { High: 3, Medium: 2, Low: 1 }[level];
  const cls = { High: 'fill-rose-500', Medium: 'fill-amber-500', Low: 'fill-slate-400' }[level];
  const lx = right - textW(level, 8.5);
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={lx - 12 + i * 3}
          y={y + 2.5 - (i + 1) * 2}
          width={2}
          height={(i + 1) * 2}
          rx={0.5}
          className={i < lit ? cls : 'fill-slate-200'}
        />
      ))}
      <Label
        x={right}
        y={y + 0.5}
        size={8.5}
        anchor="end"
        className={
          level === 'Low'
            ? 'fill-slate-500'
            : level === 'High'
              ? 'fill-rose-700 dark:fill-rose-300'
              : 'fill-amber-700 dark:fill-amber-300'
        }
      >
        {level}
      </Label>
    </g>
  );
}

/** A small widget pill in a board's header. */
export function Widget({ x, y, w, label }: { x: number; y: number; w: number; label: string }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={15}
        rx={4}
        className="fill-white stroke-slate-200"
        strokeWidth={HAIR}
      />
      <Label x={x + w / 2} y={y + 8} size={9} anchor="middle" tone="body">
        {label}
      </Label>
    </g>
  );
}

/** A column's settings button (the sliders glyph), lit while its popover is open. */
export function Cog({ cx, cy, on = false }: { cx: number; cy: number; on?: boolean }) {
  return (
    <g>
      {on && (
        <rect x={cx - 7} y={cy - 7} width={14} height={14} rx={3.5} className="fill-brand-100" />
      )}
      <Glyph name="settings" x={cx} y={cy} s={0.8} brand={on} />
    </g>
  );
}

/** A column: its header band (the card count, or count / WIP limit, then the name, then Collapse and the
 *  settings button) over the pale well its cards sit in. `warn` paints a count past its limit amber. */
export function Column({
  x,
  y,
  w,
  h,
  name,
  count,
  warn = false,
  cog = false,
  controls = true,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  count: string;
  warn?: boolean;
  cog?: boolean;
  controls?: boolean;
}) {
  const pillW = textW(count, 8) + 7;
  return (
    <g>
      {/* The header band, its pale top rule, then the well below it. */}
      <rect x={x} y={y} width={w} height={22} rx={5} className="fill-slate-100" />
      <rect x={x + 6} y={y + 3} width={w - 12} height={1.6} rx={0.8} className="fill-slate-200" />
      <rect
        x={x + 6}
        y={y + 8.5}
        width={pillW}
        height={10}
        rx={5}
        className={warn ? 'fill-amber-100' : 'fill-white'}
      />
      <Label
        x={x + 6 + pillW / 2}
        y={y + 14}
        size={8}
        anchor="middle"
        weight={warn ? 700 : 500}
        className={warn ? 'fill-amber-700 dark:fill-amber-300' : 'fill-slate-600'}
      >
        {count}
      </Label>
      <Label x={x + 6 + pillW + 5} y={y + 14} size={9.5} weight={700} tone="strong">
        {name}
      </Label>
      {controls && (
        <Glyph name="collapse" x={x + w - 23} y={y + 13.5} s={0.7} className="stroke-slate-400" />
      )}
      {(controls || cog) && <Cog cx={x + w - 9} cy={y + 13.5} on={cog} />}
      <rect x={x} y={y + 25} width={w} height={h - 25} rx={5} className="fill-slate-100" />
    </g>
  );
}

/** "+ Add Card" under a column's cards. */
export function AddCard({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <Glyph name="plus" x={x + 4} y={y} s={0.6} className="stroke-slate-500" />
      <Label x={x + 10} y={y + 0.5} size={9} tone="body">
        Add Card
      </Label>
    </g>
  );
}
