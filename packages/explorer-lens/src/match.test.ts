import { describe, expect, it } from 'vitest';
import {
  applyLens,
  documentSubject,
  editedCutoff,
  foldText,
  matchesLens,
  sharedSubject,
} from './match';
import { emptyLens, parseLens } from './parse';
import type { Lens, LensContext, LensSubject } from './types';

const context: LensContext = { view: 'aggregate', teams: [{ id: 'T1', name: 'Acme' }] };
const lensOf = (input: string): Lens => parseLens(input, context).lens;

// Local wall-clock times, so the tests read the same in every time zone.
const now = new Date(2026, 5, 15, 14, 30).getTime();
const day = 86_400_000;

const subject = (overrides: Partial<LensSubject> = {}): LensSubject => ({
  name: 'Q3 plan',
  savedAt: now,
  space: 'mine',
  people: 'me',
  madeByAi: false,
  opensIn: 'diagram',
  kind: null,
  template: null,
  ...overrides,
});

describe('documentSubject', () => {
  const summary = {
    name: 'Storm',
    savedAt: 5,
    ownerId: 'me-id',
    teamId: null,
    source: null,
    opensIn: 'draw',
    tabKind: 'event-storming',
    templateFamily: 'retrospective',
  };

  it('reads a personal document of the reader, this browser’s included', () => {
    expect(documentSubject(summary, 'me-id')).toEqual({
      name: 'Storm',
      savedAt: 5,
      space: 'mine',
      people: 'me',
      madeByAi: false,
      opensIn: 'draw',
      kind: 'event-storming',
      template: 'retrospective',
    });
  });

  it('reads a team document someone else made with AI', () => {
    expect(documentSubject({ ...summary, teamId: 'T1', source: 'mcp' }, 'other')).toMatchObject({
      space: 'team:T1',
      people: 'others',
      madeByAi: true,
    });
  });

  it('reads a document the CLI made as made by a person, not by AI', () => {
    expect(documentSubject({ ...summary, source: 'cli' }, 'me-id').madeByAi).toBe(false);
  });

  it('reads the general diagram tab as no kind', () => {
    expect(documentSubject({ ...summary, tabKind: 'diagram' }, 'me-id').kind).toBeNull();
  });

  it('reads an unrecorded or retired intent as unknown', () => {
    const unrecorded = {
      ...summary,
      opensIn: undefined,
      tabKind: undefined,
      templateFamily: undefined,
    };
    expect(documentSubject(unrecorded, 'me-id')).toMatchObject({
      opensIn: null,
      kind: null,
      template: null,
    });
    const retired = {
      ...summary,
      opensIn: 'whiteboard',
      tabKind: 'mindmap',
      templateFamily: 'swot',
    };
    expect(documentSubject(retired, 'me-id')).toMatchObject({
      opensIn: null,
      kind: null,
      template: null,
    });
  });
});

describe('sharedSubject', () => {
  it('reads a shared row as someone else’s, with everything it cannot say unknown', () => {
    expect(sharedSubject({ name: 'Shared', savedAt: 9 })).toEqual({
      name: 'Shared',
      savedAt: 9,
      space: 'shared',
      people: 'others',
      madeByAi: null,
      opensIn: null,
      kind: null,
      template: null,
    });
  });
});

