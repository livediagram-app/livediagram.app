// Configure's presets (docs/specs/026-plan/plan-board.md "Configure"): ready-made ways to lay out the cards a board
// already holds, each one swimlanes, a sort and a card size at once. They never touch the columns or the cards, so
// any of them is safe to try and one undo away. Only the presets the board's card types can show are offered, and
// they are ordered by how much of the board's content they use (a lane by person on a board where most cards have
// someone on them comes first; on a board of five or more cards where nobody is assigned, it is left out).
import {
  boardAddTypes,
  withArticle,
  itemAssignee,
  itemStatus,
  ARCHIVED_FIELD,
  type BoardSortLevel,
  type Item,
  type ItemTypeDef,
  type PlanBoardSetup,
} from '@liveplanner/items';

// The drawing a preset shows (PresetArt): rows by person, rows by type, rows by another field, sorted cards, small
// cards or plain columns.
export type PresetArtKind = 'people' | 'types' | 'lanes' | 'sorted' | 'overview' | 'simple';

// The most a board is offered; past it, the least fitting are left out.
export const MAX_PRESETS = 9;

export interface BoardPreset {
  // A fixed id ('people'), or one drawn from a card type's own field ('lane:f-stage', 'sort:f-renewal').
  id: string;
  title: string;
  // What it does, in one line.
  detail: string;
  // Why it suits this board, from its cards ("5 of 8 cards have someone on them"), when there is a reason.
  reason?: string;
  art: PresetArtKind;
  // The parts of the set-up it sets.
  apply: (setup: PlanBoardSetup) => PlanBoardSetup;
  // Whether the board is already laid out this way.
  active: boolean;
}
// How many cards the board shows: its types', in its columns (any status on an All Cards board), not archived.
export function boardCards(
  setup: PlanBoardSetup,
  types: readonly ItemTypeDef[],
  items: Iterable<Item>,
): Item[] {
  const shown = new Set(boardAddTypes(setup, types).map((t) => t.id));
  const statuses = new Set(setup.columns.map((c) => c.status));
  const out: Item[] = [];
  for (const item of items) {
    if (!shown.has(item.type) || item.fields[ARCHIVED_FIELD] === true) continue;
    const status = itemStatus(item);
    if (!setup.allCards && (status === undefined || !statuses.has(status))) continue;
    out.push(item);
  }
  return out;
}

// Below this many cards the board's content is too thin to rule a preset out.
const FEW_CARDS = 5;

const has = (v: unknown) => v !== undefined && v !== null && v !== '';
const share = (n: number, of: number) => (of === 0 ? 0 : n / of);
const cardsWord = (n: number) => (n === 1 ? 'card' : 'cards');

// The set-up with these layout parts and nothing else of the layout: lanes, sort (absent is rank order) and size
// (absent is Detailed), as the board's own settings store them.
function layout(
  setup: PlanBoardSetup,
  lanes: PlanBoardSetup['swimlaneBy'],
  sortBy: BoardSortLevel[],
  size: 'minimal' | 'detailed',
  field?: string,
): PlanBoardSetup {
  const { swimlaneField: _f, sortBy: _s, cardSize: _z, ...rest } = setup;
  return {
    ...rest,
    swimlaneBy: lanes,
    ...(lanes === 'field' && field ? { swimlaneField: field } : {}),
    ...(sortBy.length ? { sortBy } : {}),
    ...(size === 'minimal' ? { cardSize: 'minimal' as const } : {}),
  };
}

const sameSort = (a: readonly BoardSortLevel[] | undefined, b: readonly BoardSortLevel[]) =>
  (a ?? []).length === b.length &&
  b.every((l, i) => a?.[i]?.field === l.field && a[i]?.dir === l.dir);

