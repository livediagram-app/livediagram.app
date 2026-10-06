'use client';

// One item's card face (docs/specs/026-plan/plan-board.md "What the board shows"), shared by the board's
// cards and the Plan card element, at the board's card size: Minimal (the title), Compact (the title over
// one line of number, priority, due, votes and assignee) or Detailed (type and priority, title, project,
// description, custom fields, labels, checklist progress, then due, estimate, votes, comments and who has it).
// Face-down while its board hides writing; ringed in someone's colour while they drag or read it.
import {
  PRIORITY_LABELS,
  isFlagged,
  isPriority,
  itemAssignee,
  itemLabels,
  itemTitle,
  ITEM_TYPES,
  itemVoteTotal,
  itemCommentCount,
  typeIn,
  itemVotes,
  cardFieldsAt,
  type CardField,
  type CardSize,
  type Priority,
  type Item,
} from '@livediagram/items';
import { CommentIcon } from '@livediagram/ui';
import { usePlan, type PlanCardPresence } from './PlanContext';
import { customFieldText } from './custom-field-text';
import { PRIORITY_COLOURS, accentOn, type PlanPalette } from './plan-palette';
import { PersonDisc, PresenceTag } from './PersonDisc';
import { PlanTypeGlyph } from './plan-type-glyph';
import { FLAG_COLOUR } from './item-flag';

export type PlanCardFaceProps = {
  item: Item;
  palette: PlanPalette;
  fields: readonly CardField[];
  // The board's card size (docs/specs/026-plan/plan-board.md "The board set-up"); a Plan card is Detailed.
  size?: CardSize;
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

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// A due date in red once it has passed (unless the card is done), muted otherwise.
function DueTag({ due, done, palette }: { due: string; done: boolean; palette: PlanPalette }) {
  const late = !done && due < today();
  return (
    <span
      className="inline-flex items-center gap-1"
      style={{ color: late ? '#dc2626' : palette.muted, fontWeight: late ? 600 : undefined }}
    >
      <PlanTypeGlyph glyph="calendar" size={11} />
      {dueLabel(due)}
    </span>
  );
}

// When the work begins, muted: only a due date turns red.
function StartTag({ start, palette }: { start: string; palette: PlanPalette }) {
  return (
    <span className="inline-flex items-center gap-1" style={{ color: palette.muted }}>
      From {dueLabel(start)}
    </span>
  );
}

// A flagged card's mark (docs/specs/026-plan/items.md "Flags"), at the end of its title on every size.
function FlagMark() {
  return (
    <span className="mt-0.5 shrink-0" role="img" aria-label="Flagged">
      <PlanTypeGlyph glyph="flag" size={13} color={FLAG_COLOUR} />
    </span>
  );
}

function PriorityDot({ priority, label }: { priority: Priority; label?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: PRIORITY_COLOURS[priority] }}
        aria-hidden={label}
        aria-label={label ? undefined : `${PRIORITY_LABELS[priority]} priority`}
      />
      {label ? PRIORITY_LABELS[priority] : null}
    </span>
  );
}

