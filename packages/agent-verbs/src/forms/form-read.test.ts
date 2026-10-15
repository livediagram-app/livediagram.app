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
