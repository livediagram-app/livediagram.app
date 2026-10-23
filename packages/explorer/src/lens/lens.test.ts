import { describe, expect, it } from 'vitest';
import { makeItem } from '../test/fakeClient';
import { kindWords } from '../words';
import {
  acceptSuggestion,
  chooseChipValue,
  compileLens,
  editedCutoff,
  filtersKey,
  issueMessage,
  itemSubject,
  lensChips,
  lensFilters,
  lensPills,
  parseLens,
  selectedFacets,
  serialiseLens,
  settleField,
  splitField,
  suggestTokens,
  type LensContext,
} from './index';

const TEMPLATES = [
  { value: 'retrospective', label: 'Retrospective' },
  { value: 'kanban', label: 'Kanban' },
];
const aggregate: LensContext = {
  view: 'aggregate',
  teams: [{ id: 'T1', name: 'Acme' }],
  templates: TEMPLATES,
};
const scoped: LensContext = { ...aggregate, view: 'scoped' };
const words = kindWords('liveplanner');

describe('parsing', () => {
  it('reads tokens, comma lists, repeats and text, in canonical order', () => {
    const { lens, issues } = parseLens(
      'road edited:7d template:kanban,retrospective MADE-BY:AI template:kanban map',
      aggregate,
    );
    expect(issues).toEqual([]);
    expect(lens.text).toEqual(['road', 'map']);
    expect(lens.filters).toEqual({
      template: ['retrospective', 'kanban'],
      'made-by': ['ai'],
      edited: ['7d'],
      people: [],
      space: [],
    });
    expect(serialiseLens(lens)).toBe('template:retrospective,kanban made-by:ai edited:7d road map');
  });

  it('names every word it cannot read, and searches it as text', () => {
    const { lens, issues } = parseLens(
      'colour:red template: edited:soon space:team:nope',
      aggregate,
    );
    expect(lens.text).toEqual(['colour:red', 'template:', 'edited:soon', 'space:team:nope']);
    expect(issues.map((i) => i.reason)).toEqual([
      'unknown_dimension',
      'missing_value',
      'unknown_value',
      'unknown_team',
    ]);
    expect(issueMessage(issues[2]!, words)).toBe(
      '“soon” isn’t an Edited option, so it’s searched as text.',
    );
  });

  it('keeps Space on a scoped view, unapplied and explained', () => {
    const { lens, issues, terms } = parseLens('space:mine', scoped);
    expect(lens.filters.space).toEqual([]);
    expect(terms[0]).toMatchObject({ kind: 'token', state: 'inert' });
    expect(issueMessage(issues[0]!, words)).toMatch(/breadcrumb sets the space/);
  });

  it('reads an old link’s Opens in as no filter at all, and says so', () => {
    const { lens, issues } = parseLens('opens-in:plan roadmap', aggregate);
    expect(lens.text).toEqual(['roadmap']);
    expect(issues[0]!.reason).toBe('retired');
    expect(issueMessage(issues[0]!, words)).toMatch(/Plans \/ All switch/);
  });

  it('has no Template filter when the host names no families', () => {
    const none = { ...aggregate, templates: [] };
    expect(parseLens('template:kanban', none).issues[0]!.reason).toBe('unknown_dimension');
    expect(lensChips(parseLens('', none), none).map((c) => c.dimension)).toEqual([
      'made-by',
      'edited',
      'people',
      'space',
    ]);
  });

  it('holds the word under the caret as pending', () => {
    const parsed = parseLens('edited:7', aggregate, 8);
    expect(parsed.terms[0]!.kind).toBe('pending');
    expect(parsed.issues).toEqual([]);
  });
});