const isLayout = (
  setup: PlanBoardSetup,
  lanes: PlanBoardSetup['swimlaneBy'],
  sortBy: BoardSortLevel[],
  size: 'minimal' | 'detailed',
  field?: string,
) =>
  setup.swimlaneBy === lanes &&
  (lanes !== 'field' || setup.swimlaneField === field) &&
  sameSort(setup.sortBy, sortBy) &&
  (setup.cardSize === 'minimal' ? 'minimal' : 'detailed') === size;

interface Candidate {
  id: string;
  title: string;
  detail: string;
  art: PresetArtKind;
  lanes: PlanBoardSetup['swimlaneBy'];
  // The field a 'field' lane groups by.
  field?: string;
  sortBy: BoardSortLevel[];
  size: 'minimal' | 'detailed';
  // How well it fits the board, 0 to 1; below 0 it is not offered.
  fit: number;
  reason?: string;
}

const LEADS: readonly string[] = ['simple', 'overview'];
const lead = (id: string) => {
  const i = LEADS.indexOf(id);
  return i < 0 ? LEADS.length : i;
};

/**
 * The presets this board can use, at most MAX_PRESETS: Simple Columns, Compact Overview, then the rest best fit first,
 * the board's own card types' fields among them (a row per Stage, the soonest Renewal first).
 */
