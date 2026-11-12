'use client';

import { useMemo, type ReactNode } from 'react';
// One item's card face (docs/specs/026-plan/plan-board.md "What the board shows"), shared by the board's
// cards and the Plan card element, at the board's card size: Minimal (the title) or Detailed (the type chip,
// number and priority signal; the title; the project; the description; custom fields; label chips; then a footer
// of pills and who has it). The type's colour fills
// the card's number (a dot on Minimal, which shows none); the card lifts a little under the pointer. Face-down while its board hides writing;
// ringed in someone's colour while they drag or read it. The parts live in plan-card-parts.tsx, a custom field's
// bit in card-face-custom-bit.tsx.
import { NewResponseMark } from '@/components/forms/NewResponseMark';
import { useFreshResponse } from '@/components/forms/fresh-responses';
import {
  isFlagged,
  hasRepeat,
  isPriority,
  itemAssignee,
  itemStatus,
  itemLabels,
  itemTitle,
  ITEM_TYPES,
  itemVoteTotal,
  typeIn,
  itemColourOf,
  cardFieldsAt,
  fieldCardIds,
  type CardField,
  type CardSize,
  type Item,
  typeCardDisplay,
  type ItemTypeDef,
  typeCardLayout,
  type CardSlot,
  isCustomCardField,
  isNewerField,
  attachmentCover,
  itemAttachments,
  itemHasStamp,
  runningOnCard,
  typeFieldLabel,
  hasBlocksFields,
  type FormulaOutcome,
  parsePullRequestUrl,
  pullRequestKey,
} from '@liveplanner/items';
import { useCardPullRequests } from './pull-request-store';
import { PullRequestMarks, PullRequestPill } from './PullRequestPill';
import { RunningTimerPill } from './time/TimerReadouts';
import { PLAN_HEADING_STYLE, planTextPx } from '@/lib/plan-font';
import type { PlanCardPresence } from './PlanContext';
import { usePlanCard } from './PlanCardContext';
import { sameEntries, usePlanItemsSelect } from './plan-items-store';
import { planBlocking } from './blocking';
import { calculatedFieldOutcome } from './calculated-values';
import { accentOn, chipInkOn, type PlanPalette } from './plan-palette';
import { PersonDisc, PresenceTag } from './PersonDisc';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ColourDot } from './ColourSwatches';
import { AttachmentsPill, CardCover } from './CardCover';
import { AgePill } from './card-age';
import { StampBit } from './card-stamps';
import {
  ChecklistPill,
  CommentsPill,
  DuePill,
  BlockedMark,
  FlagMark,
  RepeatMark,
  KeyTag,
  LabelChips,
  MetaPill,
  PrioritySignal,
  StartPill,
  TypeChip,
  TypeDot,
  VotesPill,
  checklistProgress,
} from './plan-card-parts';
import { customFieldBit } from './card-face-custom-bit';

type PlanCardFaceProps = {
  item: Item;
  palette: PlanPalette;
  fields: readonly CardField[];
  // The board's card size (docs/specs/026-plan/plan-board.md "The board set-up"); a Plan card is Detailed.
  size?: CardSize;
  faceDown?: boolean;
  muted?: boolean;
  presence?: PlanCardPresence;
  // A type to draw it as instead of the catalogue's (the type editor's Display preview, a draft not yet saved).
  typeOverride?: ItemTypeDef;
  // The type editor's Display (docs/specs/026-plan/item-types.md "Editing a type"): the card drawn as its own layout
  // editor. Each slot is drawn even when empty, through `slot` (a dotted box to drop into), and each field's bit
  // through `bit` (a chip that drags and comes off).
  edit?: CardFaceEdit;
  // A slot board's narrow column (docs/specs/026-plan/plan-tabs.md "A board in a slot is simplified"): a Minimal card's
  // title on its own lines, full width, and its bits in a row under it rather than beside it.
  stacked?: boolean;
  // A control at the far end of a Detailed card's header row, inside the card (the Cards panel's ⋯,
  // docs/specs/026-plan/items.md "Finding a card"); the row is drawn for it even when the card has no header bits.
  headAction?: ReactNode;
};

export type CardFaceEdit = {
  slot: (slot: CardSlot, bits: ReactNode[]) => ReactNode;
  bit: (field: CardField, node: ReactNode) => ReactNode;
};