describe('the field and the chips', () => {
  it('moves a finished token into the pills and keeps the caret in the words', () => {
    const settled = settleField('road made-by:ai ', 16, aggregate);
    expect(settled.input).toBe('made-by:ai road ');
    const parts = splitField(settled.input, aggregate, settled.caret);
    expect(parts).toMatchObject({ tokens: 'made-by:ai', draft: 'road ' });
  });

  it('toggles a chip value in place, and Any clears it', () => {
    let q = chooseChipValue('road', 'edited', '7d', aggregate);
    expect(q).toBe('edited:7d road');
    q = chooseChipValue(q, 'edited', 'today', aggregate);
    expect(q).toBe('edited:today,7d road');
    expect(chooseChipValue(q, 'edited', null, aggregate)).toBe('road');
  });

  it('names pills and chips for a screen reader', () => {
    const parsed = parseLens('space:team:T1 template:kanban', aggregate);
    expect(lensPills(parsed, aggregate, words).map((p) => p.name)).toEqual([
      'Filter Space: Acme',
      'Filter Template: Kanban',
    ]);
    const chips = lensChips(parsed, aggregate);
    expect(chips.find((c) => c.dimension === 'template')!.name).toBe('Template: Kanban');
    expect(chips.find((c) => c.dimension === 'people')!.name).toBe('People, any');
    expect(lensChips(parsed, scoped).some((c) => c.dimension === 'space')).toBe(false);
  });
});

describe('suggestions', () => {
  it('offers dimensions, then values, and marks what would match nothing in a whole list', () => {
    const context = { ...aggregate, subjects: null, now: 0 };
    expect(suggestTokens('ed', 2, context).map((s) => s.label)).toEqual(['Edited']);
    const values = suggestTokens('edited:l', 8, context).map((s) => s.label);
    expect(values).toEqual(['Last 7 days', 'Last 30 days', 'Last 12 months']);
    const mine = itemSubject(makeItem(1, { teamId: null }), 'user_me');
    const marked = suggestTokens('space:', 6, { ...context, subjects: [mine] });
    expect(marked.filter((s) => s.matchesNothing).map((s) => s.value)).toEqual([
      'shared',
      'team:T1',
    ]);
    // A list with more pages to come marks nothing.
    expect(suggestTokens('space:', 6, context).some((s) => s.matchesNothing)).toBe(false);
    const first = suggestTokens('edited:l', 8, context)[0]!;
    expect(acceptSuggestion('edited:l', first)).toEqual({ input: 'edited:7d ', caret: 10 });
  });
});

describe('the index’s filters', () => {
  it('sends the words, Made by AI, the widest Edited cutoff, one People value, Template and Space', () => {
    const now = new Date(2026, 9, 23, 15).getTime();
    const parsed = parseLens(
      'road map made-by:ai edited:today,7d people:others template:kanban space:mine',
      aggregate,
    );
    expect(lensFilters(parsed.lens, 'aggregate', now)).toEqual({
      q: 'road map',
      source: ['ai'],
      since: editedCutoff('7d', now),
      owner: 'others',
      intent: ['kanban'],
      space: ['mine'],
    });
    // Both People values admit everyone; Space only applies across places.
    const both = parseLens('people:me,others space:mine', aggregate).lens;
    expect(lensFilters(both, 'scoped', now)).toEqual({});
    expect(filtersKey({ since: 60_000 })).toBe(filtersKey({ since: 119_999 }));
  });

  it('keeps a changed row only while it still matches, leaving the words to the index', () => {
    const lens = parseLens('made-by:ai template:kanban roadmap', aggregate).lens;
    const match = compileLens(lens, 0, { text: false });
    const made = makeItem(1, { source: 'ai', intent: 'plan:board:kanban', title: 'Other' });
    expect(match(itemSubject(made, 'user_me'))).toBe(true);
    expect(match(itemSubject({ ...made, source: null }, 'user_me'))).toBe(false);
  });
});

describe('telemetry', () => {
  it('counts a facet that gained a value, never one that lost it', () => {
    const before = parseLens('edited:7d', aggregate).lens;
    const after = parseLens('edited:7d,today made-by:ai road', aggregate).lens;
    expect(selectedFacets(before, after)).toEqual(['Text', 'MadeBy', 'Edited']);
    expect(selectedFacets(after, before)).toEqual([]);
  });
});
