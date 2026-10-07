'use client';

import type { ReactNode } from 'react';
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
  typeCardDisplay,
  type ItemTypeDef,
  typeCardLayout,
  cardLayoutFields,
  type CardSlot,
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
  // A type to draw it as instead of the catalogue's (the type editor's Display preview, a draft not yet saved).
  typeOverride?: ItemTypeDef;
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
  typeOverride,
}: PlanCardFaceProps) {
  const plan = usePlan();
  const type = typeOverride ?? typeIn(plan?.types ?? ITEM_TYPES, item.type);
  // Lifted on a dark card, so Project's black still shows.
  const accent = accentOn(type.color, palette);
  // What the board shows at this size, and what the card's type shows (docs/specs/026-plan/item-types.md "Card
  // display"): both must allow a field.
  const typeShows = typeCardDisplay(type, size);
  const shown = cardFieldsAt(size, fields).filter((f) => typeShows.includes(f));
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
  // One field's bit, as it draws in a row (a pill, a chip, a disc); null when the card has nothing for it. `big`
  // is a Detailed header's larger chips.
  const pill = (f: CardField, big = false): ReactNode => {
    switch (f) {
      case 'key':
        return <KeyTag key={f} itemKey={item.key} accent={accent} />;
      case 'type':
        return (
          <TypeChip key={f} glyph={type.glyph} label={type.label} accent={accent} compact={!big} />
        );
      case 'priority':
        return isPriority(priority) ? (
          <PrioritySignal key={f} priority={priority} label={big} />
        ) : null;
      case 'start':
        return typeof start === 'string' ? (
          <StartPill key={f} start={start} palette={palette} />
        ) : null;
      case 'due':
        return typeof due === 'string' ? (
          <DuePill key={f} due={due} done={!!muted} palette={palette} />
        ) : null;
      case 'estimate':
        return typeof estimate === 'number' ? (
          <MetaPill key={f} palette={palette} label={`Estimate ${estimate}`}>
            <PlanTypeGlyph glyph="cube" size={11} />
            <span aria-hidden>{estimate}</span>
          </MetaPill>
        ) : null;
      case 'checklist':
        return progress ? <ChecklistPill key={f} progress={progress} palette={palette} /> : null;
      case 'comments':
        return <CommentsPill key={f} item={item} palette={palette} />;
      case 'votes':
        return voting ? (
          <VoteControl key={f} palette={palette} total={votes} voting={voting} />
        ) : votes > 0 ? (
          <MetaPill key={f} palette={palette} label={votes === 1 ? '1 vote' : `${votes} votes`}>
            <span aria-hidden>▲ {votes}</span>
          </MetaPill>
        ) : null;
      case 'assignee':
        return assignee ? (
          <PersonDisc key={f} person={assignee} label={`Assigned to ${assignee.name}`} />
        ) : null;
      case 'labels':
        return labels.length > 0 ? <LabelChips key={f} labels={labels} /> : null;
      case 'parent':
        return parent ? (
          <span key={f} className="flex min-w-0 items-center gap-1">
            {parentColour ? (
              <ColourDot colour={parentColour} />
            ) : (
              <PlanTypeGlyph glyph="project" size={11} />
            )}
            <span className="truncate">{itemTitle(parent)}</span>
          </span>
        ) : null;
      case 'description':
        return typeof description === 'string' && description.trim() ? (
          <p
            key={f}
            className="line-clamp-2 w-full text-[12px] leading-snug"
            style={{ color: palette.muted }}
          >
            {description}
          </p>
        ) : null;
    }
  };
  // A slot's bits, in its order, of the fields this card shows there (docs/specs/026-plan/item-types.md "Card
  // display"). A voting board's vote control always shows, at the end of the last row, when Votes has no slot.
  const layout = typeCardLayout(type, size);
  const slotBits = (slot: CardSlot, big = false) =>
    (layout[slot] ?? [])
      .filter(show)
      .map((f) => pill(f, big))
      .filter(Boolean);
  const votePlaced = cardLayoutFields(size, layout).some((f) => f === 'votes' && show(f));
  const loneVote =
    voting && !votePlaced ? <VoteControl palette={palette} total={votes} voting={voting} /> : null;
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

  // Minimal: one line, the title between its Before and After slots (and the vote control on a voting board).
  if (size === 'minimal') {
    return (
      <div className={`${FRAME} items-center gap-2 px-3 py-2.5`} style={frame}>
        {presenceTag}
        <TypeDot accent={accent} />
        {slotBits('lead')}
        {titleText(2, 13)}
        {flag}
        <span
          className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium"
          style={{ color: palette.muted }}
        >
          {slotBits('trail')}
          {loneVote}
        </span>
      </div>
    );
  }

  // Compact: the title with its Beside slot, over one row (Below the Title).
  if (size === 'compact') {
    const row = slotBits('row');
    return (
      <div className={`${FRAME} flex-col gap-1.5 px-3 py-2`} style={frame}>
        {presenceTag}
        <div className="flex items-start gap-1.5">
          {slotBits('lead').map((bit, i) => (
            <span key={i} className="flex">
              {bit}
            </span>
          ))}
          {ownColour ? <ColourDot colour={ownColour} className="mt-1.5" /> : null}
          {titleText(2, 13, 20)}
          {flag}
        </div>
        {row.length || loneVote ? (
          <div
            className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium"
            style={{ color: palette.muted }}
          >
            {row}
            {loneVote}
          </div>
        ) : null}
      </div>
    );
  }

  // Detailed: a header (start and end), the title, what sits under it, the type's on-card custom fields, a footer.
  // Custom fields marked Show on card, with a value (docs/specs/026-plan/item-types.md "An item type").
  const onCard = (type.custom ?? []).flatMap((f) => {
    const text = f.onCard ? customFieldText(f, item.fields[f.id], plan?.items) : null;
    // A Card field's value is drawn with the linked card's type glyph, in its colour.
    const linkedType =
      f.kind === 'card' && f.linkType ? typeIn(plan?.types ?? ITEM_TYPES, f.linkType) : undefined;
    return text ? [{ id: f.id, label: f.label, text, linkedType }] : [];
  });
  const head = slotBits('head', true);
  const headEnd = slotBits('headEnd', true);
  const body = slotBits('body');
  const foot = slotBits('foot');
  return (
    <div className={`${FRAME} flex-col gap-2 px-3 py-2.5`} style={frame}>
      {presenceTag}
      {head.length || headEnd.length || ownColour ? (
        <div
          className="flex items-center gap-1.5 text-[11px] font-medium"
          style={{ color: palette.muted }}
        >
          {head}
          {ownColour ? <ColourDot colour={ownColour} /> : null}
          {headEnd.length ? (
            <span className="ml-auto flex items-center gap-1.5">{headEnd}</span>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-start gap-1.5">
        {titleText(3, 14)}
        {flag}
      </div>
      {body.length ? (
        <div
          className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-medium"
          style={{ color: palette.muted }}
        >
          {body}
        </div>
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
      {foot.length || loneVote ? (
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-0.5 text-[11px] font-medium">
          {foot}
          {loneVote}
        </div>
      ) : null}
    </div>
  );
}

export function myVotes(item: Item, personId: string | undefined): number {
  return personId ? (itemVotes(item)[personId] ?? 0) : 0;
}
