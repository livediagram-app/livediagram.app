import { describe, expect, it } from 'vitest';
import type { PlanBoardSetup } from './board';
import { boardCsvImport, boardCsvRows } from './board-csv';
import { checklistProgress, customFieldText, personName } from './card-text';
import { validateFields } from './fields';
import { ITEM_TYPES, builtInFieldOfKind, type ItemTypeDef } from './item-types';
import { resolveFields } from './plan-names';
import { canBeRequired } from './required-fields';
import { applyCardTypeChanges } from './type-changes';
import { defaultCatalogue, validateItemTypeCatalogue } from './type-catalogue';
import { SAM, item } from './test-items';

// The built-in fields' kinds as custom field kinds (docs/specs/026-plan/item-types.md "Custom field kinds"), and the
// Image kind ("Image fields"): stored, read, exported, imported and named as their built-in fields are.

const REVIEW: ItemTypeDef = {
  ...ITEM_TYPES[1],
  id: 'review',
  label: 'Review',
  fields: ['title', 'status', 'f-reviewer', 'f-areas', 'f-tone', 'f-steps', 'f-shot'],
  custom: [
    { id: 'f-reviewer', label: 'Reviewer', kind: 'person' },
    { id: 'f-areas', label: 'Areas', kind: 'labels' },
    { id: 'f-tone', label: 'Tone', kind: 'colour' },
    { id: 'f-steps', label: 'Steps', kind: 'checklist' },
    { id: 'f-shot', label: 'Shot', kind: 'image' },
  ],
};
const field = (id: string) => REVIEW.custom!.find((f) => f.id === id)!;

describe('the kinds', () => {
  it('maps each built-in kind to its built-in field, and no other', () => {
    expect(builtInFieldOfKind('person')).toBe('assignee');
    expect(builtInFieldOfKind('labels')).toBe('labels');
    expect(builtInFieldOfKind('colour')).toBe('color');
    expect(builtInFieldOfKind('checklist')).toBe('checklist');
    expect(builtInFieldOfKind('image')).toBeUndefined();
    expect(builtInFieldOfKind('text')).toBeUndefined();
  });

  it('lets every kind be required but an Image', () => {
    expect(canBeRequired('person')).toBe(true);
    expect(canBeRequired('checklist')).toBe(true);
    expect(canBeRequired('image')).toBe(false);
  });

  it('keeps a catalogue holding them, and an agent makes them (color as Colour)', () => {
    const stored = validateItemTypeCatalogue({ version: 1, types: [REVIEW] });
    expect(stored.ok && stored.catalogue.types[0]!.custom!.map((f) => f.kind)).toEqual([
      'person',
      'labels',
      'colour',
      'checklist',
      'image',
    ]);
    const changed = applyCardTypeChanges(
      defaultCatalogue(),
      [{ op: 'add', name: 'Review', custom: [{ name: 'Accent', kind: 'Color' }] }],
      [],
    );
    if (!changed.ok) throw new Error(changed.message);
    expect(changed.catalogue!.types.at(-1)!.custom).toMatchObject([
      { label: 'Accent', kind: 'colour' },
    ]);
  });
});

describe('the store', () => {
  it('keeps a person and checklist rows under a custom field, checked as the built-ins are', () => {
    expect(validateFields({ 'f-reviewer': SAM }, 'patch')).toEqual({
      ok: true,
      fields: { 'f-reviewer': SAM },
    });
    const rows = [{ text: 'Draft', done: true }];
    expect(validateFields({ 'f-steps': rows }, 'patch')).toEqual({
      ok: true,
      fields: { 'f-steps': rows },
    });
    expect(validateFields({ 'f-reviewer': { id: 'x' } }, 'patch')).toMatchObject({ ok: false });
    expect(validateFields({ 'f-steps': [{ text: 1, done: true }] }, 'patch')).toMatchObject({
      ok: false,
    });
    expect(validateFields({ 'f-steps': [{}, 'a'] }, 'patch')).toMatchObject({ ok: false });
    expect(validateFields({ 'f-areas': ['a', 'b'], 'f-shot': 'img_1' }, 'patch')).toMatchObject({
      ok: true,
    });
    expect(validateFields({ 'f-areas': [] }, 'patch')).toMatchObject({ ok: true });
  });
});

