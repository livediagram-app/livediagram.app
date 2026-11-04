'use client';

// One card type's tile on the Overview (docs/specs/026-plan/plan-overview.md "Card Types"): its chip as its title, a
// sample of its cards drawn as a board draws them, its fields, its cards by status and how many are overdue, and the
// boards that take it; an Editor's quick actions in its corner. Memoised: it draws again only when its own summary,
// the palette or a handler changes.
import { memo, useMemo, useState, type ReactNode } from 'react';
import { CARD_FIELDS, type CardField, type ItemTypeDef } from '@liveplanner/items';
import { HoverCard, Tooltip, lucideGlyph } from '@liveplanner/ui';
import {
  lucideArrowUpRight,
  lucidePencil,
  lucideSquareKanban,
  lucideSquarePlus,
  lucideTextCursorInput,
} from '@liveworkspace/icons/lucide';
import {
  MenuActionRow,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { CardTypeChip } from '@/components/plan/CardTypeChipFace';
import { BUILT_IN_FIELD_LABELS } from '@/components/plan/ItemTypeFieldForms';
import { PlanCardFace } from '@/components/plan/PlanCardFace';
import { fieldIcon, sampleCard } from '@/components/plan/card-type-sample';
import type { PlanPalette } from '@/components/plan/plan-palette';
import type { ItemFieldId } from '@liveplanner/items';
import {
  TYPE_BOARDS_SHOWN,
  TYPE_FIELDS_SHOWN,
  cardCountLine,
  type CardTypeTileSummary,
  type TypeBoardLink,
  type TypeStatusShare,
} from './overview-card-types';
import { TILE_CLASS } from './OverviewSection';

const EditGlyph = lucideGlyph(lucidePencil, 15);
const FieldGlyph = lucideGlyph(lucideTextCursorInput, 15);
const CardGlyph = lucideGlyph(lucideSquarePlus, 15);
const OpenGlyph = lucideGlyph(lucideArrowUpRight, 12);
const BoardGlyph = lucideGlyph(lucideSquareKanban, 14);

export type CardTypeTileActions = {
  openTab: (tabId: string) => void;
  // Each absent for anyone who may not change card types.
  edit?: ((typeId: string) => void) | undefined;
  addField?: ((typeId: string) => void) | undefined;
  addCard?: ((typeId: string) => void) | undefined;
  addToBoard?: ((typeId: string, boardElementId: string) => void) | undefined;
};

// A field's name as the type gives it: a custom field's own label, else the built-in's.
function fieldName(type: ItemTypeDef, id: string): string {
  const custom = type.custom?.find((c) => c.id === id);
  if (custom) return custom.label || 'Custom Field';
  return BUILT_IN_FIELD_LABELS[id as ItemFieldId] ?? id;
}

const PHASE_FILL: Record<TypeStatusShare['phase'], string> = {
  todo: 'bg-slate-300 dark:bg-slate-600',
  doing: 'bg-brand-500 dark:bg-brand-400',
  done: 'bg-emerald-500 dark:bg-emerald-400',
};

// The sample: the type's latest card, else an example of it, as a board's Detailed card, scaled into the tile.
function Sample({ tile, palette }: { tile: CardTypeTileSummary; palette: PlanPalette }) {
  const item = useMemo(() => tile.sample ?? sampleCard(tile.type), [tile.sample, tile.type]);
  return (
    <span
      aria-hidden
      inert
      data-card-type-sample={tile.sample ? 'card' : 'example'}
      className="pointer-events-none relative block h-[124px] select-none overflow-hidden rounded-lg px-3 pt-3 [mask-image:linear-gradient(to_bottom,black_72%,transparent)]"
      style={{ backgroundColor: palette.column }}
    >
      <span className="block w-[125%] origin-top-left scale-[0.8]">
        <PlanCardFace
          item={item}
          palette={palette}
          fields={CARD_FIELDS}
          size="detailed"
          typeOverride={tile.type}
        />
      </span>
      {tile.sample ? null : (
        <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-900/90 dark:text-slate-300 dark:ring-white/10">
          Example
        </span>
      )}
    </span>
  );
}

function Fields({ type }: { type: ItemTypeDef }) {
  const ids = type.fields.filter((f) => f !== 'title');
  if (ids.length === 0) return null;
  const shown = ids.slice(0, TYPE_FIELDS_SHOWN);
  const rest = ids.slice(TYPE_FIELDS_SHOWN);
  const chip =
    'inline-flex h-6 max-w-full items-center gap-1 rounded-md bg-slate-100 px-1.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  return (
    <ul aria-label="Fields" className="flex flex-wrap gap-1">
      {shown.map((f) => (
        <li key={f} data-type-field={f} className={chip}>
          <span aria-hidden className="flex shrink-0 text-slate-500 dark:text-slate-400">
            {fieldIcon(type, f as CardField, 12)}
          </span>
          <span className="truncate">{fieldName(type, f)}</span>
        </li>
      ))}
      {rest.length > 0 ? (
        <li className="flex">
          <HoverCard
            title={`${rest.length} More Fields`}
            description={rest.map((f) => fieldName(type, f)).join(', ')}
          >
            <span className={chip}>+{rest.length} More</span>
          </HoverCard>
        </li>
      ) : null}
    </ul>
  );
}

