import { describe, expect, it } from 'vitest';
import type { FormLinkResponse } from '@livediagram/api-schema';
import { bugForm, formWorld } from '../testing/forms';
import { readFormOf } from './form-read';

// read_form's answer (docs/specs/030-forms/forms.md "Agents"): the form in words, its state and its problems.
const link = (open: boolean, responses = 2): FormLinkResponse => ({
  link: { code: 'AbCdEfGhIjKlMnOpQrStUv', open, createdAt: 1 },
  responses,
  unseen: 1,
  suspendedAt: null,
  canPublish: true,
});
const read = (form = bugForm(), l: FormLinkResponse | null = null) => {
  const world = formWorld();
  return readFormOf({
    tabId: 'form',
    form,
    boards: world.boards,
    sheets: world.sheets,
    types: world.types,
    link: l,
    now: 0,
  });
};

describe('readFormOf', () => {
  it('reads each answer’s place by name and where responses go', () => {
    const r = read();
    expect(r.respondsTo).toEqual({ to: 'board', board: 'Bugs', cardType: 'Bug', column: 'New' });
    expect(r.sections[0]!.questions.map((q) => q.goesTo)).toEqual([
      'Title',
      'Severity',
      'Description',
    ]);
    expect(r).toMatchObject({ state: 'not_published', code: null, problems: [] });
  });

  it('says accepting, closed and why, paused, or suspended', () => {
    expect(read(bugForm(), link(true))).toMatchObject({
      state: 'accepting',
      code: 'AbCdEfGhIjKlMnOpQrStUv',
      responses: 2,
    });
    expect(read(bugForm(), link(false))).toMatchObject({
      state: 'closed',
      closedReason: 'switched_off',
    });
    expect(read({ ...bugForm(), limit: 2 }, link(true))).toMatchObject({
      state: 'closed',
      closedReason: 'limit',
    });
    const gone = { ...bugForm(), destination: { ...bugForm().destination!, status: 'gone' } };
    expect(read(gone, link(true))).toMatchObject({
      state: 'paused',
      respondsToProblem: 'Its column was removed. Choose where responses go.',
    });
    expect(read(bugForm(), { ...link(true), link: null, suspendedAt: 5 })).toMatchObject({
      state: 'suspended',
    });
  });

  it('names the question each problem is about', () => {
    const form = bugForm();
    const unworded = {
      ...form,
      sections: [
        { ...form.sections[0]!, questions: [{ id: 'q-x', type: 'short' as const, prompt: '' }] },
      ],
    };
    expect(read(unworded).problems).toEqual([
      'A question has no wording yet. ("Untitled Question", q-x)',
    ]);
  });

  it('lists what stops it being published, in Share Form’s words', () => {
    const r = read({ v: 1, heading: 'Empty', sections: [{ id: 's', title: '', questions: [] }] });
    expect(r.respondsTo).toEqual({ to: 'nowhere' });
    expect(r.problems).toEqual([
      'Responses have nowhere to go: Choose where responses go.',
      'Add a question: a form needs at least one.',
    ]);
  });

  it('reads a sheet form by its sheet, without mappings, and its closed link plainly', () => {
    const r = read(
      { ...bugForm(), sheet: { tabId: 'budget', sheetId: 'sheet_budget' } },
      link(true),
    );
    expect(r.respondsTo).toEqual({ to: 'sheet', sheet: 'Budget' });
    expect(r.sections[0]!.questions.every((q) => q.goesTo === undefined)).toBe(true);
    expect(r.sections[0]!.questions.map((q) => q.column)).toEqual([
      'Summary',
      'Severity',
      'Can we contact you?',
    ]);
    expect(r.state).toBe('accepting');
  });
});

