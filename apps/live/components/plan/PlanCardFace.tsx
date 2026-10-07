'use client';

// One item's card face (docs/specs/026-plan/plan-board.md "What the board shows"), shared by the board's
// cards and the Plan card element, at the board's card size: Minimal (the title), Compact (the type's glyph and
// title over one row of pills) or Detailed (the type chip, number and priority signal; the title; the project;
// the description; custom fields; label chips; then a footer of pills and who has it). The type's colour fills
// the card's number (a dot on Minimal, which shows none); the card lifts a little under the pointer. Face-down while its board hides writing;
// ringed in someone's colour while they drag or read it. The parts live in plan-card-parts.tsx.
import {
  isFlagged,
  isPriority,
  itemAssignee,
  itemLabels,
  itemTitle,
  ITEM_TYPES,
  itemVoteTotal,
  typeIn,
  itemVotes,
  itemColourOf,
  cardFieldsAt,
  type CardField,
  type CardSize,
  type Item,
} from '@livediagram/items';
import { usePlan, type PlanCardPresence } from './PlanContext';
import { customFieldText } from './custom-field-text';
import { accentOn, type PlanPalette } from './plan-palette';
import { PersonDisc, PresenceTag } from './PersonDisc';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ColourDot } from './ColourSwatches';
import {
  ChecklistPill,
  CommentsPill,
  DuePill,
  FlagMark,
  KeyTag,
  LabelChips,
  MetaPill,
  PrioritySignal,
  StartPill,
  TypeChip,
  TypeDot,
  VoteControl,
  checklistProgress,
  type VotingProps,
} from './plan-card-parts';

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
  voting?: VotingProps;
};

// The card's frame: rounded, a hairline border and a soft shadow that deepens under the pointer.
const FRAME =
  'group/card relative flex h-full overflow-hidden rounded-xl border transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0';
