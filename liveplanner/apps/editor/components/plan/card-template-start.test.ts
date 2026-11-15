import { describe, expect, it } from 'vitest';
import {
  CARD_TEMPLATES_MAX,
  ITEM_TYPES,
  ITEM_TYPES_MAX,
  type ItemTypeDef,
} from '@liveplanner/items';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { addCardChoices, hasTemplates, newCardOf, templateSummary } from './card-template-start';

// docs/specs/026-plan/item-types.md "Where a card is added, its templates are offered".
const task: ItemTypeDef = ITEM_TYPES.find((t) => t.id === 'task')!;
const note = ITEM_TYPES.find((t) => t.id === 'note')!;
const BUG_REPORT = {
  id: 'tp-bug-report',
  name: 'Bug Report',
  fields: {
    title: 'Bug: ',
    description: 'Steps to reproduce',
    checklist: [{ text: 'Reproduce it', done: false }],
    labels: ['bug'],
  },
};
const RELEASE = { id: 'tp-release', name: 'Release', fields: {} };
const withTemplates: ItemTypeDef = {
  ...task,
  fieldLabels: { checklist: 'Steps' },
  custom: [...(task.custom ?? []), { id: 'f-area', label: 'Area', kind: 'text' }],
  fields: [...task.fields, 'f-area'],
  templates: [BUG_REPORT, RELEASE],
};

describe('card-template-start', () => {
  it('lists each type, its templates straight after it', () => {
    const choices = addCardChoices([withTemplates, note]);
    expect(choices.map((c) => c.id)).toEqual([
      'task',
      'task::tp-bug-report',
      'task::tp-release',
      'note',
    ]);
    expect(choices[1]!.template).toBe(BUG_REPORT);
    expect(choices[3]!.template).toBeUndefined();
  });

  it('says whether a type has templates', () => {
    expect(hasTemplates(withTemplates)).toBe(true);
    expect(hasTemplates(task)).toBe(false);
    expect(hasTemplates({ templates: [] })).toBe(false);
  });

  it('starts a blank card with its type’s new-card title', () => {
    expect(newCardOf(task)).toEqual({ type: 'task', fields: { title: 'New task' } });
  });

  it('starts a card from a template over the new-card title, naming the template', () => {
    expect(newCardOf(withTemplates, BUG_REPORT)).toEqual({
      type: 'task',
      fields: BUG_REPORT.fields,
      template: 'tp-bug-report',
    });
    // A template without a title keeps the type's.
    expect(newCardOf(withTemplates, RELEASE).fields).toEqual({ title: 'New task' });
  });

  it('never puts a value its type no longer offers on the card', () => {
    const gone = { id: 'tp-gone', name: 'Gone', fields: { 'f-missing': 'x', title: 'Kept' } };
    expect(newCardOf(withTemplates, gone).fields).toEqual({ title: 'Kept' });
  });

  it('names what a template fills, in the type’s order and its own names', () => {
    const area = { id: 'tp-area', name: 'Area', fields: { 'f-area': 'Billing', title: 'T' } };
    expect(templateSummary(withTemplates, BUG_REPORT)).toBe('Title, Description, Steps, Labels');
    expect(templateSummary(withTemplates, area)).toBe('Title, Area');
    // A description's formatting reads as the description, once.
    const rich = {
      id: 'tp-rich',
      name: 'Rich',
      fields: { description: 'x', descriptionRich: [{ text: 'x' }] },
    };
    expect(templateSummary(withTemplates, rich as never)).toBe('Description');
    expect(templateSummary(withTemplates, RELEASE)).toBe('Starts blank');
  });
});

// docs/specs/026-plan/item-types.md "Card templates": the worst case a catalogue holds (every type it may have, each
// with its 10 templates of every field it takes) lists and summarises well inside a frame.
describe('card-template-start at its limits', () => {
  it('lists and summarises a full catalogue cheaply', () => {
    const fields = Object.fromEntries(
      withTemplates.fields.map((f) => [f, f === 'checklist' ? [] : f === 'labels' ? ['x'] : 'v']),
    );
    const full: ItemTypeDef[] = Array.from({ length: ITEM_TYPES_MAX }, (_, i) => ({
      ...withTemplates,
      id: `t-${i}`,
      templates: Array.from({ length: CARD_TEMPLATES_MAX }, (_, j) => ({
        id: `tp-${j}`,
        name: `Template ${j}`,
        fields,
      })),
    }));
    const run = () => {
      for (const c of addCardChoices(full)) if (c.template) templateSummary(c.type, c.template);
    };
    run();
    expect(addCardChoices(full)).toHaveLength(ITEM_TYPES_MAX * (CARD_TEMPLATES_MAX + 1));
    expect(cpuMsOf(run)).toBeLessThan(cpuBudgetMs(16));
  });
});