export function boardPresets(
  setup: PlanBoardSetup,
  types: readonly ItemTypeDef[],
  items: Iterable<Item>,
): BoardPreset[] {
  const shownTypes = boardAddTypes(setup, types);
  const offers = (field: string) => shownTypes.some((t) => t.fields.includes(field));
  const cards = boardCards(setup, types, items);
  const n = cards.length;
  // Too few cards to judge by: offer what the types can show, as on an empty board.
  const few = n < FEW_CARDS;
  const count = (pick: (i: Item) => boolean) => cards.reduce((k, i) => k + (pick(i) ? 1 : 0), 0);

  const assigned = count((i) => !!itemAssignee(i));
  const prioritised = count((i) => has(i.fields['priority']));
  const dated = count((i) => has(i.fields['due']));
  const typesUsed = new Set(cards.map((i) => i.type)).size;
  const due: BoardSortLevel = { field: 'due', dir: 'asc' };
  const priority: BoardSortLevel = { field: 'priority', dir: 'desc' };

  const candidates: Candidate[] = [];
  if (offers('assignee') && !setup.allCards)
    candidates.push({
      id: 'people',
      art: 'people',
      title: 'By Person',
      detail: 'A row for each person, so everyone sees their own work.',
      lanes: 'assignee',
      sortBy: offers('due') ? [due] : [],
      size: 'detailed',
      // A board where nobody is assigned has nothing to show by person.
      fit: few ? 0.3 : assigned === 0 ? -1 : share(assigned, n),
      ...(assigned ? { reason: `${assigned} of ${n} ${cardsWord(n)} have someone on them` } : {}),
    });
  if (offers('priority'))
    candidates.push({
      id: 'urgent',
      art: 'sorted',
      title: 'Most Urgent First',
      detail: 'Highest priority at the top of every column, then the soonest due.',
      lanes: 'none',
      sortBy: offers('due') ? [priority, due] : [priority],
      size: 'detailed',
      fit: few ? 0.25 : prioritised === 0 ? -1 : share(prioritised, n),
      ...(prioritised ? { reason: `${prioritised} of ${n} ${cardsWord(n)} have a priority` } : {}),
    });
  if (offers('due'))
    candidates.push({
      id: 'deadlines',
      art: 'sorted',
      title: 'Deadlines First',
      detail: 'The soonest due at the top, so nothing slips.',
      lanes: 'none',
      sortBy: [due],
      size: 'detailed',
      fit: few ? 0.2 : dated === 0 ? -1 : share(dated, n) * 0.95,
      ...(dated ? { reason: `${dated} of ${n} ${cardsWord(n)} have a due date` } : {}),
    });
  if (shownTypes.length > 1)
    candidates.push({
      id: 'types',
      art: 'types',
      title: 'By Card Type',
      detail: 'A row for each card type, so bugs, tasks and the rest stay apart.',
      lanes: 'type',
      sortBy: [],
      size: 'detailed',
      fit: typesUsed > 1 ? 0.6 : few ? 0.15 : -1,
    });
  if (offers('priority'))
    candidates.push({
      id: 'priority-lanes',
      art: 'lanes',
      title: 'By Priority',
      detail: 'A row for each priority, the most pressing work on top.',
      lanes: 'priority',
      sortBy: offers('due') ? [due] : [],
      size: 'detailed',
      fit: few ? 0.18 : prioritised === 0 ? -1 : share(prioritised, n) * 0.85,
    });
  if (offers('labels')) {
    const labelled = count(
      (i) => Array.isArray(i.fields['labels']) && i.fields['labels'].length > 0,
    );
    candidates.push({
      id: 'labels',
      art: 'lanes',
      title: 'By Label',
      detail: 'A row for each label, so themes and areas sit together.',
      lanes: 'field',
      field: 'labels',
      sortBy: [],
      size: 'detailed',
      fit: few ? 0.12 : labelled === 0 ? -1 : share(labelled, n) * 0.8,
      ...(labelled ? { reason: `${labelled} of ${n} ${cardsWord(n)} have a label` } : {}),
    });
  }
  if (offers('estimate')) {
    const sized = count((i) => has(i.fields['estimate']));
    const sizedFit = few ? 0.12 : sized === 0 ? -1 : share(sized, n);
    const sizedReason = sized
      ? { reason: `${sized} of ${n} ${cardsWord(n)} have an estimate` }
      : {};
    candidates.push({
      id: 'quick-wins',
      art: 'sorted',
      title: 'Quick Wins First',
      detail: 'The smallest estimates at the top, to clear easy work fast.',
      lanes: 'none',
      sortBy: [{ field: 'estimate', dir: 'asc' }],
      size: 'detailed',
      fit: sizedFit < 0 ? -1 : sizedFit * 0.75,
      ...sizedReason,
    });
    candidates.push({
      id: 'biggest',
      art: 'sorted',
      title: 'Biggest First',
      detail: 'The largest estimates at the top, to plan around them.',
      lanes: 'none',
      sortBy: [{ field: 'estimate', dir: 'desc' }],
      size: 'detailed',
      fit: sizedFit < 0 ? -1 : sizedFit * 0.6,
      ...sizedReason,
    });
  }
  if (offers('start')) {
    const started = count((i) => has(i.fields['start']));
    candidates.push({
      id: 'starting',
      art: 'sorted',
      title: 'Starting Soon',
      detail: 'The soonest start date at the top, to see what begins next.',
      lanes: 'none',
      sortBy: [{ field: 'start', dir: 'asc' }],
      size: 'detailed',
      fit: few ? 0.1 : started === 0 ? -1 : share(started, n) * 0.7,
      ...(started ? { reason: `${started} of ${n} ${cardsWord(n)} have a start date` } : {}),
    });
  }
  if (shownTypes.length) {
    candidates.push({
      id: 'newest',
      art: 'sorted',
      title: 'Newest First',
      detail: 'The latest cards at the top, so new requests are seen.',
      lanes: 'none',
      sortBy: [{ field: 'createdAt', dir: 'desc' }],
      size: 'detailed',
      fit: few ? 0.05 : 0.15,
    });
    candidates.push({
      id: 'recent',
      art: 'sorted',
      title: 'Recently Changed',
      detail: 'The cards edited last at the top, to catch up on what moved.',
      lanes: 'none',
      sortBy: [{ field: 'updatedAt', dir: 'desc' }],
      size: 'detailed',
      fit: few ? 0.04 : 0.12,
    });
  }
  candidates.push(...typeFieldCandidates(shownTypes, cards, few));
  candidates.push({
    id: 'overview',
    art: 'overview',
    title: 'Compact Overview',
    detail: 'Small cards and no rows, to take in the whole board at once.',
    lanes: 'none',
    sortBy: [],
    size: 'minimal',
    // The more cards, the more an overview helps.
    fit: Math.min(0.7, n / 40),
    ...(n >= 12 ? { reason: `${n} cards to take in` } : {}),
  });
  candidates.push({
    id: 'simple',
    art: 'simple',
    title: 'Simple Columns',
    detail: 'Just the columns, cards in the order you put them.',
    lanes: 'none',
    sortBy: [],
    size: 'detailed',
    fit: 0.1,
  });

  const seen = new Set<string>();
  return (
    candidates
      .filter((c) => c.fit >= 0)
      // Simple Columns and Compact Overview lead, always there as the plain starting points; the rest follow by fit.
      .sort((a, b) => lead(a.id) - lead(b.id) || b.fit - a.fit)
      // A card type's field named as a built-in ("Priority") is offered once, the better fit.
      .filter((c) => !seen.has(c.title) && !!seen.add(c.title))
      .slice(0, MAX_PRESETS)
      .map(({ id, title, detail, art, reason, lanes, field, sortBy, size }) => ({
        id,
        title,
        detail,
        art,
        ...(reason ? { reason } : {}),
        apply: (s: PlanBoardSetup) => layout(s, lanes, sortBy, size, field),
        active: isLayout(setup, lanes, sortBy, size, field),
      }))
  );
}

