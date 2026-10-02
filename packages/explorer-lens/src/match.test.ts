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
  board: null,
  ...overrides,
});

describe('documentSubject', () => {
  const summary = {
    name: 'Retro',
    savedAt: 5,
    ownerId: 'me-id',
    teamId: null,
    source: null,
    opensIn: 'draw',
    boardType: 'retrospective',
  };

  it('reads a personal document of the reader', () => {
    expect(documentSubject(summary, 'me-id')).toEqual({
      name: 'Retro',
      savedAt: 5,
      space: 'mine',
      people: 'me',
      madeByAi: false,
      opensIn: 'draw',
      board: 'retrospective',
    });
  });

  it('reads a team document someone else made with AI', () => {
    expect(documentSubject({ ...summary, teamId: 'T1', source: 'mcp' }, 'other')).toMatchObject({
      space: 'team:T1',
      people: 'others',
      madeByAi: true,
    });
  });

  it('reads an unrecorded or retired mode and board as unknown', () => {
    expect(
      documentSubject({ ...summary, opensIn: undefined, boardType: undefined }, 'me-id'),
    ).toMatchObject({
      opensIn: null,
      board: null,
    });
    expect(
      documentSubject({ ...summary, opensIn: 'whiteboard', boardType: 'mindmap' }, 'me-id'),
    ).toMatchObject({
      opensIn: null,
      board: null,
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
      board: null,
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
    ['board:kanban', { board: 'kanban' }, { board: 'retrospective' }],
    ['made-by:ai', { madeByAi: true }, { madeByAi: false }],
    ['people:others', { people: 'others' }, { people: 'me' }],
    ['space:team:T1', { space: 'team:T1' }, { space: 'mine' }],
    ['space:shared', { space: 'shared' }, { space: 'team:T1' }],
  ] as const)('matches %s on its value only', (input, hit, miss) => {
    expect(matchesLens(subject(hit), lensOf(input), now)).toBe(true);
    expect(matchesLens(subject(miss), lensOf(input), now)).toBe(false);
  });

  it('matches no value of a dimension the row cannot answer', () => {
    const unknown = subject({ opensIn: null, board: null, madeByAi: null });
    expect(matchesLens(unknown, lensOf('opens-in:diagram'), now)).toBe(false);
    expect(matchesLens(unknown, lensOf('board:kanban'), now)).toBe(false);
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

    it.each([
      ['today', midnight, midnight - 1],
      ['7d', now - 7 * day, now - 7 * day - 1],
      ['30d', now - 30 * day, now - 30 * day - 1],
      [
        'year',
        new Date(2025, 5, 15, 14, 30).getTime(),
        new Date(2025, 5, 15, 14, 30).getTime() - 1,
      ],
    ])('edited:%s includes its cutoff and nothing before it', (value, inside, outside) => {
      const lens = lensOf(`edited:${value}`);
      expect(matchesLens(subject({ savedAt: inside }), lens, now)).toBe(true);
      expect(matchesLens(subject({ savedAt: outside }), lens, now)).toBe(false);
    });

    it('counts a save in the future as edited', () => {
      expect(matchesLens(subject({ savedAt: now + day }), lensOf('edited:today'), now)).toBe(true);
    });
  });
});

describe('editedCutoff', () => {
  it('counts 12 calendar months back, rolling 29 February on to 1 March', () => {
    const leap = new Date(2028, 1, 29, 9).getTime();
    expect(editedCutoff('year', leap)).toBe(new Date(2027, 2, 1, 9).getTime());
  });
});

describe('applyLens', () => {
  it('keeps the matching rows, in order, with whatever they carry', () => {
    const rows = [
      { ...subject({ name: 'a', board: 'kanban' }), id: 1 },
      { ...subject({ name: 'b' }), id: 2 },
      { ...subject({ name: 'c', board: 'kanban' }), id: 3 },
    ];
    expect(applyLens(rows, lensOf('board:kanban'), now).map((row) => row.id)).toEqual([1, 3]);
  });
});

describe('foldText', () => {
  it('folds case and accents', () => {
    expect(foldText('Ångström ÉTÉ')).toBe('angstrom ete');
  });
});
