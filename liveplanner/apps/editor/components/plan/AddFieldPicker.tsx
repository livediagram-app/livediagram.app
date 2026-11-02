'use client';

// Add Field's first step, Pick (docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field), on the galleries'
// shared frame (gallery/): the rail of categories (AddFieldRail: All Fields, then each category, with how many kinds
// it holds or a search leaves in it) and the list beside it (AddFieldPicker: the category shown, or every one under
// its heading, each kind a tile drawing a sample of its value, its name and its line). A kind whose built-in field the
// type lacks is tagged Ready to use; every kind, Comments and Votes among them, opens Shape. The arrow keys move
// between tiles (gallery-keys.ts).
import { useEffect, useId, useLayoutEffect, type KeyboardEvent, type RefObject } from 'react';
import { ITEM_TYPE_CUSTOM_MAX, type CustomFieldKind, type ItemFieldId } from '@liveplanner/items';
import { NoMatches, lucideGlyph } from '@liveplanner/ui';
import { lucideLayoutGrid } from '@liveworkspace/icons/lucide';
import {
  ALL_FIELDS_LABEL,
  CUSTOM_MAX_NOTE,
  KIND_DESCRIPTIONS,
  readyBuiltIns,
  type CategoryChoice,
  type KindCategoryId,
  type PickKind,
  type ShownCategory,
} from './add-field-kinds';
import { KindSample, PICK_KIND_ICONS } from './CustomFieldKindParts';
import { PICK_KIND_LABELS } from './ItemTypeFieldForms';
import { GalleryList, GallerySectionHeading } from './gallery/GalleryFrame';
import { GalleryRail } from './gallery/GalleryRail';
import { FitWidth, GalleryTile, TILE_BADGE_SPOT } from './gallery/GalleryTile';
import { moveAmongTiles } from './gallery/gallery-keys';

const AllIcon = lucideGlyph(lucideLayoutGrid, 14);

// Each category's icon: its first everyday kind's.
const CATEGORY_ICONS: Record<KindCategoryId, React.ReactNode> = {
  text: PICK_KIND_ICONS.text,
  numbers: PICK_KIND_ICONS.number,
  dates: PICK_KIND_ICONS.date,
  choices: PICK_KIND_ICONS.choice,
  people: PICK_KIND_ICONS.person,
  links: PICK_KIND_ICONS.link,
  cards: PICK_KIND_ICONS.card,
};

// A dimmed tile's tooltip (the type holds the most custom fields it can).
export const AT_CAP_HINT = 'Remove a custom field to add another';

// The tiles the keys move between, and the ones a press would pick.
const TILES = 'button[data-kind]';
const PICKABLE = 'button[data-pick]';

// A kind as the list shows it: open to press, or dimmed (the type holds the most custom fields and the kind has no
// built-in field left to add).
type KindState = 'open' | 'dimmed';

export function kindState(
  kind: PickKind,
  missing: readonly ItemFieldId[],
  canAddCustom: boolean,
): KindState {
  return readyBuiltIns(kind, missing).length > 0 || canAddCustom ? 'open' : 'dimmed';
}

export const shownCount = (categories: readonly ShownCategory[]) =>
  categories.reduce((n, c) => n + c.shown.length, 0);

// The rail: All Fields, then each category, each with how many kinds it shows.
export function AddFieldRail({
  categories,
  choice,
  onChoose,
  className,
}: {
  categories: readonly ShownCategory[];
  choice: CategoryChoice;
  onChoose: (choice: CategoryChoice) => void;
  className?: string;
}) {
  return (
    <GalleryRail
      label="Field categories"
      className={className}
      current={choice}
      onPick={(key) => onChoose(key as CategoryChoice)}
      groups={[
        {
          entries: [
            {
              key: 'all',
              title: ALL_FIELDS_LABEL,
              icon: <AllIcon />,
              count: shownCount(categories),
            },
            ...categories.map((c) => ({
              key: c.id,
              title: c.label,
              icon: CATEGORY_ICONS[c.id],
              count: c.shown.length,
            })),
          ],
        },
      ]}
    />
  );
}

/** Focuses the list's first tile (↓ from the search). */
export function focusFirstKind(list: HTMLElement | null, e: KeyboardEvent): void {
  const first = list?.querySelector<HTMLElement>(TILES);
  if (!first) return;
  e.preventDefault();
  first.focus();
}