describe('matchesLens', () => {
  it('matches everything with the empty lens', () => {
    expect(matchesLens(subject(), emptyLens(), now)).toBe(true);
  });

  it('matches every text word in the name, ignoring case and accents', () => {
    expect(matchesLens(subject({ name: 'Café roadmap' }), lensOf('CAFE road'), now)).toBe(true);
    expect(matchesLens(subject({ name: 'Café roadmap' }), lensOf('cafe kanban'), now)).toBe(false);
  });

  it.each([
    ['opens-in:draw', { opensIn: 'draw' }, { opensIn: 'diagram' }],
    ['kind:event-storming', { kind: 'event-storming' }, { kind: null }],
    ['template:kanban', { template: 'kanban' }, { template: 'retrospective' }],
    ['made-by:ai', { madeByAi: true }, { madeByAi: false }],
    ['people:others', { people: 'others' }, { people: 'me' }],
    ['space:team:T1', { space: 'team:T1' }, { space: 'mine' }],
    ['space:shared', { space: 'shared' }, { space: 'team:T1' }],
  ] as const)('matches %s on its value only', (input, hit, miss) => {
    expect(matchesLens(subject(hit), lensOf(input), now)).toBe(true);
    expect(matchesLens(subject(miss), lensOf(input), now)).toBe(false);
  });

  it('matches any of a dimension’s values', () => {
    const lens = lensOf('template:retrospective,kanban');
    expect(matchesLens(subject({ template: 'retrospective' }), lens, now)).toBe(true);
    expect(matchesLens(subject({ template: 'kanban' }), lens, now)).toBe(true);
    expect(matchesLens(subject({ template: null }), lens, now)).toBe(false);
    const spaces = lensOf('space:mine space:team:T1');
    expect(matchesLens(subject({ space: 'team:T1' }), spaces, now)).toBe(true);
    expect(matchesLens(subject({ space: 'shared' }), spaces, now)).toBe(false);
  });

  it('matches no value of a dimension the row cannot answer', () => {
    const unknown = subject({ opensIn: null, kind: null, template: null, madeByAi: null });
    expect(matchesLens(unknown, lensOf('opens-in:diagram,draw'), now)).toBe(false);
    expect(matchesLens(unknown, lensOf('kind:event-storming'), now)).toBe(false);
    expect(matchesLens(unknown, lensOf('template:kanban'), now)).toBe(false);
    expect(matchesLens(unknown, lensOf('made-by:ai'), now)).toBe(false);
    expect(matchesLens(unknown, lensOf('plan'), now)).toBe(true);
  });

  it('combines dimensions with and', () => {
    const lens = lensOf('opens-in:draw people:me');
    expect(matchesLens(subject({ opensIn: 'draw' }), lens, now)).toBe(true);
    expect(matchesLens(subject({ opensIn: 'draw', people: 'others' }), lens, now)).toBe(false);
  });

  describe('edited', () => {
    const midnight = new Date(2026, 5, 15).getTime();
    const yearAgo = new Date(2025, 5, 15, 14, 30).getTime();
    const firstOfJanuary = new Date(2026, 0, 1).getTime();

    it.each([
      ['today', midnight, midnight - 1],
      ['7d', now - 7 * day, now - 7 * day - 1],
      ['30d', now - 30 * day, now - 30 * day - 1],
      ['12m', yearAgo, yearAgo - 1],
      ['this-year', firstOfJanuary, firstOfJanuary - 1],
    ])('edited:%s includes its cutoff and nothing before it', (value, inside, outside) => {
      const lens = lensOf(`edited:${value}`);
      expect(matchesLens(subject({ savedAt: inside }), lens, now)).toBe(true);
      expect(matchesLens(subject({ savedAt: outside }), lens, now)).toBe(false);
    });

    it('reaches as far back as the widest of several values', () => {
      const lens = lensOf('edited:today,30d');
      expect(matchesLens(subject({ savedAt: now - 20 * day }), lens, now)).toBe(true);
      expect(matchesLens(subject({ savedAt: now - 31 * day }), lens, now)).toBe(false);
    });

    it('counts a save in the future as edited', () => {
      expect(matchesLens(subject({ savedAt: now + day }), lensOf('edited:today'), now)).toBe(true);
    });
  });
});

describe('editedCutoff', () => {
  it('counts 12 calendar months back, rolling 29 February on to 1 March', () => {
    const leap = new Date(2028, 1, 29, 9).getTime();
    expect(editedCutoff('12m', leap)).toBe(new Date(2027, 2, 1, 9).getTime());
  });

  it('starts this year at midnight on 1 January, local time', () => {
    expect(editedCutoff('this-year', new Date(2026, 0, 1, 0, 5).getTime())).toBe(
      new Date(2026, 0, 1).getTime(),
    );
  });
});

describe('applyLens', () => {
  it('keeps the matching rows, in order, with whatever they carry', () => {
    const rows = [
      { ...subject({ name: 'a', template: 'kanban' }), id: 1 },
      { ...subject({ name: 'b' }), id: 2 },
      { ...subject({ name: 'c', template: 'kanban' }), id: 3 },
    ];
    expect(applyLens(rows, lensOf('template:kanban'), now).map((row) => row.id)).toEqual([1, 3]);
  });
});

describe('foldText', () => {
  it('folds case and accents', () => {
    expect(foldText('Ångström ÉTÉ')).toBe('angstrom ete');
  });
});
