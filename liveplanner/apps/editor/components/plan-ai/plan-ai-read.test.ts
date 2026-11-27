import { describe, expect, it } from 'vitest';
import { PLAN_AI_TAB_MAX } from '@liveplanner/items';
import { forPeople } from './plan-ai-lines';
import { readBoard, readDashboard, valueText, withinBound } from './plan-ai-read';
import { ITEMS, SETUP, TYPES, card } from './plan-ai-fixtures';

// What Plan AI is sent of a tab (docs/specs/026-plan/plan-ai.md "What it may change").

describe('valueText', () => {
  it('says a value in words: a linked card by title, a list joined, a flag as yes', () => {
    expect(valueText(null)).toBeNull();
    expect(valueText('')).toBeNull();
    expect(valueText('i1', ITEMS)).toBe('Write brief');
    expect(valueText('  two\n lines ')).toBe('two lines');
    expect(valueText(4)).toBe('4');
    expect(valueText(true)).toBe('yes');
    expect(valueText(false)).toBeNull();
    expect(valueText(['a', 2, null])).toBe('a, 2');
    expect(valueText([null])).toBeNull();
    expect(valueText({ start: 1 })).toBeNull();
    expect(valueText('x'.repeat(400))!.length).toBe(160);
  });
});

describe('withinBound', () => {
  it('keeps to the bound and says how many lines were left out', () => {
    const lines = Array.from({ length: 400 }, (_, i) => `${i} ${'x'.repeat(100)}`);
    const text = withinBound(['Head'], lines, 'rows');
    expect(text.length).toBeLessThanOrEqual(PLAN_AI_TAB_MAX);
    expect(text).toMatch(/more rows left out: too many to send\.\)$/);
    expect(withinBound(['Head'], ['a'], 'rows')).toBe('Head\na');
  });
});

describe('readDashboard', () => {
  it('says what each slot shows', () => {
    const text = readDashboard(
      {
        rows: [
          {
            id: 'r',
            height: 200,
            slots: [
              { id: 'a', span: 3, content: { type: 'tab', tabId: 'gone' } },
              { id: 'b', span: 3, content: { type: 'element', elementId: 'e', name: 'Burn-up' } },
              { id: 'c', span: 2, content: { type: 'element', elementId: 'e' } },
              { id: 'd', span: 2, content: { type: 'title', title: 'Q3', text: '' } },
              { id: 'e', span: 2, content: { type: 'status' } as never },
            ],
          },
        ],
      },
      [],
    );
    expect(text).toContain('the board tab "a deleted tab"');
    expect(text).toContain('a view "Burn-up"');
    expect(text).toContain('a view or chart');
    expect(text).toContain('a title "Q3"');
    expect(text).toContain('shows status');
    expect(readDashboard({ rows: [] }, [])).toContain('(No rows yet.)');
  });
});

describe('reading a big board', () => {
  it('reads 5,000 cards within the bound, in well under a frame budget per thousand', () => {
    const items = new Map(
      Array.from({ length: 5000 }, (_, i) => {
        const c = card(`c${i}`, i + 1, {
          title: `Card ${i} ${'words '.repeat(10)}`,
          status: i % 2 ? 'todo' : 'done',
          description: 'x'.repeat(2000),
          'f-size': i,
        });
        return [c.id, c] as const;
      }),
    );
    const started = performance.now();
    const text = readBoard({ setup: SETUP, items, types: TYPES });
    const took = performance.now() - started;
    expect(text.length).toBeLessThanOrEqual(PLAN_AI_TAB_MAX);
    expect(text).toMatch(/left out: too many to send/);
    // Linear: measured about 15 ms locally; the budget leaves room for a slow runner.
    expect(took).toBeLessThan(500);
  });
});

describe('forPeople', () => {
  it('drops the sentence naming an agent’s next tool', () => {
    expect(forPeople('No item "x". List them with list_items.')).toBe('No item "x".');
    expect(forPeople('Use change_items.')).toBe('Use change_items.');
  });
});
