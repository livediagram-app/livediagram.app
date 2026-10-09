'use client';

// The small parts a card face is built from (docs/specs/026-plan/plan-board.md "What the board shows"): the type
// chip, the number on its type's colour, the priority's signal bars, the footer's pills (due, start, estimate, checklist, comments, votes),
// label chips, the flag and the vote control. PlanCardFace lays them out per card size.
import { PRIORITY_LABELS, itemCommentCount, type Item, type Priority } from '@livediagram/items';
import { contrastRatio } from '@livediagram/document';
import { CommentIcon } from '@livediagram/ui';
import { PRIORITY_COLOURS, type PlanPalette } from './plan-palette';
import { PlanTypeGlyph } from './plan-type-glyph';
import { FLAG_COLOUR } from './item-flag';
import { labelColour } from './label-colour';
import { dayKey, dayLabel } from './day-label';

export const LATE_COLOUR = '#dc2626';
export const SOON_COLOUR = '#d97706';
// A due date this many days away or fewer (and not past) reads as due soon.
export const DUE_SOON_DAYS = 2;

// A colour softened into a pill's fill.
export const tint = (colour: string, pct = 14) =>
  `color-mix(in srgb, ${colour} ${pct}%, transparent)`;

export function checklistProgress(item: Item): { done: number; total: number } | null {
  const rows = item.fields['checklist'];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const done = rows.filter(
    (r) => !!r && typeof r === 'object' && (r as { done?: unknown }).done === true,
  ).length;
  return { done, total: rows.length };
}

// Where a due date stands: past (and not done), within DUE_SOON_DAYS, or neither.
export function dueState(due: string, done: boolean): 'late' | 'soon' | 'later' {
  if (done) return 'later';
  if (due < dayKey()) return 'late';
  return due <= dayKey(DUE_SOON_DAYS) ? 'soon' : 'later';
}

// A footer pill: an icon and a value on a soft fill, or tinted in a colour that means something.
export function MetaPill({
  palette,
  tone,
  label,
  children,
}: {
  palette: PlanPalette;
  // A colour the pill takes (due soon, late, a finished checklist); absent, it stays quiet.
  tone?: string;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className="inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 tabular-nums"
      style={
        tone
          ? { backgroundColor: tint(tone), color: tone }
          : { backgroundColor: palette.column, color: palette.muted }
      }
      {...(label ? { 'aria-label': label } : {})}
    >
      {children}
    </span>
  );
}

export function DuePill({
  due,
  done,
  palette,
}: {
  due: string;
  done: boolean;
  palette: PlanPalette;
}) {
  const state = dueState(due, done);
  const tone = state === 'late' ? LATE_COLOUR : state === 'soon' ? SOON_COLOUR : undefined;
  return (
    <MetaPill
      palette={palette}
      {...(tone ? { tone } : {})}
      label={`Due ${dayLabel(due)}${state === 'late' ? ', overdue' : ''}`}
    >
      <PlanTypeGlyph glyph="calendar" size={11} />
      <span aria-hidden className={state === 'late' ? 'font-semibold' : undefined}>
        Due {dayLabel(due)}
      </span>
    </MetaPill>
  );
}

// When the work begins, always quiet: only a due date takes a colour.
export function StartPill({ start, palette }: { start: string; palette: PlanPalette }) {
  return (
    <MetaPill palette={palette} label={`Starts ${dayLabel(start)}`}>
      <span aria-hidden>From {dayLabel(start)}</span>
    </MetaPill>
  );
}

export function ChecklistPill({
  progress,
  palette,
}: {
  progress: { done: number; total: number };
  palette: PlanPalette;
}) {
  const complete = progress.done === progress.total;
  return (
    <MetaPill
      palette={palette}
      {...(complete ? { tone: '#16a34a' } : {})}
      label={`Checklist ${progress.done} of ${progress.total} done`}
    >
      <PlanTypeGlyph glyph="task" size={11} />
      <span aria-hidden>
        {progress.done}/{progress.total}
      </span>
    </MetaPill>
  );
}

export function CommentsPill({ item, palette }: { item: Item; palette: PlanPalette }) {
  const n = itemCommentCount(item);
  if (n === 0) return null;
  return (
    <MetaPill palette={palette} label={n === 1 ? '1 comment' : `${n} comments`}>
      <CommentIcon size={11} />
      <span aria-hidden>{n}</span>
    </MetaPill>
  );
}

// The priority as signal bars (Low one, Medium two, High three, Urgent three in its red), with its name or not.
export function PrioritySignal({ priority, label }: { priority: Priority; label?: boolean }) {
  const lit = priority === 'low' ? 1 : priority === 'medium' ? 2 : 3;
  const colour = PRIORITY_COLOURS[priority];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1"
      role="img"
      aria-label={`${PRIORITY_LABELS[priority]} priority`}
    >
      <span aria-hidden className="inline-flex h-2.5 items-end gap-[2px]">
        {[4, 7, 10].map((h, i) => (
          <span
            key={h}
            className="w-[3px] rounded-[1px]"
            style={{
              height: h,
              backgroundColor: colour,
              opacity: i < lit ? 1 : 0.22,
            }}
          />
        ))}
      </span>
      {label ? (
        <span aria-hidden style={{ color: colour }}>
          {PRIORITY_LABELS[priority]}
        </span>
      ) : null}
    </span>
  );
}

const KEY_DARK = '#18181b';
// The text on a type's colour: white or near-black, whichever reads better on it.
export function keyTextOn(fill: string): string {
  return contrastRatio(fill, '#ffffff') >= contrastRatio(fill, KEY_DARK) ? '#ffffff' : KEY_DARK;
}

// The card's number on a fill of its type's colour: where the type's colour shows at a glance.
export function KeyTag({ itemKey, accent }: { itemKey: number; accent: string }) {
  return (
    <span
      className="inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[11px] font-semibold tabular-nums"
      style={{ backgroundColor: accent, color: keyTextOn(accent) }}
    >
      #{itemKey}
    </span>
  );
}

// A card with no number shown (Minimal) keeps its type's colour as a small dot before the title.
export function TypeDot({ accent }: { accent: string }) {
  return (
    <span
      aria-hidden
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: accent }}
    />
  );
}

// The card's type: its glyph and name on a tint of its colour.
export function TypeChip({
  glyph,
  label,
  accent,
  compact = false,
}: {
  glyph: string;
  label: string;
  accent: string;
  compact?: boolean;
}) {
  return (
    <span
      className="inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold"
      style={{ backgroundColor: tint(accent), color: accent }}
    >
      <PlanTypeGlyph glyph={glyph} size={12} color={accent} />
      {compact ? null : label}
    </span>
  );
}

export function LabelChips({ labels, max = 4 }: { labels: readonly string[]; max?: number }) {
  return (
    <div className="flex flex-wrap gap-1 text-[11px] font-medium">
      {labels.slice(0, max).map((l) => {
        const c = labelColour(l);
        return (
          <span
            key={l}
            className="inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-px"
            style={{ backgroundColor: tint(c), color: c }}
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: c }}
            />
            <span className="truncate">{l}</span>
          </span>
        );
      })}
      {labels.length > max ? (
        <span className="px-1 py-px opacity-70">+{labels.length - max}</span>
      ) : null}
    </div>
  );
}

// A flagged card's mark (docs/specs/026-plan/items.md "Flags"), at the end of its title on every size.
export function FlagMark() {
  return (
    <span className="mt-0.5 shrink-0" role="img" aria-label="Flagged">
      <PlanTypeGlyph glyph="flag" size={13} color={FLAG_COLOUR} />
    </span>
  );
}