/** Presses the list's first kind that can be picked (Enter in the search). */
export function pickFirstKind(list: HTMLElement | null): void {
  list?.querySelector<HTMLElement>(PICKABLE)?.click();
}

export function AddFieldPicker({
  categories,
  choice,
  query,
  missing,
  canAddCustom,
  onPick,
  focusKind,
  listRef,
  searchRef,
}: {
  categories: readonly ShownCategory[];
  choice: CategoryChoice;
  // The search as typed, for the empty state.
  query: string;
  // The built-in fields the type lacks.
  missing: readonly ItemFieldId[];
  canAddCustom: boolean;
  onPick: (kind: CustomFieldKind) => void;
  // The kind to focus on arriving (back from Shape).
  focusKind?: CustomFieldKind | undefined;
  listRef: RefObject<HTMLDivElement | null>;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  const ids = useId();
  const sections = categories.filter(
    (c) => c.shown.length > 0 && (choice === 'all' || c.id === choice),
  );
  const chosen = categories.find((c) => c.id === choice);

  // Back from Shape: the kind that was picked takes focus.
  useLayoutEffect(() => {
    if (!focusKind) return;
    listRef.current?.querySelector<HTMLElement>(`[data-kind="${focusKind}"]`)?.focus();
    // Arriving only.
    // oxlint-disable-next-line react/exhaustive-deps
  }, []);
  // Another category or search starts at the top.
  useEffect(() => {
    listRef.current?.scrollTo?.({ top: 0 });
  }, [choice, query, listRef]);

  return (
    <GalleryList
      ref={listRef}
      onKeyDown={(e) =>
        moveAmongTiles(
          e,
          [...(listRef.current?.querySelectorAll<HTMLElement>(TILES) ?? [])],
          searchRef.current,
        )
      }
    >
      {canAddCustom ? null : (
        <p
          role="note"
          className="mt-4 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-[12px] leading-snug text-slate-600 dark:border-slate-600 dark:text-slate-300"
        >
          {CUSTOM_MAX_NOTE(ITEM_TYPE_CUSTOM_MAX)}
        </p>
      )}
      {sections.length === 0 ? (
        <NoMatches
          size="regular"
          className="py-10"
          things={chosen ? `${chosen.label} fields` : 'fields'}
          query={query}
          hint="Try a word like money, date or parent."
        />
      ) : (
        sections.map((c) => (
          <section key={c.id} aria-labelledby={`${ids}-${c.id}`} className="pt-4">
            <GallerySectionHeading
              id={`${ids}-${c.id}`}
              icon={CATEGORY_ICONS[c.id]}
              title={c.label}
              line={c.line}
            />
            <div className="grid grid-cols-2 gap-2 @max-[460px]:grid-cols-1">
              {c.shown.map((k) => (
                <KindTile
                  key={k}
                  kind={k}
                  ids={`${ids}-${k}`}
                  ready={readyBuiltIns(k, missing).length > 0}
                  dimmed={kindState(k, missing, canAddCustom) === 'dimmed'}
                  onPick={onPick}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </GalleryList>
  );
}

// One kind: a sample of its value on the strip, its icon, name and line; tagged Ready to use when the type lacks a
// built-in field of it.
function KindTile({
  kind,
  ids,
  ready,
  dimmed,
  onPick,
}: {
  kind: PickKind;
  ids: string;
  ready: boolean;
  dimmed: boolean;
  onPick: (kind: PickKind) => void;
}) {
  const label = PICK_KIND_LABELS[kind];
  return (
    <GalleryTile
      rootData={{ 'data-kind-tile': kind }}
      buttonData={{ 'data-kind': kind, ...(dimmed ? {} : { 'data-pick': '' }) }}
      label={dimmed ? `${label}: ${AT_CAP_HINT}` : label}
      describedBy={ready ? `${ids}-line ${ids}-ready` : `${ids}-line`}
      disabled={dimmed}
      tooltip={AT_CAP_HINT}
      onPress={() => onPick(kind)}
      glyph={PICK_KIND_ICONS[kind]}
      name={label}
      line={KIND_DESCRIPTIONS[kind]}
      lineId={`${ids}-line`}
      strip={
        <FitWidth>
          <span className="text-[13px]">
            <KindSample kind={kind} />
          </span>
        </FitWidth>
      }
      badge={
        ready ? (
          <span
            id={`${ids}-ready`}
            className={`${TILE_BADGE_SPOT} rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 shadow-sm ring-1 ring-inset ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30`}
          >
            Ready to use
          </span>
        ) : null
      }
    />
  );
}