const REST_SHADOW = '0 1px 2px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.04)';

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
        className="relative flex h-full min-h-14 items-center gap-2 overflow-hidden rounded-xl border px-3 py-2"
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
  // An item's own colour (docs/specs/026-plan/items.md "Colour"): a dot beside the type, never replacing it.
  const ownColour = itemColourOf(item);
  const parentColour = parent ? itemColourOf(parent) : undefined;
  const progress = checklistProgress(item);
  const votes = itemVoteTotal(item);
  const title = itemTitle(item) || 'Untitled';
  const flag = isFlagged(item) ? <FlagMark /> : null;
  const frame = {
    backgroundColor: palette.card,
    borderColor: palette.cardBorder,
    boxShadow: ring ?? REST_SHADOW,
    opacity: muted ? 0.7 : 1,
  };
  const presenceTag = presence ? <PresenceTag name={presence.name} color={presence.color} /> : null;
  const votesBit = voting ? (
    <VoteControl palette={palette} total={votes} voting={voting} />
  ) : show('votes') && votes > 0 ? (
    <MetaPill palette={palette} label={votes === 1 ? '1 vote' : `${votes} votes`}>
      <span aria-hidden>▲ {votes}</span>
    </MetaPill>
  ) : null;
  const commentsBit = show('comments') ? <CommentsPill item={item} palette={palette} /> : null;
  const avatar =
    show('assignee') && assignee ? (
      <span className="ml-auto shrink-0">
        <PersonDisc person={assignee} label={`Assigned to ${assignee.name}`} />
      </span>
    ) : null;
  // `lineHeight` matches the 20 px chips beside a Compact title, so its first line shares their middle.
  const titleText = (lines: 2 | 3, px: number, lineHeight?: number) => (
    <span
      className={`${lines === 2 ? 'line-clamp-2' : 'line-clamp-3'} min-w-0 flex-1 font-semibold ${lineHeight ? '' : 'leading-snug'}`}
      style={{
        color: palette.text,
        fontSize: px,
        ...(lineHeight ? { lineHeight: `${lineHeight}px` } : {}),
      }}
    >
      {title}
    </span>
  );

  // Minimal: the title alone, room to breathe (and the vote control on a voting board).
  if (size === 'minimal') {
    return (
      <div className={`${FRAME} items-center gap-2 px-3 py-2.5`} style={frame}>
        {presenceTag}
        <TypeDot accent={accent} />
        {titleText(2, 13)}
        {flag}
        {voting ? <VoteControl palette={palette} total={votes} voting={voting} /> : null}
      </div>
    );
  }

  // Compact: the type's glyph and the title (two lines at most) over one row of what matters at a glance.
  if (size === 'compact') {
    const pills =
      (show('priority') && isPriority(priority)) ||
      (show('due') && typeof due === 'string') ||
      (show('start') && typeof start === 'string') ||
      votesBit ||
      commentsBit ||
      (show('assignee') && assignee);
    return (
      <div className={`${FRAME} flex-col gap-1.5 px-3 py-2`} style={frame}>
        {presenceTag}
        <div className="flex items-start gap-1.5">
          {show('type') ? (
            <span className="flex">
              <TypeChip glyph={type.glyph} label={type.label} accent={accent} compact />
            </span>
          ) : null}
          {show('key') ? (
            <span className="flex">
              <KeyTag itemKey={item.key} accent={accent} />
            </span>
          ) : null}
          {ownColour ? <ColourDot colour={ownColour} className="mt-1.5" /> : null}
          {titleText(2, 13, 20)}
          {flag}
        </div>
        {pills ? (
          <div
            className="flex items-center gap-1.5 text-[11px] font-medium"
            style={{ color: palette.muted }}
          >
            {show('priority') && isPriority(priority) ? (
              <PrioritySignal priority={priority} />
            ) : null}
            {show('start') && typeof start === 'string' ? (
              <StartPill start={start} palette={palette} />
            ) : null}
            {show('due') && typeof due === 'string' ? (
              <DuePill due={due} done={!!muted} palette={palette} />
            ) : null}
            {votesBit}
            {commentsBit}
            {avatar}
          </div>
        ) : null}
      </div>
    );
  }

  // Detailed: everything the board shows, in reading order.
  // Custom fields marked Show on card, with a value (docs/specs/026-plan/item-types.md "An item type").
  const onCard = (type.custom ?? []).flatMap((f) => {
    const text = f.onCard ? customFieldText(f, item.fields[f.id], plan?.items) : null;
    // A Card field's value is drawn with the linked card's type glyph, in its colour.
    const linkedType =
      f.kind === 'card' && f.linkType ? typeIn(plan?.types ?? ITEM_TYPES, f.linkType) : undefined;
    return text ? [{ id: f.id, label: f.label, text, linkedType }] : [];
  });
  const head =
    show('key') || show('type') || !!ownColour || (show('priority') && isPriority(priority));
  const footer =
    (show('due') && typeof due === 'string') ||
    (show('start') && typeof start === 'string') ||
    (show('estimate') && typeof estimate === 'number') ||
    (show('checklist') && progress) ||
    votesBit ||
    (show('comments') && commentsBit) ||
    (show('assignee') && assignee);
  return (
    <div className={`${FRAME} flex-col gap-2 px-3 py-2.5`} style={frame}>
      {presenceTag}
      {head ? (
        <div
          className="flex items-center gap-1.5 text-[11px] font-medium"
          style={{ color: palette.muted }}
        >
          {show('type') ? <TypeChip glyph={type.glyph} label={type.label} accent={accent} /> : null}
          {show('key') ? <KeyTag itemKey={item.key} accent={accent} /> : null}
          {ownColour ? <ColourDot colour={ownColour} /> : null}
          {show('priority') && isPriority(priority) ? (
            <span className="ml-auto">
              <PrioritySignal priority={priority} label />
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-start gap-1.5">
        {titleText(3, 14)}
        {flag}
      </div>
      {show('parent') && parent ? (
        <div
          className="flex min-w-0 items-center gap-1 text-[11px] font-medium"
          style={{ color: palette.muted }}
        >
          {parentColour ? (
            <ColourDot colour={parentColour} />
          ) : (
            <PlanTypeGlyph glyph="project" size={11} />
          )}
          <span className="truncate">{itemTitle(parent)}</span>
        </div>
      ) : null}
      {show('description') && typeof description === 'string' && description.trim() ? (
        <p className="line-clamp-2 text-[12px] leading-snug" style={{ color: palette.muted }}>
          {description}
        </p>
      ) : null}
      {onCard.length > 0 ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
          {onCard.map((f) => (
            <div key={f.id} className="contents">
              <dt className="truncate" style={{ color: palette.muted }}>
                {f.label}
              </dt>
              <dd
                className="flex min-w-0 items-center gap-1 truncate font-medium"
                style={{ color: palette.text }}
              >
                {f.linkedType ? (
                  <PlanTypeGlyph
                    glyph={f.linkedType.glyph}
                    size={11}
                    color={accentOn(f.linkedType.color, palette)}
                  />
                ) : null}
                {f.text}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {show('labels') && labels.length > 0 ? <LabelChips labels={labels} /> : null}
      {footer ? (
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-0.5 text-[11px] font-medium">
          {show('start') && typeof start === 'string' ? (
            <StartPill start={start} palette={palette} />
          ) : null}
          {show('due') && typeof due === 'string' ? (
            <DuePill due={due} done={!!muted} palette={palette} />
          ) : null}
          {show('estimate') && typeof estimate === 'number' ? (
            <MetaPill palette={palette} label={`Estimate ${estimate}`}>
              <PlanTypeGlyph glyph="cube" size={11} />
              <span aria-hidden>{estimate}</span>
            </MetaPill>
          ) : null}
          {show('checklist') && progress ? (
            <ChecklistPill progress={progress} palette={palette} />
          ) : null}
          {commentsBit}
          {votesBit}
          {avatar}
        </div>
      ) : null}
    </div>
  );
}

export function myVotes(item: Item, personId: string | undefined): number {
  return personId ? (itemVotes(item)[personId] ?? 0) : 0;
}
