import { describe, expect, it } from 'vitest';
import { valueLabel, valueOptions } from './labels';
import { parseLens } from './parse';
import type { LensContext, LensIssue } from './types';
import { announceResults, issueMessage, lensChips, lensPills } from './view-models';

const aggregate: LensContext = { view: 'aggregate', teams: [{ id: 'T1', name: 'Acme' }] };
const scoped: LensContext = { ...aggregate, view: 'scoped' };

describe('lensChips', () => {
  it('shows one chip per dimension, Space only on aggregate views', () => {
    const order = ['opens-in', 'made-by', 'edited', 'people'];
    expect(lensChips(parseLens('', aggregate), aggregate).map((c) => c.dimension)).toEqual([
      ...order,
      'space',
    ]);
    expect(lensChips(parseLens('', scoped), scoped).map((c) => c.dimension)).toEqual(order);
  });

  it('lights a multi-select chip with every value its tokens hold', () => {
    const people = lensChips(parseLens('plan people:others people:me', aggregate), aggregate)[3];
    expect(people).toEqual({
      dimension: 'people',
      label: 'People',
      control: 'multiple',
      values: ['me', 'others'],
      valueLabels: ['Me', 'Others'],
      name: 'People: Me, Others',
      options: [
        { value: null, label: 'Any', selected: false },
        { value: 'me', label: 'Me', selected: true },
        { value: 'others', label: 'Others', selected: true },
      ],
    });
  });

  it('names an unset chip as any, with Any selected', () => {
    const edited = lensChips(parseLens('', aggregate), aggregate)[2];
    expect(edited).toMatchObject({ values: [], valueLabels: [], name: 'Edited, any' });
    expect(edited?.options[0]).toEqual({ value: null, label: 'Any', selected: true });
    expect(edited?.options.map((o) => o.label)).toEqual([
      'Any',
      'Today',
      'Last 7 days',
      'Last 30 days',
      'Last 12 months',
      'This year',
    ]);
  });

  it('makes Made by AI a toggle named by itself', () => {
    const off = lensChips(parseLens('', aggregate), aggregate)[1];
    const on = lensChips(parseLens('made-by:ai', aggregate), aggregate)[1];
    expect(off).toMatchObject({ control: 'toggle', name: 'Made by AI', values: [] });
    expect(on).toMatchObject({ control: 'toggle', name: 'Made by AI', values: ['ai'] });
  });

  it('names a team by its name, never its id', () => {
    const space = lensChips(parseLens('space:team:T1,mine', aggregate), aggregate)[4];
    expect(space).toMatchObject({ values: ['mine', 'team:T1'], name: 'Space: My Documents, Acme' });
    expect(space?.options.map((o) => o.label)).toEqual([
      'Any',
      'My Documents',
      'Shared With Me',
      'Acme',
    ]);
  });
});

describe('lensPills', () => {
  it('makes a pill of every token, and none of text', () => {
    const parsed = parseLens('plan edited:30d,today made-by:ai edited:yesterday', aggregate);
    expect(lensPills(parsed, aggregate)).toEqual([
      {
        start: 5,
        end: 21,
        dimension: 'edited',
        values: ['today', '30d'],
        state: 'applied',
        label: 'Edited: Today, Last 30 days',
        name: 'Filter Edited: Today, Last 30 days',
        removeName: 'Remove filter Edited: Today, Last 30 days',
        note: null,
      },
      {
        start: 22,
        end: 32,
        dimension: 'made-by',
        values: ['ai'],
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
      label: 'Space: My Documents',
      name: 'Filter Space: My Documents, not applied: The breadcrumb sets the space here, so Space filters don’t apply.',
      note: 'The breadcrumb sets the space here, so Space filters don’t apply.',
    });
  });

  it('makes no pill of the word being typed', () => {
    expect(lensPills(parseLens('edited:to', aggregate, 9), aggregate)).toEqual([]);
  });
});

describe('issueMessage', () => {
  const issue = (input: string, context = aggregate): LensIssue =>
    parseLens(input, context).issues[0]!;

  it.each([
    ['colour:red', '“colour:red” isn’t a filter, so it’s searched as text.'],
    ['people:', '“people:” needs a value, so it’s searched as text.'],
    ['edited:7d,', '“edited:7d,” needs a value, so it’s searched as text.'],
    ['people:everyone', '“everyone” isn’t a People option, so it’s searched as text.'],
    ['space:team:', '“space:team:” needs a value, so it’s searched as text.'],
    ['space:team:nope', 'That team isn’t one of yours, so it’s searched as text.'],
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
    expect(valueLabel('edited', 'yesterday', [])).toBe('yesterday');
  });

  it('orders teams by name', () => {
    const teams = [
      { id: 'b', name: 'beta' },
      { id: 'a', name: 'Alpha' },
    ];
    expect(valueOptions('space', teams).map((o) => o.label)).toEqual([
      'My Documents',
      'Shared With Me',
      'Alpha',
      'beta',
    ]);
  });
});
