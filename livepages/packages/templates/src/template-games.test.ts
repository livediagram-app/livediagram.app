import { describe, expect, it } from 'vitest';
import type { Element, ShapeElement } from '@livepages/document';
import { buildTemplate } from './build-template';
import { templateCategory } from './template-categories';
import { templateEditorMode } from './template-modes';
import { BINGO_PROMPTS, ICEBREAKER_QUESTIONS } from './template-games-data';
import type { TemplateKind } from './templates';

// docs/specs/012-collaboration/game-templates.md "Testing".
const GAMES: readonly TemplateKind[] = ['icebreaker-questions', 'people-bingo'];

const shapes = (els: Element[], shape: string): ShapeElement[] =>
  els.filter((e): e is ShapeElement => e.type === 'shape' && e.shape === shape);

describe('game templates', () => {
  it.each(GAMES)('%s opens in Workshop, files under Games and builds', (kind) => {
    expect(templateEditorMode(kind)).toBe('workshop');
    expect(templateCategory(kind)).toBe('games');
    expect(buildTemplate(kind, 0, 0).length).toBeGreaterThan(5);
  });

  it('spins the icebreaker questions from a written list, each short enough for the Picker', () => {
    const pickers = shapes(buildTemplate('icebreaker-questions', 0, 0), 'picker');
    const written = pickers.find((p) => p.pickerSource === 'options');
    expect(written?.pickerOptions).toEqual(ICEBREAKER_QUESTIONS);
    for (const q of ICEBREAKER_QUESTIONS) expect(q.length, q).toBeLessThanOrEqual(80);
    expect(pickers.filter((p) => p.pickerSource !== 'options')).toHaveLength(1);
  });

  it('lays out sixteen distinct bingo prompts', () => {
    expect(new Set(BINGO_PROMPTS).size).toBe(16);
    const cells = shapes(buildTemplate('people-bingo', 0, 0), 'square');
    expect(cells.map((c) => c.label)).toEqual(BINGO_PROMPTS);
  });
});