// The kinds a card type's own field sorts by, and which way: a number largest first, a date soonest first.
const SORT_DESC = new Set(['number', 'currency', 'percent', 'rating', 'duration']);

// Presets from the card types' own fields (docs/specs/026-plan/plan-board.md "Configure"): a row per value of a
// Choice or Checkbox field ("By Stage"), and the cards sorted by a number or date field ("Earliest Renewal First").
// They fit a little better than the general presets at the same share, as they are this board's own.
function typeFieldCandidates(
  shownTypes: readonly ItemTypeDef[],
  cards: readonly Item[],
  few: boolean,
): Candidate[] {
  const n = cards.length;
  const out: Candidate[] = [];
  const done = new Set<string>();
  for (const t of shownTypes)
    for (const c of t.custom ?? []) {
      if (done.has(c.id) || !t.fields.includes(c.id)) continue;
      done.add(c.id);
      const filled = cards.reduce(
        (k, i) =>
          k + ((c.kind === 'checkbox' ? i.fields[c.id] === true : has(i.fields[c.id])) ? 1 : 0),
        0,
      );
      const fit = (weight: number) =>
        few ? weight * 0.35 : filled === 0 ? -1 : share(filled, n) * weight;
      const reason = filled
        ? `${filled} of ${n} ${cardsWord(n)} have ${withArticle(c.label)}`
        : `From your ${t.label} cards`;
      if (c.kind === 'choice' || c.kind === 'checkbox') {
        const opts = c.options ?? [];
        out.push({
          id: `lane:${c.id}`,
          art: 'lanes',
          title: `By ${c.label}`,
          detail:
            c.kind === 'checkbox'
              ? `${c.label} and not ${c.label} in rows of their own.`
              : opts.length >= 2
                ? `A row for each ${c.label}, from ${opts[0]} to ${opts[opts.length - 1]}.`
                : `A row for each ${c.label}.`,
          lanes: 'field',
          field: c.id,
          sortBy: [],
          size: 'detailed',
          fit: fit(1.05),
          reason,
        });
      } else if (SORT_DESC.has(c.kind) || c.kind === 'date' || c.kind === 'datetime') {
        const desc = SORT_DESC.has(c.kind);
        out.push({
          id: `sort:${c.id}`,
          art: 'sorted',
          title: desc ? `Highest ${c.label} First` : `Earliest ${c.label} First`,
          detail: desc
            ? `The largest ${c.label} at the top of every column.`
            : `The soonest ${c.label} at the top of every column.`,
          lanes: 'none',
          sortBy: [{ field: c.id, dir: desc ? 'desc' : 'asc' }],
          size: 'detailed',
          fit: fit(0.9),
          reason,
        });
      }
    }
  return out;
}
