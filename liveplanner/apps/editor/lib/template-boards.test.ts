import { normaliseBoardSetup, type PlanBoardSetup } from '@liveplanner/items';
import {
  PLAN_TEMPLATE_KINDS,
  isSpreadsheetPlanTemplate,
  isPlanTemplate,
} from '@liveplanner/templates';
import { describe, expect, it } from 'vitest';
import type { Element } from '@liveplanner/project';
import { buildTemplate } from './template-builders';

// Structure pins for the Plan templates (docs/specs/026-plan/plan-templates.md). Each test maps to a sentence of that
// spec.

type Shape = Extract<Element, { type: 'shape' }>;

const shapesOf = (els: Element[], shape: string) =>
  els.filter((el): el is Shape => el.type === 'shape' && el.shape === shape);

// The Plan templates (docs/specs/026-plan/plan-mode.md "Templates"): one Plan board each, the set-up
// its use wants, and seed items that land in the board's columns. Blank Plan is the exception
// (docs/specs/026-plan/plan-templates.md "Blank Plan"): an empty tab, so Plan offers Start Planning; and the
// spreadsheet templates ("Spreadsheet templates") hold a Sheet in place of a board.
const SHEET_KINDS = PLAN_TEMPLATE_KINDS.filter(isSpreadsheetPlanTemplate);
describe('plan templates', () => {
  const kinds = PLAN_TEMPLATE_KINDS.filter(
    (kind) => kind !== 'blank-plan' && !(SHEET_KINDS as readonly string[]).includes(kind),
  );

  it('makes each spreadsheet template, Blank Spreadsheet among them, a Sheet and no board, opening in Plan', () => {
    expect(SHEET_KINDS).toHaveLength(13);
    for (const kind of SHEET_KINDS) {
      const els = buildTemplate(kind, 0, 0);
      expect(shapesOf(els, 'plan-sheet'), kind).toHaveLength(1);
      expect(shapesOf(els, 'plan-board'), kind).toHaveLength(0);
      expect(isPlanTemplate(kind), kind).toBe(true);
    }
  });

  it('makes Blank Plan an empty tab, opening in Plan', () => {
    expect(buildTemplate('blank-plan', 0, 0)).toEqual([]);
    expect(isPlanTemplate('blank-plan')).toBe(true);
  });

  it('each make one Plan board with a valid set-up, opening in Plan', () => {
    for (const kind of kinds) {
      const board = buildTemplate(kind, 0, 0).find(
        (el) => el.type === 'shape' && el.shape === 'plan-board',
      ) as { planBoard?: unknown } | undefined;
      expect(board, kind).toBeDefined();
      expect(normaliseBoardSetup(board!.planBoard), kind).not.toBeNull();
      expect(isPlanTemplate(kind), kind).toBe(true);
    }
  });

  it('starts the retro face-down with votes', () => {
    const retro = buildTemplate('team-retro', 0, 0);
    const board = retro.find((el) => el.type === 'shape' && el.shape === 'plan-board') as {
      planBoard: PlanBoardSetup;
    };
    expect(board.planBoard.hideWriting).toBe(true);
    expect('voting' in board.planBoard).toBe(false);
    // Its how-to is a note on the template's Overview, not beside the board (plan-tabs.md "Templates").
    expect(retro.some((el) => el.type === 'sticky')).toBe(false);
  });
});