// The title in the tab's face (docs/specs/004-interface-design/fonts.md "On boards and cards"); the rest of the face
// keeps the board's UI face. `contents`, so the title stays the row's flex item.
const cardHeading = (title: ReactNode) => (
  <span className="contents" style={PLAN_HEADING_STYLE}>
    {title}
  </span>
);

// The card's frame: rounded, a hairline border and a soft shadow (globals.css .plan-card, from the --card-* the frame
// sets).
const FRAME =
  'plan-card group/card relative flex h-full overflow-hidden rounded-[var(--plan-card-r,12px)] border';
// Marker outlines every card, a Minimal one included (shorter than a frame's least size; face-finish-marks.ts).
const FRAME_MARK = { 'data-marker-frame': '' };
// The lift under the pointer. Left off a face that carries a headAction: its host draws the hover, since a transform
// would make the face a stacking context and sink the action under the host's own press target.
// Under the pointer (docs/specs/026-plan/plan-board.md "Card hover"): it rises onto a shadow in its type's colour, its edge
// leans to that colour and a soft light follows the pointer (globals.css .plan-card-hover, useCardSpotlight).
const LIFT = 'plan-card-hover';
const NO_CARDS: readonly (Item | undefined)[] = [];
const NO_OUTCOMES: readonly FormulaOutcome[] = [];
// Two Calculated values alike: the same answer, or the same problem.
const sameOutcomes = (a: readonly FormulaOutcome[], b: readonly FormulaOutcome[]) =>
  a.length === b.length &&
  a.every((x, i) => {
    const y = b[i]!;
    return x.ok ? y.ok && Object.is(x.value, y.value) : !y.ok && x.error === y.error;
  });
const REST_SHADOW = '0 1px 2px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.04)';

