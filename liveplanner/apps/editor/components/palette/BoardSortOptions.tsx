'use client';

// A board's Sort Cards (docs/specs/026-plan/plan-board.md "The board set-up"): Sort By, then, once it has a field,
// its two directions and Then By (and Then By's directions), each an option list. The board menu and the cog's
// popover show it; each pick hands the whole new sort to `onChange`.
import {
  BOARD_SORT_DIRS,
  boardSortFieldOf,
  boardSortFieldsOf,
  boardSortLabel,
  withBoardSortPick,
  type BoardSortField,
  type BoardSortKind,
  type BoardSortLevel,
  type ItemTypeDef,
} from '@liveplanner/items';
import { lucideGlyph } from '@liveplanner/ui';
import { lucideArrowDown, lucideArrowUp } from '@liveworkspace/icons/lucide';
import { OptionRows } from '@/components/plan/OptionRows';
import { PlanTypeGlyph } from '@/components/plan/plan-type-glyph';
import { MenuGroup } from './plan-menu-parts';

const NONE = 'none';
const AscIcon = lucideGlyph(lucideArrowUp, 16);
const DescIcon = lucideGlyph(lucideArrowDown, 16);

// A sort field's row glyph, by its kind.
const SORT_KIND_GLYPHS: Record<BoardSortKind, string> = {
  priority: 'flag',
  number: 'cube',
  currency: 'coin',
  percent: 'percent',
  duration: 'clock',
  date: 'calendar',
  rating: 'star',
  choice: 'checklist',
};

export function BoardSortOptions({
  sortBy,
  types,
  allTypes,
  onChange,
}: {
  sortBy: readonly BoardSortLevel[] | undefined;
  // The card types the board shows: only what they offer is listed.
  types: readonly ItemTypeDef[];
  // Every type of the project, to name a field in use that the shown types no longer offer.
  allTypes: readonly ItemTypeDef[];
  onChange: (next: BoardSortLevel[]) => void;
}) {
  const offered = boardSortFieldsOf(types);
  // A field in use stays listed (and pressed) even once the shown types no longer offer it.
  for (const l of sortBy ?? []) {
    if (offered.some((f) => f.id === l.field)) continue;
    offered.push(
      boardSortFieldOf(l.field, allTypes) ?? { id: l.field, label: l.field, kind: 'number' },
    );
  }
  const kindOf = (id: string) => offered.find((f) => f.id === id)?.kind;
  const [first, second] = sortBy ?? [];
  const level = (at: 0 | 1, fields: readonly BoardSortField[], current?: BoardSortLevel) => (
    <>
      <OptionRows
        kind="single"
        label={at === 0 ? 'Sort By' : 'Then By'}
        className="mx-3 my-1.5"
        selected={current?.field ?? NONE}
        rows={[
          { id: NONE, label: 'None', icon: <PlanTypeGlyph glyph="item" size={16} /> },
          ...fields.map((f) => ({
            id: f.id,
            label: f.label,
            icon: <PlanTypeGlyph glyph={SORT_KIND_GLYPHS[f.kind]} size={16} />,
          })),
        ]}
        onPick={(id) =>
          onChange(
            withBoardSortPick(sortBy, at, {
              field: id === NONE ? null : id,
              kind: kindOf(id),
            }),
          )
        }
      />
      {current ? (
        <OptionRows
          kind="single"
          label={`${at === 0 ? 'Sort By' : 'Then By'} direction`}
          className="mx-3 mb-1.5"
          selected={current.dir}
          rows={BOARD_SORT_DIRS.map((d) => ({
            id: d,
            label: boardSortLabel(kindOf(current.field), d),
            icon: d === 'asc' ? <AscIcon aria-hidden /> : <DescIcon aria-hidden />,
          }))}
          onPick={(d) => onChange(withBoardSortPick(sortBy, at, { dir: d as 'asc' | 'desc' }))}
        />
      ) : null}
    </>
  );
  return (
    <>
      <MenuGroup
        title="Sort By"
        hint="Order each column’s cards by up to two fields. While sorted, cards are not reordered by hand."
      >
        {level(0, offered, first)}
      </MenuGroup>
      {first ? (
        <MenuGroup title="Then By">
          {level(
            1,
            offered.filter((f) => f.id !== first.field),
            second,
          )}
        </MenuGroup>
      ) : null}
    </>
  );
}
