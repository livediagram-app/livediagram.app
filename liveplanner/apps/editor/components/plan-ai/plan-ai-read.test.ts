import { describe, expect, it } from 'vitest';
import type { FormDefinition } from '@liveplanner/forms';
import { PLAN_AI_TAB_MAX, type ItemTypeDef } from '@liveplanner/items';
import { forPeople } from './plan-ai-lines';
import { readBoard, readDashboard, readFormTab, valueText, withinBound } from './plan-ai-read';
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
              { id: 'f', span: 2, content: { type: 'note', title: 'Aim', text: 'Ship it' } },
              { id: 'g', span: 2, content: { type: 'tab', tabId: 'b1', of: 'sheet' } },
              { id: 'h', span: 2 },
            ],
          },
        ],
      },
      [{ id: 'b1', name: 'Costs', kind: 'sheet' }],
    );
    expect(text).toContain('a note "Aim": Ship it');
    expect(text).toContain('the sheet tab "Costs"');
    expect(text).toContain('shows empty');
    expect(text).toContain('"Costs" (sheet)');
    expect(text).toContain('the board tab "a deleted tab"');
    expect(text).toContain('a view "Burn-up"');
    expect(text).toContain('a view or chart');
    expect(text).toContain('a title "Q3"');
    expect(text).toContain('shows status');
    expect(readDashboard({ rows: [] }, [])).toContain('(No rows yet.)');
  });
});

describe('readBoard', () => {
  it('says each column’s cards in rank order with their fields, leaving out what the board does not show', () => {
    const items = new Map(
      [
        card(
          'a',
          1,
          { title: 'Later', status: 'todo', priority: 'High', labels: ['ux', 'web'] },
          { rank: 'b' },
        ),
        card('b', 2, { title: 'First', status: 'todo', due: '2026-12-01' }, { rank: 'a' }),
        card('c', 3, { title: 'Same', status: 'todo' }, { rank: 'b' }),
        card('d', 4, { title: 'Filed', status: 'todo', archived: true }),
        card('e', 5, { title: 'No status' }),
        card('f', 6, { title: 'A bug', status: 'todo', 'f-sev': 'High' }, { type: 'bug' }),
        card('g', 7, { title: 'Plain', status: 'done' }, { type: 'note' }),
      ].map((i) => [i.id, i]),
    );
    const note: ItemTypeDef = {
      id: 'note',
      label: 'Note',
      newTitle: 'New note',
      glyph: 'note',
      color: '#000000',
      fields: ['title'],
    };
    const text = readBoard({
      setup: { ...SETUP, addTypes: ['task', 'note'] },
      items,
      types: [...TYPES, note],
    });
    expect(text).toContain('- Task: Size (number)\n- Note\n');
    expect(text).not.toContain('Severity');
    expect(text).toContain('Column "To Do" (3 cards):');
    expect(text).toContain('Column "Done" (1 card):');
    expect(text.indexOf('First')).toBeLessThan(text.indexOf('Later'));
    expect(text).toContain('Priority: High | Labels: ux, web');
    expect(text).toContain('Due: 2026-12-01');
    expect(text).not.toContain('Filed');
    expect(text).not.toContain('No status');
    expect(text).not.toContain('A bug');

    const later = { id: 'c3', status: 'later', name: 'Later' };
    const archive = readBoard({
      setup: { ...SETUP, columns: [...SETUP.columns, later], archive: true },
      items,
      types: TYPES,
    });
    expect(archive).toContain('Column "Later" (0 cards):');
    expect(archive).toContain('Filed');
    expect(archive).toContain('- Bug: Severity (choice: Low, High)');
    expect(archive).toContain('Severity: High');

    const bare = readBoard({ setup: { ...SETUP, columns: [], addTypes: [] }, items, types: TYPES });
    expect(bare).toContain('Columns, left to right: none');
    expect(bare).toContain('- none yet');
  });
});

describe('readFormTab', () => {
  const form = (sections: FormDefinition['sections'], description?: string): FormDefinition => ({
    v: 1,
    heading: 'Sign-up',
    ...(description ? { description } : {}),
    sections,
  });

  it('says each section’s questions by id, with what each asks for', () => {
    const text = readFormTab(
      form(
        [
          {
            id: 's1',
            title: '',
            questions: [
              { id: 'q1', type: 'short', prompt: 'Name', required: true, help: 'Your full name' },
              { id: 'q2', type: 'single', prompt: 'Size', options: ['S', 'M'] },
              { id: 'q3', type: 'content', prompt: 'A note' },
            ],
          },
          { id: 's2', title: 'More', questions: [{ id: 'q4', type: 'paragraph', prompt: 'Why?' }] },
        ],
        'Join the team',
      ),
    );
    expect(text).toContain('Description: Join the team');
    expect(text).toContain('3 questions in 2 sections:');
    expect(text).toContain('Section 1:\n- [q1] short: "Name" | required | help: "Your full name"');
    expect(text).toContain('- [q2] single: "Size" | options: S, M');
    expect(text).not.toContain('A note');
    expect(text).toContain('Section 2 "More":\n- [q4] paragraph: "Why?"');
    const one = readFormTab(form([{ id: 's1', title: '', questions: [] }]));
    expect(one).toContain('0 questions in 1 section:');
    expect(one).not.toContain('Description');
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
