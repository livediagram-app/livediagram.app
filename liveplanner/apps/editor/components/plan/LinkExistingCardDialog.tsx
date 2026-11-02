'use client';

// Link Existing (docs/specs/026-plan/item-types.md "Link Existing"): links a card already made to the open one
// through a Linked as section's field. The shared card picker (CardPickerDialog) over the cards the field may link
// from (linkableCards: its types, live, never this card nor one linked here already), each naming its type when the
// field is on several. A card linked elsewhere says so, and picking it asks before moving it. The write is the host's
// (one ordinary card write); a refused one keeps the dialog open.

import { useMemo, useState } from 'react';
import { ConfirmDialog } from '@liveworkspace/workbench/components/dialogs/ConfirmDialog';
import {
  itemTitle,
  linkableCards,
  linkedCard,
  typeIn,
  type Item,
  type ItemTypeDef,
  type LinkedGroup,
} from '@liveplanner/items';
import { CardPickerDialog, type CardPickerRow } from './CardPickerDialog';
import { byNewestChange, pickCardOf, useCardPickerSearch } from './card-picker';

type LinkRow = CardPickerRow & {
  // The card its field links to now, when another ("#3 Website"), or null for a missing one.
  elsewhere: { id: string; name: string | null } | null;
};

const cardName = (card: Item) => `#${card.key} ${itemTitle(card) || 'Untitled'}`;

/** The rows Link Existing offers, newest change first, each saying where it links now. */
export function linkExistingRows(
  target: Item,
  group: Pick<LinkedGroup, 'fieldId' | 'fromTypes' | 'several'>,
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
): LinkRow[] {
  return linkableCards(target, group, items.values())
    .map(({ card, elsewhere }) => {
      const now = elsewhere ? linkedCard(items, elsewhere) : undefined;
      const name = now ? cardName(now) : null;
      return {
        ...pickCardOf(card, types),
        elsewhere: elsewhere ? { id: elsewhere, name } : null,
        note: elsewhere ? (name ? `Linked to ${name}` : 'Linked to a missing card') : undefined,
      };
    })
    .sort(byNewestChange);
}

/** The types' names for the empty note: "Story", "Story or Bug", "Story, Bug or Epic". */
function typeNames(ids: readonly string[], types: readonly ItemTypeDef[]): string {
  const names = ids.map((id) => typeIn(types, id).label);
  return names.length < 2
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;
}

export function LinkExistingCardDialog({
  target,
  group,
  items,
  types,
  onLink,
  onClose,
}: {
  // The open card: what the picked card links to.
  target: Item;
  group: LinkedGroup;
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  // Sets the picked card's field to the target; false: refused. `moved`: it linked to another card before.
  onLink: (cardId: string, moved: boolean) => Promise<boolean> | boolean;
  onClose: () => void;
}) {
  const rows = useMemo(
    () => linkExistingRows(target, group, items, types),
    [target, group, items, types],
  );
  const picker = useCardPickerSearch(rows);
  const [moving, setMoving] = useState<LinkRow | null>(null);
  const [busy, setBusy] = useState(false);

  const link = async (row: LinkRow) => {
    if (busy) return;
    setBusy(true);
    const done = await onLink(row.itemId, !!row.elsewhere);
    setBusy(false);
    setMoving(null);
    if (done !== false) onClose();
  };
  const pick = (row: LinkRow) => {
    if (row.elsewhere) setMoving(row);
    else void link(row);
  };
  const from = moving?.elsewhere?.name;

  return (
    <>
      <CardPickerDialog
        title="Link Existing Card"
        description={`Pick a card to link to ${cardName(target)} as ${group.label}.`}
        cards={picker.shown}
        query={picker.query}
        onQuery={picker.setQuery}
        listLabel={`Cards to link as ${group.label}`}
        emptyText={`No other ${typeNames(group.fromTypes, types)} cards to link.`}
        showType={group.fromTypes.length > 1}
        escapeEnabled={!moving}
        onPick={pick}
        onClose={onClose}
      />
      {moving ? (
        <ConfirmDialog
          open
          title={`Move #${moving.key} ${moving.title}?`}
          message={
            from
              ? `It is linked as ${group.label} to ${from}. Linking it here moves it, and it leaves ${from}'s Linked as ${group.label}.`
              : `It is linked as ${group.label} to a missing card. Linking it here moves it.`
          }
          confirmLabel="Move Here"
          onConfirm={() => void link(moving)}
          onCancel={() => setMoving(null)}
        />
      ) : null}
    </>
  );
}
