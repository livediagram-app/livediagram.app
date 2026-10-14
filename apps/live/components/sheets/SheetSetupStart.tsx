'use client';

// Setup Sheet's steps before Style (docs/specs/029-sheets/sheet.md "Setup Sheet"): Start From, an option row per
// start; and for Plan Cards, Cards (the Cards panel's own search and filters) then Columns (the fields those cards have).
import type { ReactNode } from 'react';
import { itemTitle, namedStatus, typeIn, type Item, type ItemTypeDef } from '@livediagram/items';
import { PlanTypeGlyph } from '@/components/plan/plan-type-glyph';
import { ACCENT_TEXT, accentVars } from '@/components/plan/plan-palette';
import { NoMatches, PlanCardsIcon } from '@livediagram/ui';
import { lucideGlyph } from '@livediagram/ui';
import {
  lucideBookOpen,
  lucideCalculator,
  lucideChartNoAxesColumnIncreasing,
  lucideCircleCheck,
  lucideClipboardCheck,
  lucideClock,
  lucideCoins,
  lucideFileText,
  lucideFileUp,
  lucideGift,
  lucideListTodo,
  lucidePackage,
  lucideTable,
  lucideUsers,
} from '@livediagram/icons/lucide';
import {
  SHEET_TEMPLATE_GROUPS,
  SHEET_TEMPLATES,
  type SheetStartId,
  type SheetTemplateId,
} from '@livediagram/sheets';
import { CardSearchControls, type CardSearch } from '@/components/plan/CardSearchControls';
import { OptionRows } from '@/components/plan/OptionRows';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import type { PlanPalette } from '@/components/plan/plan-palette';

export type SetupStart = SheetStartId | 'cards' | 'csv';

// Every card table has these (a row is a card by its Number, named by its Title, of a Type, in a State); the rest are
// the person's choice.
export const CARD_COLUMNS_REQUIRED: readonly string[] = ['Number', 'Title', 'Type', 'State'];

// The card panel's built-in fields as column names, in the order offered.
const BUILT_IN_COLUMNS: readonly [string, string][] = [
  ['assignee', 'Assignee'],
  ['priority', 'Priority'],
  ['estimate', 'Estimate'],
  ['start', 'Start'],
  ['due', 'Due'],
  ['labels', 'Labels'],
];

// The columns the cards found can fill (sheet.md "Setup Sheet"): the required four, then each field one of their
// card types has (the built-ins, then custom fields by name, first type first).
export function columnsForCards(
  cards: readonly { type: string }[],
  types: readonly ItemTypeDef[],
): string[] {
  const used = types.filter((t) => cards.some((c) => c.type === t.id));
  const has = (id: string) => used.some((t) => t.fields.includes(id));
  const out = [
    ...CARD_COLUMNS_REQUIRED,
    ...BUILT_IN_COLUMNS.filter(([id]) => has(id)).map(([, name]) => name),
  ];
  for (const t of used)
    for (const f of t.custom ?? [])
      if (t.fields.includes(f.id) && !out.includes(f.label)) out.push(f.label);
  return out;
}

const HEADING = 'text-[11px] font-semibold uppercase tracking-wider';

const G = (prims: Parameters<typeof lucideGlyph>[0]) => lucideGlyph(prims, 15);
const BlankGlyph = G(lucideTable);
const CsvGlyph = G(lucideFileUp);

// Each template's glyph in its row.
export const TEMPLATE_GLYPHS: Record<SheetTemplateId, ReturnType<typeof G>> = {
  budget: G(lucideCoins),
  tracker: G(lucideListTodo),
  timesheet: G(lucideClock),
  contacts: G(lucideUsers),
  invoice: G(lucideFileText),
  expenses: G(lucideClipboardCheck),
  pipeline: G(lucideChartNoAxesColumnIncreasing),
  inventory: G(lucidePackage),
  guests: G(lucideGift),
  grades: G(lucideBookOpen),
  habits: G(lucideCircleCheck),
  loan: G(lucideCalculator),
};

