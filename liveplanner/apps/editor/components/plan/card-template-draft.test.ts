import { describe, expect, it } from 'vitest';
import { CARD_TEMPLATES_MAX, type CardTemplate } from '@liveplanner/items';
import {
  addTemplate,
  moveTemplate,
  newTemplateName,
  removeTemplate,
  settledTemplates,
  templateFieldsOf,
  templateItem,
  templateNameProblem,
  templatesProblem,
  withFieldValue,
  withPatch,
  withTemplate,
} from './card-template-draft';

// docs/specs/026-plan/item-types.md "Editing a type": Templates, the draft the tab edits.
const t = (id: string, name: string, fields: CardTemplate['fields'] = {}): CardTemplate => ({
  id,
  name,
  fields,
});
const A = t('tp-a', 'A');
const B = t('tp-b', 'B');
const C = t('tp-c', 'C');

describe('adding a template', () => {
  it('names it New Template, then New Template 2 while one has the name', () => {
    expect(newTemplateName([])).toBe('New Template');
    expect(newTemplateName([t('x', 'new template ')])).toBe('New Template 2');
    expect(newTemplateName([t('x', 'New Template'), t('y', 'New Template 2')])).toBe(
      'New Template 3',
    );
  });

  it('adds an empty one at the end with an id of its own, and none past the cap', () => {
    const first = addTemplate([A]);
    expect(first.templates).toEqual([A, { id: first.id, name: 'New Template', fields: {} }]);
    const second = addTemplate([first.templates[1]!, t('draft-3', 'x')]);
    expect(second.id).toBe('draft-4');
    const full = Array.from({ length: CARD_TEMPLATES_MAX }, (_, i) => t(`tp-${i}`, `T${i}`));
    expect(addTemplate(full)).toEqual({ templates: full, id: null });
  });
});

describe('moving, changing and removing', () => {
  it('moves one place, and stays put at an end or for an unknown id', () => {
    expect(moveTemplate([A, B, C], 'tp-c', -1)).toEqual([A, C, B]);
    expect(moveTemplate([A, B, C], 'tp-a', -1)).toEqual([A, B, C]);
    expect(moveTemplate([A, B, C], 'tp-c', 1)).toEqual([A, B, C]);
    expect(moveTemplate([A, B, C], 'nope', 1)).toEqual([A, B, C]);
  });

  it('changes one template only', () => {
    expect(withTemplate([A, B], 'tp-b', (x) => ({ ...x, name: 'Bee' }))).toEqual([
      A,
      { ...B, name: 'Bee' },
    ]);
  });

  it('chooses the next template after a removal, else the one before, else none', () => {
    expect(removeTemplate([A, B, C], 'tp-b')).toEqual({ templates: [A, C], next: 'tp-c' });
    expect(removeTemplate([A, B, C], 'tp-c')).toEqual({ templates: [A, B], next: 'tp-b' });
    expect(removeTemplate([A], 'tp-a')).toEqual({ templates: [], next: null });
  });
});

describe('values', () => {
  it('sets a value, and clears one with its formatting', () => {
    const fields = { description: 'x', descriptionRich: [{ text: 'x' }], labels: ['a'] };
    expect(withFieldValue(fields, 'labels', ['b'])).toMatchObject({ labels: ['b'] });
    expect(withFieldValue(fields, 'description', undefined)).toEqual({ labels: ['a'] });
  });

  it('applies a panel write', () => {
    expect(withPatch({ a: 1, b: 2 }, { set: { c: 3 }, clear: ['a'] })).toEqual({ b: 2, c: 3 });
    expect(withPatch({ a: 1 }, { set: { a: 2 } })).toEqual({ a: 2 });
  });

  it('shows the fields a template holds, in the type’s order, less the title', () => {
    const type = {
      fields: ['title', 'status', 'due', 'labels', 'description', 'f-x', 'f-calc'],
      custom: [
        { id: 'f-x', label: 'X', kind: 'text' as const },
        {
          id: 'f-calc',
          label: 'Calc',
          kind: 'calculated' as const,
          calculation: 'childCount' as const,
        },
      ],
    };
    expect(templateFieldsOf(type)).toEqual(['labels', 'description', 'f-x']);
  });

  it('stands a card in for the template, holding its values', () => {
    const item = templateItem({ id: 'bug' }, t('tp-a', 'A', { title: 'Hi' }));
    expect(item).toMatchObject({ id: 'template-tp-a', type: 'bug', fields: { title: 'Hi' } });
  });
});

describe('Save', () => {
  it('gives each template added this session an id from its name, a stored one keeping its own', () => {
    const settled = settledTemplates([
      t('tp-bug-report', 'Bug Report'),
      t('draft-1', ' Bug Report '),
      t('draft-2', 'Release'),
    ]);
    expect(settled.map((x) => [x.id, x.name])).toEqual([
      ['tp-bug-report', 'Bug Report'],
      ['tp-bug-report-2', 'Bug Report'],
      ['tp-release', 'Release'],
    ]);
  });

  it('says a blank or clashing name under its field', () => {
    expect(templateNameProblem([A], t('tp-a', '  '))).toBe('Give the template a name.');
    expect(templateNameProblem([A, B], t('tp-b', 'a'))).toBe('Another template has this name.');
    expect(templateNameProblem([A, B], B)).toBeNull();
  });

  it('answers the first thing that stops Save', () => {
    expect(templatesProblem([A, t('x', ' ')], 0)).toEqual({
      message: 'Give every template a name.',
      templateId: 'x',
    });
    expect(templatesProblem([A, t('x', 'a ')], 0)).toEqual({
      message: 'Two templates have the same name.',
      templateId: 'x',
    });
    const big = t('big', 'Big', { description: 'x'.repeat(17_000) });
    expect(templatesProblem([big], 0)).toEqual({
      message: 'Big holds more than 16 KB: shorten it.',
      templateId: 'big',
    });
    expect(templatesProblem([A], 131_072)).toEqual({
      message: 'The plan’s card templates hold more than 128 KB: shorten or remove one.',
    });
    expect(templatesProblem([A, B], 0)).toBeNull();
    expect(templatesProblem([], 131_072)).toBeNull();
  });
});