function StatusBar({ shares, total }: { shares: readonly TypeStatusShare[]; total: number }) {
  if (total === 0)
    return <span aria-hidden className="block h-1.5 rounded-full bg-slate-100 dark:bg-slate-800" />;
  return (
    <span
      role="img"
      aria-label={shares.map((s) => `${s.label}: ${cardCountLine(s.count)}`).join(', ')}
      className="flex h-1.5 gap-px overflow-hidden rounded-full"
    >
      {shares.map((s) => (
        <HoverCard
          key={s.status}
          title={`${s.label}: ${cardCountLine(s.count)}`}
          className="flex"
          style={{ flexGrow: s.count, flexBasis: 0 }}
        >
          <span
            data-status-share={s.status}
            className={`block h-full w-full ${s.color ? '' : PHASE_FILL[s.phase]}`}
            style={s.color ? { backgroundColor: s.color } : undefined}
          />
        </HoverCard>
      ))}
    </span>
  );
}

const LINK =
  'inline-flex h-6 max-w-full cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:text-brand-300';

function UsedOn({
  tile,
  openTab,
  addToBoard,
}: {
  tile: CardTypeTileSummary;
  openTab: (tabId: string) => void;
  addToBoard?: ((boardElementId: string) => void) | undefined;
}) {
  const [menu, setMenu] = useState<HTMLButtonElement | null>(null);
  if (tile.usedOn.length === 0) {
    const choices = tile.canAddTo;
    return (
      <span className="flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1">
        <span
          data-used-on="none"
          className="text-xs font-medium text-amber-700 dark:text-amber-300"
        >
          Not on any board yet
        </span>
        {addToBoard && choices.length > 0 ? (
          <>
            <button
              type="button"
              aria-haspopup={choices.length > 1 ? 'menu' : undefined}
              aria-expanded={choices.length > 1 ? !!menu : undefined}
              onClick={(e) => {
                if (choices.length === 1) addToBoard(choices[0]!.elementId);
                else setMenu(menu ? null : e.currentTarget);
              }}
              className={LINK}
            >
              <BoardGlyph />
              Add to a Board
            </button>
            {menu ? (
              <PortalMenu anchor={menu} placement="below" onClose={() => setMenu(null)}>
                {choices.map((b) => (
                  <MenuActionRow
                    key={b.tabId}
                    plain
                    label={b.tabName}
                    icon={<BoardGlyph />}
                    onClick={() => {
                      setMenu(null);
                      addToBoard(b.elementId);
                    }}
                  />
                ))}
              </PortalMenu>
            ) : null}
          </>
        ) : null}
      </span>
    );
  }
  const shown = tile.usedOn.slice(0, TYPE_BOARDS_SHOWN);
  const rest = tile.usedOn.slice(TYPE_BOARDS_SHOWN);
  const link = (b: TypeBoardLink) => (
    <li key={b.tabId} className="flex min-w-0">
      <button
        type="button"
        data-used-on-tab={b.tabId}
        aria-label={`Open ${b.tabName}`}
        onClick={() => openTab(b.tabId)}
        className={LINK}
      >
        <span className="truncate">{b.tabName}</span>
        <span aria-hidden className="flex shrink-0 opacity-70">
          <OpenGlyph />
        </span>
      </button>
    </li>
  );
  return (
    <span className="flex min-w-0 items-start gap-2">
      <span className="pt-1 text-xs text-slate-500 dark:text-slate-400">On</span>
      <ul aria-label="Used On" className="flex min-w-0 flex-wrap gap-1">
        {shown.map(link)}
        {rest.length > 0 ? (
          <li className="flex">
            <HoverCard
              title={`${rest.length} More Boards`}
              description={rest.map((b) => b.tabName).join(', ')}
            >
              <span className="inline-flex h-6 items-center px-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                +{rest.length} More
              </span>
            </HoverCard>
          </li>
        ) : null}
      </ul>
    </span>
  );
}

function QuickAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        {children}
      </button>
    </Tooltip>
  );
}

export const CardTypeTile = memo(function CardTypeTile({
  tile,
  palette,
  actions,
}: {
  tile: CardTypeTileSummary;
  palette: PlanPalette;
  actions: CardTypeTileActions;
}) {
  const { type } = tile;
  const { edit, addField, addCard, addToBoard } = actions;
  const quick = edit || addField || (addCard && tile.usedOn.length > 0);
  return (
    <div
      data-card-type-tile={type.id}
      className={`group flex min-w-0 flex-col gap-3 p-3.5 ${TILE_CLASS}`}
    >
      <span className="flex min-w-0 items-center justify-between gap-2">
        <CardTypeChip
          type={type}
          size="lg"
          className="-ml-2 min-w-0 text-slate-900 dark:text-slate-100"
        />
        {quick ? (
          <span
            role="group"
            aria-label={`${type.label} Actions`}
            className="-mr-1 flex shrink-0 items-center opacity-100 transition pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100"
          >
            {edit ? (
              <QuickAction label={`Edit ${type.label}`} onClick={() => edit(type.id)}>
                <EditGlyph />
              </QuickAction>
            ) : null}
            {addField ? (
              <QuickAction label="Add Field" onClick={() => addField(type.id)}>
                <FieldGlyph />
              </QuickAction>
            ) : null}
            {addCard && tile.usedOn.length > 0 ? (
              <QuickAction label={`Add a ${type.label}`} onClick={() => addCard(type.id)}>
                <CardGlyph />
              </QuickAction>
            ) : null}
          </span>
        ) : null}
      </span>
      <Sample tile={tile} palette={palette} />
      <Fields type={type} />
      <span className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-2 text-xs">
          <span data-type-cards="" className="font-semibold text-slate-800 dark:text-slate-100">
            {cardCountLine(tile.cards)}
          </span>
          {tile.overdue ? (
            <span
              data-type-overdue=""
              className="rounded-full bg-red-50 px-1.5 py-px text-[11px] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300"
            >
              {tile.overdue} Overdue
            </span>
          ) : null}
        </span>
        <StatusBar shares={tile.byStatus} total={tile.cards} />
      </span>
      <UsedOn
        tile={tile}
        openTab={actions.openTab}
        addToBoard={addToBoard ? (id) => addToBoard(type.id, id) : undefined}
      />
    </div>
  );
});
