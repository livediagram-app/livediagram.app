import { describe, expect, it } from 'vitest';
import { TEMPLATE_CARD_TYPES } from '@liveplanner/items/template-card-types';
import { itemTitle, readRepeatRule, readItemCreate, type PlanBoardSetup } from '@liveplanner/items';
import { planTemplateSeedItems, seedDate, seedTimeZone, seedToday } from './plan-template-seeds';
import { PLAN_TEMPLATE_SEEDS } from './plan-template-seed-data';
import {
  PLAN_TEMPLATE_KINDS,
  planTemplateTabs,
  type PlanTemplateKind,
} from './template-builders-plan';
import { isSpreadsheetPlanTemplate } from './plan-template-catalogue';

const TODAY = '2026-10-12';

// The boards a template's tabs make, as their set-ups.
function boardsOf(kind: PlanTemplateKind): PlanBoardSetup[] {
  return planTemplateTabs(kind).flatMap((def) =>
    def
      .build(0, 0)
      .flatMap((el) =>
        el.type === 'shape' && el.shape === 'plan-board' && el.planBoard ? [el.planBoard] : [],
      ),
  );
}

// Whether a board shows a card: an archived card only on an Archive board, any other where a column names its
// status and the board takes its type.
function shows(board: PlanBoardSetup, type: string, status: string, archived: boolean): boolean {
  if (board.archive) return archived;
  if (archived) return false;
  const takes = !board.addTypes || board.addTypes.includes(type);
  return takes && board.columns.some((c) => c.status === status);
}

let n = 0;
const ids = () => `seed${String(++n).padStart(6, '0')}`;

// docs/specs/026-plan/plan-templates.md "Example cards".
describe('Plan template example cards', () => {
  it('seed every board template, and only those', () => {
    for (const kind of PLAN_TEMPLATE_KINDS) {
      const seeded = (PLAN_TEMPLATE_SEEDS[kind]?.length ?? 0) > 0;
      const hasBoards = boardsOf(kind).length > 0;
      expect(seeded, kind).toBe(hasBoards);
      if (isSpreadsheetPlanTemplate(kind) || kind === 'blank-plan')
        expect(seeded, kind).toBe(false);
    }
  });

  it('are cards the item store takes', () => {
    for (const kind of PLAN_TEMPLATE_KINDS) {
      for (const create of planTemplateSeedItems(kind, TODAY, ids)) {
        const read = readItemCreate(create);
        const rejected = typeof read === 'string' ? read : null;
        expect(rejected, `${kind}: ${itemTitle(create)}`).toBeNull();
      }
    }
  });

  it('each land on a board of their template, and every board shows some', () => {
    for (const kind of PLAN_TEMPLATE_KINDS) {
      const boards = boardsOf(kind);
      const cards = PLAN_TEMPLATE_SEEDS[kind] ?? [];
      for (const card of cards) {
        expect(
          boards.some((b) => shows(b, card.type, card.status, !!card.archived)),
          `${kind}: "${card.title}" (${card.type} in ${card.status}) shows on no board`,
        ).toBe(true);
      }
      for (const board of boards) {
        expect(
          cards.some((c) => shows(board, c.type, c.status, !!c.archived)),
          `${kind}: board "${board.title}" opens empty`,
        ).toBe(true);
      }
    }
  });

  it('link only cards of the same template, by their fresh ids', () => {
    for (const kind of PLAN_TEMPLATE_KINDS) {
      const made = planTemplateSeedItems(kind, TODAY, ids);
      const madeIds = new Set(made.map((c) => c.id));
      expect(madeIds.size, kind).toBe(made.length);
      for (const create of made) {
        for (const [field, value] of Object.entries(create.fields)) {
          if (field === 'parent' || field === 'f-role' || field === 'f-new-starter') {
            expect(madeIds.has(value as string), `${kind} ${field}`).toBe(true);
          }
          if (field === 'f-objective' || field === 'f-workstream') {
            expect(madeIds.has(value as string), `${kind} ${field}`).toBe(true);
          }
        }
      }
    }
  });

  // plan-templates.md "Card types a template makes": every example fills only its own type's fields, a choice with
  // one of its options, and a card field links a card of the type it names.
  it('fill only the fields their template’s own type offers', () => {
    for (const kind of PLAN_TEMPLATE_KINDS) {
      const made = planTemplateSeedItems(kind, TODAY, ids);
      const typeOf = new Map(made.map((c) => [c.id, c.type]));
      for (const create of made) {
        const type = TEMPLATE_CARD_TYPES.find((t) => t.id === create.type);
        expect(type, `${kind} ${create.type}`).toBeDefined();
        for (const [field, value] of Object.entries(create.fields)) {
          // An example's own marks, not a field.
          if (field === 'example' || field === 'archived' || field === 'repeat') continue;
          const label = `${kind} ${create.type} ${field}`;
          expect(type!.fields, label).toContain(field);
          const custom = type!.custom?.find((f) => f.id === field);
          if (custom?.kind === 'choice') expect(custom.options, label).toContain(value);
          if (custom?.kind === 'card')
            expect(typeOf.get(value as string), label).toBe(custom.linkType);
        }
      }
    }
  });

  // plan-templates.md "Example cards": Repeating examples.
  it('repeat where their work comes round, from the day they are made in their maker’s time zone', () => {
    const made = planTemplateSeedItems('weekly-planner', TODAY, ids, 'Europe/London');
    const review = made.find((c) => c.fields['title'] === 'Weekly review')!;
    const rule = readRepeatRule(review.fields['repeat']);
    expect(rule).toEqual({
      every: 'week',
      days: [5],
      status: 'fri',
      from: TODAY,
      timeZone: 'Europe/London',
    });
    expect(review.place?.status).toBe('fri');
    // Every seeded rule is one the item store keeps, and only Weekly Planner's review repeats.
    const repeating = PLAN_TEMPLATE_KINDS.flatMap((kind) =>
      planTemplateSeedItems(kind, TODAY, ids).filter((c) => c.fields['repeat'] !== undefined),
    );
    expect(repeating.map((c) => c.fields['title'])).toEqual(['Weekly review']);
    for (const c of repeating) expect(readRepeatRule(c.fields['repeat'])?.timeZone).toBe('UTC');
    expect(typeof seedTimeZone()).toBe('string');
  });

  it('date from the day they are made', () => {
    const [sync] = planTemplateSeedItems('project-planner', TODAY, ids);
    expect(sync!.fields['start']).toBe('2026-09-28');
    expect(sync!.fields['due']).toBe('2026-11-02');
    expect(seedDate('2026-12-30', 3)).toBe('2027-01-02');
    expect(seedToday(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('carry example people, never a real person id, and votes from example voters', () => {
    const made = planTemplateSeedItems('feedback-board', TODAY, ids);
    const dark = made.find((c) => c.fields['title'] === 'Dark mode')!;
    expect(Object.keys(dark.votes!)).toHaveLength(42);
    expect(Object.keys(dark.votes!).every((k) => k.startsWith('example-'))).toBe(true);
    expect((dark.fields['assignee'] as { id: string }).id).toBe('example-leo');
  });

  it('are all marked as examples', () => {
    for (const kind of PLAN_TEMPLATE_KINDS) {
      for (const create of planTemplateSeedItems(kind, TODAY, ids)) {
        expect(create.fields['example'], kind).toBe(true);
      }
    }
  });

  it('make nothing for templates with no boards', () => {
    expect(planTemplateSeedItems('blank-plan', TODAY)).toEqual([]);
    expect(planTemplateSeedItems('invoice', TODAY)).toEqual([]);
  });
});