describe('readFormOf, every part', () => {
  it('reads each setting, a broken mapping, the settings and the cover', () => {
    const form = bugForm();
    const q = form.sections[0]!.questions;
    const full = {
      ...form,
      description: 'Tell us.',
      cover: { fill: { kind: 'solid' as const, color: '#0f766e' } },
      closesAt: Date.UTC(2026, 11, 1),
      limit: 9,
      confirmation: 'Ta',
      closedMessage: 'Shut',
      sections: [
        {
          ...form.sections[0]!,
          questions: [
            ...q,
            { id: 'q-n', type: 'number' as const, prompt: 'N', whole: true as const },
            {
              id: 'q-d',
              type: 'single' as const,
              prompt: 'D',
              options: ['a'],
              dropdown: true as const,
              other: true as const,
            },
            {
              id: 'q-f',
              type: 'short' as const,
              prompt: 'F',
              goesTo: { to: 'field' as const, fieldId: 'gone' },
            },
          ],
        },
      ],
    };
    const r = read(full);
    const byId = Object.fromEntries(r.sections[0]!.questions.map((x) => [x.id, x]));
    expect(byId['q-n']).toMatchObject({ whole: true });
    expect(byId['q-d']).toMatchObject({ dropdown: true, other: true });
    expect(byId['q-f']).toMatchObject({ goesTo: 'Description', goesToBroken: true });
    expect(r).toMatchObject({
      description: 'Tell us.',
      cover: full.cover,
      settings: {
        closesAt: '2026-12-01T00:00:00.000Z',
        limit: 9,
        confirmation: 'Ta',
        closedMessage: 'Shut',
      },
    });
  });

  it('says what was removed: the sheet, or the board, type and column', () => {
    expect(read({ ...bugForm(), sheet: { tabId: 'x', sheetId: 'gone' } }).respondsTo).toEqual({
      to: 'sheet',
      sheet: '(removed)',
    });
    const world = formWorld();
    const gone = { ...bugForm(), destination: { tabId: 'old', typeId: 'nope', status: 'x' } };
    const r = readFormOf({
      tabId: 'form',
      form: gone,
      boards: world.boards,
      sheets: world.sheets,
      types: world.types,
      tabNames: new Map([['old', 'Old Board']]),
      link: null,
    });
    expect(r.respondsTo).toEqual({
      to: 'board',
      board: 'Old Board',
      cardType: '(removed)',
      column: '(removed)',
    });
    const nameless = readFormOf({
      tabId: 'form',
      form: gone,
      boards: [],
      sheets: [],
      types: [],
      link: null,
    });
    expect(nameless.respondsTo).toMatchObject({ board: '(removed)' });
  });

  it('reads a later section’s title, description and rule, and a rule whose question went', () => {
    const form = bugForm();
    const two = {
      ...form,
      sections: [
        form.sections[0]!,
        {
          id: 's-2',
          title: 'More',
          description: 'Extra',
          showIf: { questionId: 'q-sev', anyOf: ['High'] },
          questions: [],
        },
        { id: 's-3', title: '', showIf: { questionId: 'gone', anyOf: ['x'] }, questions: [] },
      ],
    };
    const r = read(two);
    expect(r.sections[1]).toMatchObject({
      title: 'More',
      description: 'Extra',
      showIf: { prompt: 'Severity', anyOf: ['High'] },
    });
    expect(r.sections[2]).toMatchObject({ showIf: { prompt: '(removed)' }, showIfBroken: true });
    expect(r.problems).toContain(
      'A section shows only on an answer that is no longer there. (section 3)',
    );
  });

  it('reads the time now when none is given', () => {
    const world = formWorld();
    const r = readFormOf({
      tabId: 'form',
      form: bugForm(),
      boards: world.boards,
      sheets: world.sheets,
      types: world.types,
      link: link(true),
    });
    expect(r.state).toBe('accepting');
  });
});

describe('readFormOf, boards and sheets', () => {
  it('reads a board that takes every type, and a sheet form with no board as open', () => {
    const world = formWorld();
    const every = readFormOf({
      tabId: 'form',
      form: bugForm(),
      boards: [{ ...world.boards[0]!, types: null }],
      sheets: [],
      types: world.types,
      link: null,
    });
    expect(every.respondsToProblem).toBeUndefined();
    const sheetOnly = {
      ...bugForm(),
      destination: undefined,
      sheet: { tabId: 'budget', sheetId: 'sheet_budget' },
    };
    const r = readFormOf({
      tabId: 'form',
      form: sheetOnly,
      boards: [],
      sheets: world.sheets,
      types: world.types,
      link: link(true),
      now: 0,
    });
    expect(r).toMatchObject({ state: 'accepting' });
    expect(r.closedReason).toBeUndefined();
  });
});

describe('readFormOf, a live board form with nowhere to send', () => {
  it('reads it as closed for want of a destination', () => {
    const r = read({ ...bugForm(), destination: undefined }, link(true));
    expect(r).toMatchObject({ state: 'closed', closedReason: 'no_destination' });
  });
});
