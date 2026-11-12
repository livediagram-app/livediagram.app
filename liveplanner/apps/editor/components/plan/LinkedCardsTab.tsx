'use client';

// The item panel's Linked Cards tab (docs/specs/026-plan/item-types.md "The Linked Cards tab"): every Linked as
// section of the open card (a Blocked By field's Blocks list among them), off the type's first tab. With no card
// linked at all it opens on an empty state, then, for someone who may add cards, each section's heading and its
// New {Type} and Link Existing buttons, without the sections' own empty notes.
import { CompactEmptyState, lucideGlyph } from '@liveplanner/ui';
import { lucideLink } from '@liveworkspace/icons/lucide';
import type { Item, ItemTypeDef, LinkedGroup } from '@liveplanner/items';
import { LinkedCardGroup } from './LinkedCards';

const LinkIcon = lucideGlyph(lucideLink, 18);

// How many cards link here, each once however many of the groups hold it: the tab's count.
export function linkedCardCount(groups: readonly LinkedGroup[]): number {
  const ids = new Set<string>();
  for (const g of groups) for (const c of g.cards) ids.add(c.id);
  return ids.size;
}

export function LinkedCardsTab({
  item,
  groups,
  types,
  statusNames,
  canAdd,
  onOpen,
  onAdd,
  onLinkExisting,
}: {
  // The open card: what the sections list cards linked to.
  item: Item;
  groups: readonly LinkedGroup[];
  types: readonly ItemTypeDef[];
  statusNames: ReadonlyMap<string, string>;
  // New {Type} and Link Existing (an Editor's or a Participant's).
  canAdd: boolean;
  onOpen: (itemId: string) => void;
  onAdd: (group: LinkedGroup, typeId: string) => void;
  onLinkExisting?:
    ((group: LinkedGroup, cardId: string, moved: boolean) => Promise<boolean>) | undefined;
}) {
  const empty = linkedCardCount(groups) === 0;
  return (
    <div data-linked-cards-tab="">
      {empty ? (
        <CompactEmptyState
          size="small"
          icon={<LinkIcon aria-hidden />}
          title="No Linked Cards Yet"
          description={
            canAdd
              ? 'Cards that link to this one show here. Make one already linked, or link one you already have.'
              : 'Cards that link to this one show here.'
          }
          className={`rounded-xl border border-dashed border-slate-200 dark:border-slate-700 ${canAdd ? 'mb-6' : ''}`}
        />
      ) : null}
      {empty && !canAdd
        ? null
        : groups.map((g) => (
            <LinkedCardGroup
              key={g.fieldId}
              group={g}
              types={types}
              statusNames={statusNames}
              canAdd={canAdd}
              onOpen={onOpen}
              onAdd={(typeId) => onAdd(g, typeId)}
              target={item}
              emptyNote={!empty}
              {...(onLinkExisting
                ? {
                    onLinkExisting: (cardId: string, moved: boolean) =>
                      onLinkExisting(g, cardId, moved),
                  }
                : {})}
            />
          ))}
    </div>
  );
}