describe('as text', () => {
  it('reads each kind as its built-in field reads, and an Image as nothing', () => {
    expect(customFieldText(field('f-reviewer'), SAM)).toBe('Sam Lee');
    expect(customFieldText(field('f-areas'), ['Web', 'Q3'])).toBe('Web, Q3');
    expect(customFieldText(field('f-tone'), '#0D9488')).toBe('#0d9488');
    expect(customFieldText(field('f-tone'), 'teal')).toBeNull();
    expect(
      customFieldText(field('f-steps'), [
        { text: 'a', done: true },
        { text: 'b', done: false },
      ]),
    ).toBe('1/2');
    expect(customFieldText(field('f-steps'), [])).toBeNull();
    expect(customFieldText(field('f-shot'), 'img_1')).toBeNull();
  });

  it('names a person, and nothing that is not one', () => {
    expect(personName(SAM)).toBe('Sam Lee');
    expect(personName({ id: 'x', name: '  ', color: '#000000' })).toBeNull();
    expect(personName('Sam')).toBeNull();
    expect(personName(['Sam'])).toBeNull();
    expect(personName(undefined)).toBeNull();
  });

  it('counts a Checklist field’s progress by its id', () => {
    const card = item({ title: 'T', 'f-steps': [{ text: 'a', done: true }] });
    expect(checklistProgress(card, 'f-steps')).toEqual({ done: 1, total: 1 });
    expect(checklistProgress(card)).toBeNull();
  });
});

describe('CSV', () => {
  const setup: PlanBoardSetup = {
    title: 'Reviews',
    columns: [{ id: 'c1', status: 'todo', name: 'To Do' }],
    swimlaneBy: 'none',
    cardFields: [],
    hideWriting: false,
    addTypes: ['review'],
  };

  it('writes a person, labels, a colour and a checklist’s progress, and leaves an Image out', () => {
    const card = item(
      {
        title: 'Home page',
        status: 'todo',
        'f-reviewer': SAM,
        'f-areas': ['Web', 'Q3'],
        'f-tone': '#0d9488',
        'f-steps': [
          { text: 'a', done: true },
          { text: 'b', done: false },
        ],
        'f-shot': 'img_1',
      },
      { type: 'review' },
    );
    const rows = boardCsvRows(setup, new Map([[card.id, card]]), [REVIEW]);
    expect(rows[0]).toEqual(['Key', 'Title', 'Type', 'Status', 'Reviewer', 'Areas', 'Tone', 'Steps']);
    expect(rows[1]!.slice(4)).toEqual(['Sam Lee', 'Web, Q3', '#0d9488', '1/2']);
  });

  it('reads a person by name, labels and a colour, and never a checklist or an image', () => {
    const { creates } = boardCsvImport(
      [
        ['Title', 'Reviewer', 'Areas', 'Tone', 'Steps', 'Shot'],
        ['Home page', 'sam lee', 'Web; Q3', '#0D9488', '1/2', 'img_1'],
      ],
      { setup, types: [REVIEW], people: [SAM], room: 10 },
    );
    expect(creates[0]!.fields).toEqual({
      title: 'Home page',
      'f-reviewer': SAM,
      'f-areas': ['Web', 'Q3'],
      'f-tone': '#0d9488',
    });
  });
});

describe('agents', () => {
  const naming = { statuses: [], items: [item({ title: 'A', assignee: SAM })] };

  it('name a person, labels and a colour as the built-ins take them, by the field’s name', () => {
    expect(
      resolveFields(
        {
          Reviewer: 'Sam Lee',
          Areas: 'Web, Q3',
          Tone: '#0d9488',
          Steps: [{ text: 'a', done: false }],
        },
        REVIEW,
        naming,
      ),
    ).toEqual({
      ok: true,
      fields: {
        'f-reviewer': SAM,
        'f-areas': ['Web', 'Q3'],
        'f-tone': '#0d9488',
        'f-steps': [{ text: 'a', done: false }],
      },
    });
  });

  it('are refused a value the built-in would refuse, by the field’s name, and any Image', () => {
    expect(resolveFields({ Tone: 'teal' }, REVIEW, naming)).toMatchObject({
      ok: false,
      message: expect.stringContaining('is not a Tone'),
    });
    expect(resolveFields({ Shot: 'img_1' }, REVIEW, naming)).toMatchObject({
      ok: false,
      message: 'Shot is an image: add one in the card panel.',
    });
  });
});
