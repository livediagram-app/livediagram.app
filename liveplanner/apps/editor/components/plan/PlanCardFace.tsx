'use client';

import type { ReactNode } from 'react';
// One item's card face (docs/specs/026-plan/plan-board.md "What the board shows"), shared by the board's
// cards and the Plan card element, at the board's card size: Minimal (the title) or Detailed (the type chip,
// number and priority signal; the title; the project; the description; custom fields; label chips; then a footer
// of pills and who has it). The type's colour fills
// the card's number (a dot on Minimal, which shows none); the card lifts a little under the pointer. Face-down while its board hides writing;
// ringed in someone's colour while they drag or read it. The parts live in plan-card-parts.tsx.
import { NewResponseMark } from '@/components/forms/NewResponseMark';
import { useFreshResponse } from '@/components/forms/fresh-responses';
import {
  isFlagged,
  isPriority,
  itemAssignee,
  itemStatus,
  itemLabels,
  itemTitle,
  ITEM_TYPES,
  itemVoteTotal,
  typeIn,
  itemColourOf,
  linkedCard,
  cardFieldsAt,
  type CardField,
  type CardSize,
  type Item,
  typeCardDisplay,
  type ItemTypeDef,
  typeCardLayout,
  type CardSlot,
  isCustomCardField,
  calculatedText,
} from '@liveplanner/items';
import { finishFaceShadows } from '@liveplanner/project';
import { useFaceFinish } from '@/components/canvas/CanvasFinishContext';
import { usePlan, type PlanCardPresence } from './PlanContext';
import { customFieldText } from './custom-field-text';
import { calculatedFieldValue } from './calculated-values';
import { CUSTOM_KIND_ICONS } from './CustomFieldKindParts';
import { customKindPill, isBuiltInKindPill } from './CustomKindPill';
import { accentOn, type PlanPalette } from './plan-palette';
import { PersonDisc, PresenceTag } from './PersonDisc';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ColourDot } from './ColourSwatches';
import { AgePill } from './card-age';
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
  checklistProgress,
} from './plan-card-parts';

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

// The card's frame: rounded, a hairline border and a soft shadow that deepens under the pointer.
const FRAME =
  'group/card relative flex h-full overflow-hidden rounded-xl border transition-[box-shadow,transform] duration-150';