export function PlanCardFace({
  item,
  palette,
  fields,
  size = 'detailed',
  faceDown,
  muted,
  presence,
  voting,
}: PlanCardFaceProps) {
  const plan = usePlan();
  const type = typeIn(plan?.types ?? ITEM_TYPES, item.type);
  // Lifted on a dark card, so Project's black still shows.
  const accent = accentOn(type.color, palette);
  const shown = cardFieldsAt(size, fields);
  const show = (f: CardField) => shown.includes(f);
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
  const start = item.fields['start'];
  const description = item.fields['description'];
  const parentId = item.fields['parent'];
  const parent = typeof parentId === 'string' ? plan?.items.get(parentId) : undefined;
  const progress = checklistProgress(item);
  const votes = itemVoteTotal(item);
  const title = itemTitle(item) || 'Untitled';
  const flag = isFlagged(item) ? <FlagMark /> : null;
  const frame = {
    backgroundColor: palette.card,
    borderColor: palette.cardBorder,
    boxShadow: ring ?? '0 1px 2px rgba(15,23,42,0.06)',
    opacity: muted ? 0.7 : 1,
  };
  const stripe = (
    <span
      className="absolute inset-y-0 left-0 w-1"
      style={{ backgroundColor: accent }}
      aria-hidden
    />
  );
  // How many comments an open thread holds (docs/specs/026-plan/items.md "Comments"); nothing at none.
  const commentCount = itemCommentCount(item);
  const commentsBit =
    show('comments') && commentCount > 0 ? (
      <span
        className="inline-flex shrink-0 items-center gap-0.5 tabular-nums"
        aria-label={commentCount === 1 ? '1 comment' : `${commentCount} comments`}
      >
        <CommentIcon size={11} />
        {commentCount}
      </span>
    ) : null;
  const votesBit = voting ? (
    <VoteControl palette={palette} total={votes} voting={voting} />
  ) : show('votes') && votes > 0 ? (
    <span className="shrink-0">▲ {votes}</span>
  ) : null;

  // Minimal: the title alone, room to breathe (and the vote control on a voting board).
  if (size === 'minimal') {
    return (
      <div
        className="relative flex h-full items-center gap-2 overflow-hidden rounded-lg border py-2.5 pl-3.5 pr-2.5"
        style={frame}
      >
        {stripe}
        {presence ? <PresenceTag name={presence.name} color={presence.color} /> : null}
        <span
          className="line-clamp-2 min-w-0 flex-1 text-[13px] font-semibold leading-snug"
          style={{ color: palette.text }}
        >
          {title}
        </span>
        {flag}
        {voting ? <VoteControl palette={palette} total={votes} voting={voting} /> : null}
      </div>
    );
  }

  // Compact: the title (two lines at most) over one line of what matters at a glance.
  if (size === 'compact') {
    const meta =
      show('key') ||
      (show('priority') && isPriority(priority)) ||
      (show('due') && typeof due === 'string') ||
      (show('start') && typeof start === 'string') ||
      votesBit ||
      commentsBit ||
      (show('assignee') && assignee);
    return (
      <div
        className="relative flex h-full flex-col gap-1 overflow-hidden rounded-lg border py-2 pl-3.5 pr-2.5"
        style={frame}
      >
        {stripe}
        {presence ? <PresenceTag name={presence.name} color={presence.color} /> : null}
        <div className="flex items-start gap-1.5">
          {show('type') ? (
            <span className="mt-0.5 shrink-0">
              <PlanTypeGlyph glyph={type.glyph} color={accent} />
            </span>
          ) : null}
          <span
            className="line-clamp-2 min-w-0 flex-1 text-[13px] font-semibold leading-snug"
            style={{ color: palette.text }}
          >
            {title}
          </span>
          {flag}
        </div>
        {meta ? (
          <div
            className="flex items-center gap-2 text-[11px] font-medium"
            style={{ color: palette.muted }}
          >
            {show('key') ? <span className="tabular-nums">#{item.key}</span> : null}
            {show('priority') && isPriority(priority) ? <PriorityDot priority={priority} /> : null}
            {show('start') && typeof start === 'string' ? (
              <StartTag start={start} palette={palette} />
            ) : null}
            {show('due') && typeof due === 'string' ? (
              <DueTag due={due} done={!!muted} palette={palette} />
            ) : null}
            {votesBit}
            {commentsBit}
            {show('assignee') && assignee ? (
              <span className="ml-auto">
                <PersonDisc person={assignee} label={`Assigned to ${assignee.name}`} />
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  // Detailed: everything the board shows, in reading order.
  // Custom fields marked Show on card, with a value (docs/specs/026-plan/item-types.md "An item type").
  const onCard = (type.custom ?? []).flatMap((f) => {
    const text = f.onCard ? customFieldText(f, item.fields[f.id]) : null;
    return text ? [{ id: f.id, label: f.label, text }] : [];
  });
  const footer =
    (show('due') && typeof due === 'string') ||
    (show('start') && typeof start === 'string') ||
    (show('estimate') && typeof estimate === 'number') ||
    votesBit ||
    commentsBit ||
    (show('assignee') && assignee);
  return (
    <div
      className="relative flex h-full flex-col gap-2 overflow-hidden rounded-lg border py-2.5 pl-4 pr-3"
      style={frame}
    >
      {stripe}
      {presence ? <PresenceTag name={presence.name} color={presence.color} /> : null}
      {show('key') || show('type') || (show('priority') && isPriority(priority)) ? (
        <div
          className="flex items-center gap-1.5 text-[11px] font-medium"
          style={{ color: palette.muted }}
        >
          {show('type') ? <PlanTypeGlyph glyph={type.glyph} color={accent} /> : null}
          {show('type') ? <span style={{ color: accent }}>{type.label}</span> : null}
          {show('key') ? <span className="tabular-nums">#{item.key}</span> : null}
          {show('priority') && isPriority(priority) ? (
            <span
              className="ml-auto rounded-full px-1.5 py-px"
              style={{ backgroundColor: `${PRIORITY_COLOURS[priority]}1f`, color: palette.text }}
            >
              <PriorityDot priority={priority} label />
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-start gap-1.5">
        <div
          className="line-clamp-3 min-w-0 flex-1 text-[14px] font-semibold leading-snug"
          style={{ color: palette.text }}
        >
          {title}
        </div>
        {flag}
      </div>
      {show('parent') && parent ? (
        <div
          className="flex items-center gap-1 truncate text-[11px]"
          style={{ color: palette.muted }}
        >
          <PlanTypeGlyph glyph="project" size={11} />
          <span className="truncate">{itemTitle(parent)}</span>
        </div>
      ) : null}
      {show('description') && typeof description === 'string' && description.trim() ? (
        <p className="line-clamp-2 text-[12px] leading-snug" style={{ color: palette.muted }}>
          {description}
        </p>
      ) : null}
      {onCard.length > 0 ? (
        <div className="flex flex-col gap-0.5 text-[11px]" style={{ color: palette.muted }}>
          {onCard.map((f) => (
            <div key={f.id} className="truncate">
              <span className="font-medium">{f.label}:</span>{' '}
              <span style={{ color: palette.text }}>{f.text}</span>
            </div>
          ))}
        </div>
      ) : null}
      {show('labels') && labels.length > 0 ? (
        <div className="flex flex-wrap gap-1 text-[11px]">
          {labels.slice(0, 4).map((l) => (
            <span
              key={l}
              className="rounded px-1.5 py-px"
              style={{ backgroundColor: palette.column, color: palette.text }}
            >
              {l}
            </span>
          ))}
        </div>
      ) : null}
      {show('checklist') && progress ? (
        <div className="flex items-center gap-2 text-[11px]" style={{ color: palette.muted }}>
          <span
            className="h-1.5 flex-1 overflow-hidden rounded-full"
            style={{ backgroundColor: palette.column }}
            aria-hidden
          >
            <span
              className="block h-full rounded-full"
              style={{
                width: `${(progress.done / progress.total) * 100}%`,
                backgroundColor: progress.done === progress.total ? '#16a34a' : accent,
              }}
            />
          </span>
          <span className="tabular-nums">
            {progress.done}/{progress.total}
          </span>
        </div>
      ) : null}
      {footer ? (
        <div
          className="mt-auto flex items-center gap-2.5 border-t pt-2 text-[11px] font-medium"
          style={{ color: palette.muted, borderColor: palette.cardBorder }}
        >
          {show('start') && typeof start === 'string' ? (
            <StartTag start={start} palette={palette} />
          ) : null}
          {show('due') && typeof due === 'string' ? (
            <DueTag due={due} done={!!muted} palette={palette} />
          ) : null}
          {show('estimate') && typeof estimate === 'number' ? (
            <span
              className="rounded-full border px-1.5 tabular-nums"
              style={{ borderColor: palette.cardBorder }}
              aria-label={`Estimate ${estimate}`}
            >
              {estimate}
            </span>
          ) : null}
          {votesBit}
          {commentsBit}
          {show('assignee') && assignee ? (
            <span className="ml-auto inline-flex min-w-0 items-center gap-1.5">
              <span className="truncate" style={{ color: palette.text }}>
                {assignee.name.split(' ')[0]}
              </span>
              <PersonDisc person={assignee} label={`Assigned to ${assignee.name}`} />
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
