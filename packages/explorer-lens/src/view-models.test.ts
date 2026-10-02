import { describe, expect, it } from 'vitest';
import { valueLabel, valueOptions } from './labels';
import { parseLens } from './parse';
import type { LensContext, LensIssue } from './types';
import { announceResults, issueMessage, lensChips, lensPills } from './view-models';

const aggregate: LensContext = { view: 'aggregate', teams: [{ id: 'T1', name: 'Acme' }] };
const scoped: LensContext = { ...aggregate, view: 'scoped' };

describe('lensChips', () => {
  it('shows one chip per dimension, Space only on aggregate views', () => {
    const order = ['opens-in', 'board', 'made-by', 'edited', 'people'];
    expect(lensChips(parseLens('', aggregate), aggregate).map((c) => c.dimension)).toEqual([
      ...order,
      'space',
    ]);
    expect(lensChips(parseLens('', scoped), scoped).map((c) => c.dimension)).toEqual(order);
  });

  it('lights the chip of a typed token', () => {
    const board = lensChips(parseLens('plan board:kanban', aggregate), aggregate)[1];
    expect(board).toEqual({
      dimension: 'board',
      label: 'Board',
      control: 'menu',
      value: 'kanban',
      valueLabel: 'Kanban',
      name: 'Board: Kanban',
      options: [
        { value: null, label: 'Any', selected: false },
        { value: 'event-storming', label: 'Event storming', selected: false },
        { value: 'retrospective', label: 'Retrospective', selected: false },
        { value: 'kanban', label: 'Kanban', selected: true },
      ],
    });
  });

  it('names an unset chip as any, with Any selected', () => {
    const edited = lensChips(parseLens('', aggregate), aggregate)[3];
    expect(edited).toMatchObject({ value: null, valueLabel: null, name: 'Edited, any' });
    expect(edited?.options[0]).toEqual({ value: null, label: 'Any', selected: true });
  });

  it('makes Made by AI a toggle named by itself', () => {
    const off = lensChips(parseLens('', aggregate), aggregate)[2];
    const on = lensChips(parseLens('made-by:ai', aggregate), aggregate)[2];
    expect(off).toMatchObject({ control: 'toggle', name: 'Made by AI', value: null });
    expect(on).toMatchObject({ control: 'toggle', name: 'Made by AI', value: 'ai' });
  });

  it('names a team by its name, never its id', () => {
    const space = lensChips(parseLens('space:team:T1', aggregate), aggregate)[5];
    expect(space).toMatchObject({ value: 'team:T1', valueLabel: 'Acme', name: 'Space: Acme' });
    expect(space?.options.map((o) => o.label)).toEqual([
      'Any',
      'My documents',
      'Shared with me',
      'Acme',
    ]);
  });

  it('lights only the applied token of a dimension', () => {
    const chips = lensChips(parseLens('board:kanban board:retrospective', aggregate), aggregate);
    expect(chips[1]?.value).toBe('retrospective');
  });
});

describe('lensPills', () => {
  it('makes a pill of every token, applied or not, and none of text', () => {
    const parsed = parseLens(
      'plan board:kanban board:retrospective made-by:ai board:mindmap',
      aggregate,
    );
    expect(lensPills(parsed, aggregate)).toEqual([
      {
        start: 5,
        end: 17,
        dimension: 'board',
        value: 'kanban',
        state: 'superseded',
        label: 'Board: Kanban',
        name: 'Filter Board: Kanban, not applied: Only the last Board filter applies.',
        removeName: 'Remove filter Board: Kanban',
        note: 'Only the last Board filter applies.',
      },
      {
        start: 18,
        end: 37,
        dimension: 'board',
        value: 'retrospective',
        state: 'applied',
        label: 'Board: Retrospective',
        name: 'Filter Board: Retrospective',
        removeName: 'Remove filter Board: Retrospective',
        note: null,
      },
      {
        start: 38,
        end: 48,
        dimension: 'made-by',
        value: 'ai',
        state: 'applied',
        label: 'Made by AI',
        name: 'Filter Made by AI',
        removeName: 'Remove filter Made by AI',
        note: null,
      },
    ]);
  });

  it('mutes a space pill on a scoped view and says why', () => {
    const [pill] = lensPills(parseLens('space:mine', scoped), scoped);
    expect(pill).toMatchObject({
      state: 'inert',
      label: 'Space: My documents',
      note: 'The breadcrumb sets the space here, so Space filters don’t apply.',
    });
  });

  it('makes no pill of the word being typed', () => {
    expect(lensPills(parseLens('board:kan', aggregate, 9), aggregate)).toEqual([]);
  });
});

describe('issueMessage', () => {
  const issue = (input: string, context = aggregate): LensIssue =>
    parseLens(input, context).issues[0]!;

  it.each([
    ['colour:red', '“colour:red” isn’t a filter, so it’s searched as text.'],
    ['board:', '“board:” needs a value, so it’s searched as text.'],
    ['board:mindmap', '“mindmap” isn’t a Board option, so it’s searched as text.'],
    ['space:team:', '“space:team:” needs a value, so it’s searched as text.'],
    ['space:team:nope', 'That team isn’t one of yours, so it’s searched as text.'],
    ['edited:7d edited:30d', 'Only the last Edited filter applies.'],
  ])('explains %s', (input, message) => {
    expect(issueMessage(issue(input))).toBe(message);
  });

  it('explains a space token on a scoped view and an over-long search', () => {
    expect(issueMessage(issue('space:shared', scoped))).toBe(
      'The breadcrumb sets the space here, so Space filters don’t apply.',
    );
    expect(issueMessage(issue('a'.repeat(600)))).toBe('The search is cut to 512 characters.');
  });
});

describe('announceResults', () => {
  it.each([
    [40, 40, '40 documents'],
    [1, 1, '1 document'],
    [12, 40, '12 of 40 documents'],
    [1, 40, '1 of 40 documents'],
    [0, 40, 'No documents match'],
    [0, 0, 'No documents match'],
  ])('announces %i shown of %i', (shown, total, message) => {
    expect(announceResults(shown, total)).toBe(message);
  });
});

describe('labels', () => {
  it('reads a team that is not the reader’s as an unknown team, and an unknown value as itself', () => {
    expect(valueLabel('space', 'team:gone', [])).toBe('Unknown team');
    expect(valueLabel('board', 'mindmap', [])).toBe('mindmap');
  });

  it('orders teams by name', () => {
    const teams = [
      { id: 'b', name: 'beta' },
      { id: 'a', name: 'Alpha' },
    ];
    expect(valueOptions('space', teams).map((o) => o.label)).toEqual([
      'My documents',
      'Shared with me',
      'Alpha',
      'beta',
    ]);
  });
});
