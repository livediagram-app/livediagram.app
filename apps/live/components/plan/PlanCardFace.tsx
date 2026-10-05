'use client';

// One item's card face (docs/specs/025-plan/plan-board.md "What the board shows"), shared by the board's
// cards and the Plan card element: the type stripe and glyph, the key, the title up to three lines,
// then the fields the board shows. Face-down while its board hides writing; ringed in someone's
// colour while they drag or read it.
import {
  PRIORITY_LABELS,
  isPriority,
  itemAssignee,
  itemLabels,
  itemTitle,
  itemTypeOf,
  itemVoteTotal,
  itemVotes,
  type CardField,
  type Item,
} from '@livediagram/items';
import type { PlanCardPresence } from './PlanContext';
import { initialsOf, PRIORITY_COLOURS, type PlanPalette } from './plan-palette';
import { PlanTypeGlyph } from './plan-type-glyph';

export type PlanCardFaceProps = {
  item: Item;
  palette: PlanPalette;
  fields: readonly CardField[];
  faceDown?: boolean;
  muted?: boolean;
  presence?: PlanCardPresence;
  // Voting on the card's board: the viewer's own count, and whether they may vote.
  voting?: {
    mine: number;
    canVote: boolean;
    budgetLeft: number | null;
    onVote: (delta: 1 | -1) => void;
  };
};

function checklistProgress(item: Item): { done: number; total: number } | null {
  const rows = item.fields['checklist'];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const done = rows.filter(
    (r) => !!r && typeof r === 'object' && (r as { done?: unknown }).done === true,
  ).length;
  return { done, total: rows.length };
}

function dueLabel(due: string): string {
  const d = new Date(`${due}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? due
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function PlanCardFace({
  item,
  palette,
  fields,
  faceDown,
  muted,
  presence,
  voting,
}: PlanCardFaceProps) {
  const type = itemTypeOf(item.type);
  const show = (f: CardField) => fields.includes(f);
  const ring = presence ? `0 0 0 2px ${presence.color}` : undefined;
  if (faceDown) {
    return (
      <div
        className="relative flex h-full min-h-14 items-center gap-2 overflow-hidden rounded-lg border px-3 py-2"
        style={{
          backgroundColor: palette.card,
          borderColor: palette.cardBorder,
          boxShadow: ring,
          backgroundImage: `repeating-linear-gradient(135deg, ${item.createdBy.color}22 0 6px, transparent 6px 12px)`,
        }}
      >
        <span
          className="h-5 w-5 shrink-0 rounded-full"
          style={{ backgroundColor: item.createdBy.color }}
          aria-hidden
        />
        <span className="text-[12px] italic" style={{ color: palette.muted }}>
          Hidden until reveal
        </span>
      </div>
    );
  }
  const assignee = itemAssignee(item);
  const priority = item.fields['priority'];
  const labels = itemLabels(item);
  const estimate = item.fields['estimate'];
  const due = item.fields['due'];
  const progress = checklistProgress(item);
  const votes = itemVoteTotal(item);
  const chips =
    (show('priority') && isPriority(priority)) ||
    (show('labels') && labels.length > 0) ||
    (show('estimate') && typeof estimate === 'number') ||
    (show('due') && typeof due === 'string') ||
    (show('checklist') && progress) ||
    (show('assignee') && assignee) ||
    voting ||
    (show('votes') && votes > 0);
  return (
    <div
      className="relative flex h-full flex-col gap-1.5 overflow-hidden rounded-lg border py-2 pl-3.5 pr-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
      style={{
        backgroundColor: palette.card,
        borderColor: palette.cardBorder,
        boxShadow: ring,
        opacity: muted ? 0.7 : 1,
      }}
    >
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: type.color }}
        aria-hidden
      />
      {presence ? (
        <span
          className="absolute -top-px right-2 rounded-b px-1.5 text-[10px] font-semibold text-white"
          style={{ backgroundColor: presence.color }}
        >
          {presence.name.split(/\s+/)[0]}
        </span>
      ) : null}
      {show('key') || show('type') ? (
        <div
          className="flex items-center gap-1.5 text-[11px] font-medium"
          style={{ color: palette.muted }}
        >
          {show('type') ? <PlanTypeGlyph type={item.type} color={type.color} /> : null}
          {show('key') ? <span>#{item.key}</span> : null}
          {show('type') ? <span>{type.label}</span> : null}
        </div>
      ) : null}
      <div
        className="line-clamp-3 text-[14px] font-semibold leading-snug"
        style={{ color: palette.text, textDecoration: muted ? 'none' : undefined }}
      >
        {itemTitle(item) || 'Untitled'}
      </div>
      {chips ? (
        <div
          className="mt-auto flex flex-wrap items-center gap-1.5 text-[11px]"
          style={{ color: palette.muted }}
        >
          {show('priority') && isPriority(priority) ? (
            <span className="inline-flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: PRIORITY_COLOURS[priority] }}
                aria-hidden
              />
              {PRIORITY_LABELS[priority]}
            </span>
          ) : null}
          {show('labels')
            ? labels.slice(0, 3).map((l) => (
                <span
                  key={l}
                  className="rounded px-1.5 py-px"
                  style={{ backgroundColor: palette.column, color: palette.text }}
                >
                  {l}
                </span>
              ))
            : null}
          {show('estimate') && typeof estimate === 'number' ? (
            <span
              className="rounded-full border px-1.5"
              style={{ borderColor: palette.cardBorder }}
            >
              {estimate}
            </span>
          ) : null}
          {show('due') && typeof due === 'string' ? <span>Due {dueLabel(due)}</span> : null}
          {show('checklist') && progress ? (
            <span>
              {progress.done}/{progress.total}
            </span>
          ) : null}
          {voting ? (
            <VoteControl palette={palette} total={votes} voting={voting} />
          ) : show('votes') && votes > 0 ? (
            <span>▲ {votes}</span>
          ) : null}
          {show('assignee') && assignee ? (
            <span
              className="ml-auto flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ backgroundColor: assignee.color }}
              aria-label={`Assigned to ${assignee.name}`}
            >
              {initialsOf(assignee.name)}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// The vote control: your votes, the total, plus and minus. Presses never reach the canvas or the card.
function VoteControl({
  palette,
  total,
  voting,
}: {
  palette: PlanPalette;
  total: number;
  voting: NonNullable<PlanCardFaceProps['voting']>;
}) {
  const canAdd = voting.canVote && (voting.budgetLeft === null || voting.budgetLeft > 0);
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return (
    <span
      className="inline-flex items-center overflow-hidden rounded-full border"
      style={{ borderColor: palette.cardBorder }}
      onPointerDown={stop}
    >
      <button
        type="button"
        className="px-1.5 disabled:opacity-40 enabled:cursor-pointer"
        aria-label="Take back a vote"
        disabled={!voting.canVote || voting.mine === 0}
        onClick={(e) => {
          stop(e);
          voting.onVote(-1);
        }}
      >
        −
      </button>
      <span
        className="px-1 font-semibold tabular-nums"
        style={{ color: voting.mine > 0 ? palette.focus : palette.muted }}
        aria-label={`${total} votes, ${voting.mine} yours`}
      >
        {total}
      </span>
      <button
        type="button"
        className="px-1.5 disabled:opacity-40 enabled:cursor-pointer"
        aria-label="Vote for this"
        disabled={!canAdd}
        onClick={(e) => {
          stop(e);
          voting.onVote(1);
        }}
      >
        +
      </button>
    </span>
  );
}

export function myVotes(item: Item, personId: string | undefined): number {
  return personId ? (itemVotes(item)[personId] ?? 0) : 0;
}