export function PlanCardFace({
  item,
  palette,
  fields,
  size = 'detailed',
  faceDown,
  muted,
  presence,
  typeOverride,
  edit,
  stacked = false,
  headAction,
}: PlanCardFaceProps) {
  const plan = usePlanCard();
  const type = typeOverride ?? typeIn(plan?.types ?? ITEM_TYPES, item.type);
  // Leaned until it reads on the card: Project's black on a dark card, Idea's yellow on a light one.
  const accent = accentOn(type.color, palette);
  // What the board shows at this size, and what the card's type shows (docs/specs/026-plan/item-types.md "Card
  // display"): both must allow a field.
  const typeShows = typeCardDisplay(type, size);
  const shown = cardFieldsAt(size, fields).filter((f) => typeShows.includes(f));
  // A custom field shows wherever the type's Display places it (the board's field list names built-ins only).
  const show = (f: CardField) => (isCustomCardField(f) ? typeShows.includes(f) : shown.includes(f));
  // What the face reads of other cards (plan-items-store.ts): the cards its Card fields link to, its Calculated
  // fields' values and its open blockers, each picked so a change to any other card never redraws it.
  const shownDefs = (type.custom ?? []).filter((c) => typeShows.includes(c.id as CardField));
  const linkIds = shownDefs.flatMap((def) =>
    def.kind === 'card' ? fieldCardIds(def, item.fields[def.id]) : [],
  );
  const calcDefs = shownDefs.filter((def) => def.kind === 'calculated');
  const linkedCards = usePlanItemsSelect(
    (all) => (linkIds.length ? linkIds.map((id) => all.get(id)) : NO_CARDS),
    sameEntries,
    [item, type],
  );
  const items = useMemo(() => {
    const m = new Map<string, Item>();
    for (const card of linkedCards) if (card) m.set(card.id, card);
    return m;
  }, [linkedCards]);
  const outcomes = usePlanItemsSelect(
    (all) =>
      plan && calcDefs.length
        ? calcDefs.map((def) => calculatedFieldOutcome({ ...plan, items: all }, def, item, type))
        : NO_OUTCOMES,
    sameOutcomes,
    [item, type, plan?.types, plan?.statusPhases],
  );
  const reads = !!plan && !edit && hasBlocksFields(plan.types);
  const blocked = usePlanItemsSelect(
    (all) => (reads ? (planBlocking({ ...plan, items: all }).open.get(item.id) ?? 0) : 0),
    Object.is,
    [item.id, reads, plan?.types, plan?.statusPhases],
  );
  // Its linked pull requests' states (pull-request-store.ts), picked so a delivery redraws only the cards it touches.
  const prs = useCardPullRequests(item, type);
  const ring = presence ? `0 0 0 2px ${presence.color}` : undefined;
  // A response's card is New until opened (docs/specs/030-forms/forms.md "Hearing about responses").
  const fresh = useFreshResponse(item);
  // While anyone's timer runs on the card it shows, at every size, whatever the Display (docs/specs/026-plan/
  // item-types.md "Time Spent"); never on the Display's example card.
  const runs = edit ? null : runningOnCard(item, type);
  const running = runs ? (
    <RunningTimerPill people={runs.people} start={runs.start} border={palette.cardBorder} />
  ) : null;
  if (faceDown) {
    return (
      <div
        className="relative flex h-full min-h-14 items-center gap-2 overflow-hidden rounded-[var(--plan-card-r,12px)] border px-3 py-2"
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
        <span
          className="text-[length:calc(12px*var(--plan-text-scale,1))] italic"
          style={{ color: palette.muted }}
        >
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
  // An item's own colour (docs/specs/026-plan/items.md "Colour"): a dot beside the type, never replacing it.
  const ownColour = itemColourOf(item, type);
  const progress = checklistProgress(item);
  const votes = itemVoteTotal(item);
  const title = itemTitle(item) || 'Untitled';
  // A slot's fields, in its order (docs/specs/026-plan/item-types.md "Card display").
  const layout = typeCardLayout(type, size);
  // The linked pull requests no pill shows (one naming the card, or in a field the Display leaves off) show as marks
  // beside the flags (docs/specs/026-plan/github-pull-requests.md "Pull request state on cards").
  const placed = new Set<string>(Object.values(layout).flatMap((fs) => (fs ?? []).filter(show)));
  const prMarks = edit ? [] : prs.filter((p) => !p.field || !placed.has(p.field));
  // Its open blockers (docs/specs/026-plan/item-types.md "Blocked By"), from the plan's one lookup; never on the
  // Display's example card.
  const flag = (
    <>
      {fresh ? <NewResponseMark /> : null}
      {blocked > 0 ? <BlockedMark count={blocked} card={palette.card} /> : null}
      {isFlagged(item) ? <FlagMark /> : null}
      {hasRepeat(item) ? <RepeatMark color={palette.muted} /> : null}
      {prMarks.length ? <PullRequestMarks prs={prMarks} palette={palette} /> : null}
    </>
  );
  // Flat under Professional and Marker (docs/specs/008-canvas/finish.md "Faces"): app/face-finish.css empties both
  // shadows there, from the face's finish, so a finish change restyles the cards without redrawing one
  // (docs/specs/026-plan/plan-board.md "A busy board"). A presence ring still shows.
  const frame = {
    '--card-bg': palette.card,
    '--card-line': palette.cardBorder,
    '--card-ink': palette.text,
    '--card-ring': ring ?? '0 0 #0000',
    '--card-shadow': REST_SHADOW,
    '--card-accent': accent,
    // Under the pointer: a shadow tinted with the type's colour, the card staying put (globals.css plan-card-hover).
    '--card-hover-shadow': `0 1px 2px rgba(15,23,42,0.06), 0 4px 10px -6px rgba(15,23,42,0.2), 0 10px 20px -12px color-mix(in srgb, ${accent} 25%, transparent)`,
    opacity: muted ? 0.7 : 1,
  } as React.CSSProperties;
  const presenceTag = presence ? <PresenceTag name={presence.name} color={presence.color} /> : null;
  // One field's bit, as it draws in a row (a pill, a chip, a disc); null when the card has nothing for it. `big`
  // is a Detailed header's larger chips.
  const pill = (f: CardField, big = false): ReactNode => {
    switch (f) {
      case 'key':
        // A practice card has no number of its own (key 0, docs/specs/026-plan/plan-tour.md "Practice cards").
        return item.key > 0 ? <KeyTag key={f} itemKey={item.key} accent={accent} /> : null;
      case 'type':
        return (
          <TypeChip
            key={f}
            glyph={type.glyph}
            label={type.label}
            accent={chipInkOn(type.color, palette)}
            compact={!big}
          />
        );
      case 'priority':
        return isPriority(priority) ? (
          <PrioritySignal key={f} priority={priority} label={big} palette={palette} />
        ) : null;
      case 'start':
        return typeof start === 'string' ? (
          <StartPill key={f} start={start} palette={palette} name={type.fieldLabels?.start} />
        ) : null;
      case 'due':
        return typeof due === 'string' ? (
          <DuePill
            key={f}
            due={due}
            done={!!muted}
            palette={palette}
            name={typeFieldLabel(type, 'due', 'Due')}
          />
        ) : null;
      case 'estimate':
        return typeof estimate === 'number' ? (
          <MetaPill
            key={f}
            palette={palette}
            label={`${typeFieldLabel(type, 'estimate')} ${estimate}`}
          >
            <PlanTypeGlyph glyph="cube" size={11} />
            <span aria-hidden>{estimate}</span>
          </MetaPill>
        ) : null;
      case 'checklist':
        return progress ? <ChecklistPill key={f} progress={progress} palette={palette} /> : null;
      // How long it has sat in its column; never on a done card (a done column draws it muted).
      case 'age': {
        const status = itemStatus(item);
        return muted || status === undefined ? null : (
          <AgePill
            key={f}
            item={item}
            statusName={plan?.statusNames.get(status) ?? status}
            palette={palette}
          />
        );
      }
      // Who made it and last edited it, and when (docs/specs/026-plan/items.md "Created and Last Edited").
      case 'createdAt':
      case 'createdBy':
      case 'updatedAt':
      case 'updatedBy':
        return itemHasStamp(item, f) ? (
          <StampBit key={f} item={item} field={f} palette={palette} />
        ) : null;
      case 'comments':
        return <CommentsPill key={f} item={item} palette={palette} type={type} />;
      // The votes the card has gathered from ended session votes, read-only.
      case 'votes':
        return <VotesPill key={f} total={votes} palette={palette} />;
      case 'assignee':
        return assignee ? (
          <PersonDisc key={f} person={assignee} label={`Assigned to ${assignee.name}`} />
        ) : null;
      case 'labels':
        return labels.length > 0 ? <LabelChips key={f} labels={labels} palette={palette} /> : null;
      case 'attachments': {
        const count = itemAttachments(item).length;
        return count > 0 ? <AttachmentsPill key={f} count={count} palette={palette} /> : null;
      }
      // The cover is drawn across the top of the card (below), never in a row; the Display's editor shows its chip.
      case 'cover':
        return edit ? (
          <MetaPill key={f} palette={palette} label="Cover Image">
            <PlanTypeGlyph glyph="page" size={11} />
            <span aria-hidden>Cover</span>
          </MetaPill>
        ) : null;
      case 'description':
        return typeof description === 'string' && description.trim() ? (
          <p
            key={f}
            className="line-clamp-2 w-full text-[length:calc(12px*var(--plan-text-scale,1))] leading-snug"
            style={{ color: palette.muted }}
          >
            {description}
          </p>
        ) : null;
      default: {
        // A Pull Request field, or a Link field holding a pull request's address, draws as its state's pill
        // (docs/specs/026-plan/github-pull-requests.md "Pull request state on cards").
        const def = isCustomCardField(f) ? (type.custom ?? []).find((c) => c.id === f) : undefined;
        const prRef =
          def && !isNewerField(def) && (def.kind === 'pullrequest' || def.kind === 'link')
            ? parsePullRequestUrl(item.fields[def.id])
            : undefined;
        if (def && prRef) {
          const key = pullRequestKey(prRef);
          const pr = prs.find((p) => pullRequestKey(p.ref) === key) ?? { ref: prRef };
          return <PullRequestPill key={f} pr={pr} palette={palette} name={def.label} />;
        }
        return customFieldBit(f, {
          item,
          type,
          palette,
          plan,
          muted,
          calcDefs,
          outcomes,
          items,
        });
      }
    }
  };
  // A slot's bits, in its order, of the fields this card shows there.
  const slotBits = (slot: CardSlot, big = false): ReactNode[] =>
    (layout[slot] ?? [])
      .filter(show)
      .map((f) => (edit ? edit.bit(f, pill(f, big)) : pill(f, big)))
      .filter(Boolean);
  // A slot as drawn: its bits, or, in the editor, its dotted box (drawn even when empty).
  const zone = (slot: CardSlot, bits: ReactNode[]) => (edit ? edit.slot(slot, bits) : bits);
  const titleText = (lines: 2 | 3, px: number) => (
    <span
      className={`${lines === 2 ? 'line-clamp-2' : 'line-clamp-3'} min-w-0 flex-1 font-semibold leading-snug [overflow-wrap:anywhere]`}
      style={{ color: palette.text, fontSize: planTextPx(px) }}
    >
      {title}
    </span>
  );

  // Minimal: one line, the title between its Before and After slots; stacked, the title first and its bits under it.
  if (size === 'minimal' && stacked) {
    const bits = [...slotBits('lead'), ...slotBits('trail'), ...(running ? [running] : [])];
    return (
      <div
        className={`${FRAME} ${LIFT} flex-col gap-1.5 px-2.5 py-2`}
        style={frame}
        {...FRAME_MARK}
      >
        {presenceTag}
        <div className="flex items-start gap-1.5">
          <span className="mt-[5px] flex shrink-0">
            <TypeDot accent={accent} />
          </span>
          {cardHeading(titleText(2, 12.5))}
          {flag}
        </div>
        {bits.length ? (
          <div
            data-card-bits
            className="flex min-w-0 flex-wrap items-center gap-1.5 pl-3 text-[length:calc(11px*var(--plan-text-scale,1))] font-medium"
            style={{ color: palette.muted }}
          >
            {bits}
          </div>
        ) : null}
      </div>
    );
  }
  if (size === 'minimal') {
    return (
      <div
        className={`${FRAME} ${LIFT} items-center gap-2 px-3 py-2.5`}
        style={frame}
        {...FRAME_MARK}
      >
        {presenceTag}
        <TypeDot accent={accent} />
        {zone('lead', slotBits('lead'))}
        {cardHeading(titleText(2, 13))}
        {flag}
        <span
          className="flex shrink-0 items-center gap-1.5 text-[length:calc(11px*var(--plan-text-scale,1))] font-medium"
          style={{ color: palette.muted }}
        >
          {zone('trail', slotBits('trail'))}
          {running}
        </span>
      </div>
    );
  }

  // Detailed: a header (start and end), the title, what sits under it, a footer (start and end).
  const head = slotBits('head', true);
  const headEnd = slotBits('headEnd', true);
  const body = slotBits('body');
  const foot = slotBits('foot');
  // The Bottom Right slot: the footer's far end (the assignee, by default).
  const footEnd = slotBits('footEnd');
  // The cover (docs/specs/026-plan/items.md "Attachments"): when the type's Display holds Cover Image and the card
  // has one; the Display's editor draws a placeholder in its place.
  const coverPlaced = (layout.head ?? []).includes('cover') && show('cover');
  const cover = coverPlaced ? (attachmentCover(item) ?? null) : null;
  return (
    <div
      className={`${FRAME} ${headAction ? '' : LIFT} flex-col gap-2 px-3 py-2.5`}
      style={frame}
      {...FRAME_MARK}
    >
      {presenceTag}
      {cover || (coverPlaced && edit) ? (
        <CardCover cover={cover} palette={palette} sample={!!edit} />
      ) : null}
      {head.length || headEnd.length || ownColour || edit || headAction ? (
        <div
          className="flex items-center gap-1.5 text-[length:calc(11px*var(--plan-text-scale,1))] font-medium"
          style={{ color: palette.muted }}
        >
          {zone('head', head)}
          {ownColour ? <ColourDot colour={ownColour} /> : null}
          {headEnd.length || edit || headAction ? (
            <span className="ml-auto flex items-center gap-1.5">
              {zone('headEnd', headEnd)}
              {headAction}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-start gap-1.5">
        {cardHeading(titleText(3, 14))}
        {flag}
      </div>
      {body.length || edit ? (
        <div
          className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[length:calc(11px*var(--plan-text-scale,1))] font-medium"
          style={{ color: palette.muted }}
        >
          {zone('body', body)}
        </div>
      ) : null}
      {foot.length || footEnd.length || edit || running ? (
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-0.5 text-[length:calc(11px*var(--plan-text-scale,1))] font-medium">
          {zone('foot', foot)}
          {footEnd.length || edit || running ? (
            <span className="ml-auto flex items-center gap-1">
              {zone('footEnd', footEnd)}
              {running}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