type StartRow = { id: SetupStart; label: string; hint: string; icon: ReactNode };

// The starts that are not templates: nothing, the document's cards, a file.
const BASICS: readonly StartRow[] = [
  { id: 'blank', label: 'Blank', hint: 'An empty grid', icon: <BlankGlyph /> },
  {
    id: 'cards',
    label: 'Plan Cards',
    hint: 'Your cards as rows, linked both ways',
    icon: <PlanCardsIcon size={15} />,
  },
  { id: 'csv', label: 'Import CSV', hint: 'A .csv or .tsv file', icon: <CsvGlyph /> },
];

// The templates under their headings (Money, Work, People and Life), in the catalogue's order.
const TEMPLATE_GROUPS = SHEET_TEMPLATE_GROUPS.map((group) => ({
  group,
  rows: SHEET_TEMPLATES.filter((t) => t.group === group).map((t): StartRow => {
    const Glyph = TEMPLATE_GLYPHS[t.id];
    return { id: t.id, label: t.name, hint: t.line, icon: <Glyph /> };
  }),
}));

const iconChip = (icon: ReactNode) => (
  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
    {icon}
  </span>
);

export function SheetSetupStart({
  palette,
  start,
  onStart,
  plan,
  live,
}: {
  palette: PlanPalette;
  start: SetupStart;
  onStart: (s: SetupStart) => void;
  // Plan Cards is offered when the document has live cards.
  plan: Pick<PlanContextValue, 'items' | 'types' | 'statusNames'> | undefined;
  live: readonly Item[];
}) {
  const basics = BASICS.filter((s) => s.id !== 'cards' || (plan && live.length > 0));
  const rowsOf = (rows: readonly StartRow[]) =>
    rows.map((s) => ({ id: s.id, label: s.label, detail: s.hint, icon: iconChip(s.icon) }));
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-1.5" aria-labelledby="setup-sheet-start">
        <h3 id="setup-sheet-start" className={HEADING} style={{ color: palette.muted }}>
          Start From
        </h3>
        <OptionRows
          kind="single"
          label="Start From"
          palette={palette}
          selected={start}
          onPick={(id) => onStart(id as SetupStart)}
          rows={rowsOf(basics)}
        />
      </section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {TEMPLATE_GROUPS.map(({ group, rows }) => {
          const id = `setup-sheet-${group.replace(/\W+/g, '-').toLowerCase()}`;
          return (
            <section key={group} className="flex min-w-0 flex-col gap-1.5" aria-labelledby={id}>
              <h3 id={id} className={HEADING} style={{ color: palette.muted }}>
                {group}
              </h3>
              <OptionRows
                kind="single"
                label={`${group} Templates`}
                palette={palette}
                selected={start}
                onPick={(pick) => onStart(pick as SetupStart)}
                rows={rowsOf(rows)}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}

// Setup Sheet's Cards step, for a start from Plan Cards: the Cards panel's own search and filters, and how many cards
// they find.
export function SheetSetupCards({
  palette,
  plan,
  live,
  search,
}: {
  palette: PlanPalette;
  plan: Pick<PlanContextValue, 'items' | 'types' | 'statusNames'>;
  live: readonly Item[];
  search: CardSearch;
}) {
  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="setup-sheet-cards">
      <h3 id="setup-sheet-cards" className={HEADING} style={{ color: palette.muted }}>
        Cards
      </h3>
      <p className="text-[12px]" style={{ color: palette.muted }}>
        Search and filter as the Cards panel does; each card found becomes a row.
      </p>
      <CardSearchControls plan={plan} live={live} search={search} />
      {search.found.length === 0 ? (
        // The shared no-match empty state, never a bare line (docs/specs/004-interface-design/empty-states.md).
        <NoMatches
          size="regular"
          ink={palette}
          things="cards"
          query={search.query}
          filters={search.filters.length}
          // It takes the words and the filters together, and says so when both are in force.
          clearsBoth
          onClear={() => {
            search.setQuery('');
            search.setFilters([]);
          }}
        />
      ) : (
        <p role="status" className="text-[12px]" style={{ color: palette.muted }}>
          {`${search.found.length} ${search.found.length === 1 ? 'card' : 'cards'}`}
        </p>
      )}
      <CardsPreview palette={palette} plan={plan} cards={search.found} />
    </section>
  );
}

// How many cards the Cards step shows as a sample of what the search keeps.
export const SETUP_PREVIEW_CARDS = 10;

// A sample of the cards found, first by number as the rows will be: each its type's glyph, number, title and state.
// Only a look at what is filtered: nothing here opens.
function CardsPreview({
  palette,
  plan,
  cards,
}: {
  palette: PlanPalette;
  plan: Pick<PlanContextValue, 'types' | 'statusNames'>;
  cards: readonly Item[];
}) {
  if (!cards.length) return null;
  const shown = [...cards].sort((a, b) => a.key - b.key).slice(0, SETUP_PREVIEW_CARDS);
  const more = cards.length - shown.length;
  return (
    <div>
      <ul
        aria-label="Cards found"
        className="divide-y overflow-hidden rounded-lg border"
        style={{ borderColor: palette.border }}
      >
        {shown.map((card) => {
          const type = typeIn(plan.types, card.type);
          const status = namedStatus(card, plan.statusNames);
          return (
            <li
              key={card.id}
              className="flex items-center gap-2 px-2.5 py-1.5 text-[12px]"
              style={{ borderColor: palette.border }}
            >
              <span className={`shrink-0 ${ACCENT_TEXT}`} style={accentVars(type.color)}>
                <PlanTypeGlyph glyph={type.glyph} size={13} />
              </span>
              <span className="shrink-0 tabular-nums" style={{ color: palette.muted }}>
                #{card.key}
              </span>
              <span className="min-w-0 flex-1 truncate" style={{ color: palette.text }}>
                {itemTitle(card)}
              </span>
              <span className="shrink-0 text-[11px]" style={{ color: palette.muted }}>
                {status ? (plan.statusNames.get(status) ?? status) : 'No status'}
              </span>
            </li>
          );
        })}
      </ul>
      {more > 0 ? (
        <p className="mt-1.5 text-[12px]" style={{ color: palette.muted }}>
          and {more} more
        </p>
      ) : null}
    </div>
  );
}

// Setup Sheet's Columns step, for a start from Plan Cards: the fields the cards found can fill, Number, Title, Type
// and State always among them.
export function SheetSetupColumns({
  palette,
  offered,
  columns,
  onColumns,
}: {
  palette: PlanPalette;
  // The columns the cards found can fill (columnsForCards), in order.
  offered: readonly string[];
  columns: readonly string[];
  onColumns: (c: string[]) => void;
}) {
  return (
    <section className="flex flex-col gap-1.5" aria-labelledby="setup-sheet-columns">
      <h3 id="setup-sheet-columns" className={HEADING} style={{ color: palette.muted }}>
        Columns
      </h3>
      <p className="text-[12px]" style={{ color: palette.muted }}>
        The fields your cards have, one column each. Number, Title, Type and State are always there.
      </p>
      <OptionRows
        kind="multiple"
        label="Columns"
        palette={palette}
        selected={columns}
        onPick={(f) =>
          CARD_COLUMNS_REQUIRED.includes(f)
            ? undefined
            : onColumns(
                columns.includes(f)
                  ? columns.filter((x) => x !== f)
                  : offered.filter((x) => x === f || columns.includes(x)),
              )
        }
        rows={offered.map((f) => ({
          id: f,
          label: f,
          // The required ones are always on.
          disabled: CARD_COLUMNS_REQUIRED.includes(f),
          ...(CARD_COLUMNS_REQUIRED.includes(f) ? { detail: 'Always included' } : {}),
        }))}
      />
    </section>
  );
}