// The lift under the pointer. Left off a face that carries a headAction: its host draws the hover, since a transform
// would make the face a stacking context and sink the action under the host's own press target.
const LIFT =
  'hover:-translate-y-px hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0';
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
  const plan = usePlan();
  const faceFinish = useFaceFinish();
  const type = typeOverride ?? typeIn(plan?.types ?? ITEM_TYPES, item.type);
  // Lifted on a dark card, so Project's black still shows.
  const accent = accentOn(type.color, palette);
  // What the board shows at this size, and what the card's type shows (docs/specs/026-plan/item-types.md "Card
  // display"): both must allow a field.
  const typeShows = typeCardDisplay(type, size);
  const shown = cardFieldsAt(size, fields).filter((f) => typeShows.includes(f));
  // A custom field shows wherever the type's Display places it (the board's field list names built-ins only).
  const show = (f: CardField) => (isCustomCardField(f) ? typeShows.includes(f) : shown.includes(f));
  const ring = presence ? `0 0 0 2px ${presence.color}` : undefined;
  // A response's card is New until opened (docs/specs/030-forms/forms.md "Hearing about responses").
  const fresh = useFreshResponse(item);
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
  // An item's own colour (docs/specs/026-plan/items.md "Colour"): a dot beside the type, never replacing it.
  const ownColour = itemColourOf(item, type);
  const progress = checklistProgress(item);
  const votes = itemVoteTotal(item);
  const title = itemTitle(item) || 'Untitled';
  const flag = (
    <>
      {fresh ? <NewResponseMark /> : null}
      {isFlagged(item) ? <FlagMark /> : null}
    </>
  );
  const frame = {
    backgroundColor: palette.card,
    borderColor: palette.cardBorder,
    // Flat under Professional and Marker (docs/specs/008-canvas/finish.md "Faces"); a presence ring still shows.
    boxShadow: ring ?? (finishFaceShadows(faceFinish) ? REST_SHADOW : undefined),
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
      case 'comments':
        return <CommentsPill key={f} item={item} palette={palette} />;
      // The votes the card has gathered from ended session votes, read-only.
      case 'votes':
        return votes > 0 ? (
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
      default: {
        // A custom field the type's Display places: its kind's glyph (a linked card's own, in its colour) and value.
        const def = isCustomCardField(f) ? (type.custom ?? []).find((c) => c.id === f) : undefined;
        // A field of a built-in kind draws as its built-in field does, an Image as its thumbnail.
        if (def && isBuiltInKindPill(def)) return customKindPill(def, item.fields[def.id], palette);
        // A Calculated field's value is worked out (docs/specs/026-plan/item-types.md "Calculated fields").
        const text = !def
          ? null
          : def.kind === 'calculated'
            ? plan
              ? calculatedText(def, calculatedFieldValue(plan, def, item))
              : null
            : customFieldText(def, item.fields[def.id], plan?.items);
        if (!def || !text) return null;
        // A linked card with its own Colour shows it (a Parent project's colour), else its own type's glyph (a field
        // may link to several types), the field's first type's while the card is missing.
        const linked =
          def.kind === 'card' && plan ? linkedCard(plan.items, item.fields[def.id]) : undefined;
        const linkedTypeId = def.kind === 'card' ? (linked?.type ?? def.linkType) : undefined;
        const linkedType = linkedTypeId
          ? typeIn(plan?.types ?? ITEM_TYPES, linkedTypeId)
          : undefined;
        const linkedColour = linked ? itemColourOf(linked, linkedType) : undefined;
        return (
          <MetaPill key={f} palette={palette} label={`${def.label}: ${text}`}>
            {linkedColour ? (
              <ColourDot colour={linkedColour} />
            ) : linkedType ? (
              <PlanTypeGlyph
                glyph={linkedType.glyph}
                size={11}
                color={accentOn(linkedType.color, palette)}
              />
            ) : (
              <span className="flex [&_svg]:h-[11px] [&_svg]:w-[11px]">
                {CUSTOM_KIND_ICONS[def.kind]}
              </span>
            )}
            <span aria-hidden className="max-w-[10rem] truncate">
              {text}
            </span>
          </MetaPill>
        );
      }
    }
  };
  // A slot's bits, in its order, of the fields this card shows there (docs/specs/026-plan/item-types.md "Card
  // display").
  const layout = typeCardLayout(type, size);
  const slotBits = (slot: CardSlot, big = false): ReactNode[] =>
    (layout[slot] ?? [])
      .filter(show)
      .map((f) => (edit ? edit.bit(f, pill(f, big)) : pill(f, big)))
      .filter(Boolean);
  // A slot as drawn: its bits, or, in the editor, its dotted box (drawn even when empty).
  const zone = (slot: CardSlot, bits: ReactNode[]) => (edit ? edit.slot(slot, bits) : bits);
  const titleText = (lines: 2 | 3, px: number) => (
    <span
      className={`${lines === 2 ? 'line-clamp-2' : 'line-clamp-3'} min-w-0 flex-1 font-semibold leading-snug`}
      style={{ color: palette.text, fontSize: px }}
    >
      {title}
    </span>
  );

  // Minimal: one line, the title between its Before and After slots; stacked, the title first and its bits under it.
  if (size === 'minimal' && stacked) {
    const bits = [...slotBits('lead'), ...slotBits('trail')];
    return (
      <div className={`${FRAME} ${LIFT} flex-col gap-1.5 px-2.5 py-2`} style={frame}>
        {presenceTag}
        <div className="flex items-start gap-1.5">
          <span className="mt-[5px] flex shrink-0">
            <TypeDot accent={accent} />
          </span>
          {titleText(2, 12.5)}
          {flag}
        </div>
        {bits.length ? (
          <div
            data-card-bits
            className="flex min-w-0 flex-wrap items-center gap-1.5 pl-3 text-[11px] font-medium"
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
      <div className={`${FRAME} ${LIFT} items-center gap-2 px-3 py-2.5`} style={frame}>
        {presenceTag}
        <TypeDot accent={accent} />
        {zone('lead', slotBits('lead'))}
        {titleText(2, 13)}
        {flag}
        <span
          className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium"
          style={{ color: palette.muted }}
        >
          {zone('trail', slotBits('trail'))}
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
  return (
    <div className={`${FRAME} ${headAction ? '' : LIFT} flex-col gap-2 px-3 py-2.5`} style={frame}>
      {presenceTag}
      {head.length || headEnd.length || ownColour || edit || headAction ? (
        <div
          className="flex items-center gap-1.5 text-[11px] font-medium"
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
        {titleText(3, 14)}
        {flag}
      </div>
      {body.length || edit ? (
        <div
          className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-medium"
          style={{ color: palette.muted }}
        >
          {zone('body', body)}
        </div>
      ) : null}
      {foot.length || footEnd.length || edit ? (
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-0.5 text-[11px] font-medium">
          {zone('foot', foot)}
          {footEnd.length || edit ? (
            <span className="ml-auto flex items-center gap-1">{zone('footEnd', footEnd)}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
