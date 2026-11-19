// Card number prefixes (docs/specs/026-plan/item-types.md "Card number prefixes"): made from a name, unique in the
// plan, stored on change, shown with a card's number and read back in every form.
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  CARD_PREFIX_MAX,
  autoPrefix,
  cardRef,
  cardRefKey,
  cardRefOrKey,
  cardRefTitle,
  normalPrefix,
  prefixOf,
  prefixedCardRef,
  prefixOwner,
  prefixTaken,
  prefixesOf,
  withPinnedPrefixes,
} from './card-prefix';
import type { ItemTypeDef } from './item-types';

const t = (id: string, label: string, prefix?: string): ItemTypeDef => ({
  id,
  label,
  newTitle: `New ${label}`,
  glyph: 'star',
  color: '#123456',
  fields: ['title', 'status'],
  ...(prefix !== undefined ? { prefix } : {}),
});
const none = new Set<string>();

describe('autoPrefix', () => {
  it('takes the first letter of each word, upper case', () => {
    expect(autoPrefix('Work Item', none)).toBe('WI');
    expect(autoPrefix('customer call', none)).toBe('CC');
    expect(autoPrefix('Task', none)).toBe('T');
    expect(autoPrefix('Sprint 4', none)).toBe('S4');
    expect(autoPrefix('AI Idea', none)).toBe('AI');
  });

  it('reads letters and digits only, accents dropped, at most six', () => {
    expect(autoPrefix('Café-Order', none)).toBe('CO');
    expect(autoPrefix('a b c d e f g h', none)).toBe('ABCDEF');
    expect(autoPrefix('Épique', none)).toBe('E');
  });

  it('drops leading digits so it starts with a letter, and gives C for a name with nothing to read', () => {
    expect(autoPrefix('2024 Goals', none)).toBe('G');
    expect(autoPrefix('4x4 Trucks', none)).toBe('XT');
    expect(autoPrefix('2024', none)).toBe('C');
    expect(autoPrefix('!!!', none)).toBe('C');
    expect(autoPrefix('', none)).toBe('C');
  });

  it('on a clash, adds the last word’s next letters, then a digit from 2', () => {
    expect(autoPrefix('Theme', new Set(['T']))).toBe('TH');
    expect(autoPrefix('Ticket', new Set(['T', 'TI']))).toBe('TIC');
    expect(autoPrefix('Web Item', new Set(['WI']))).toBe('WIT');
    expect(autoPrefix('Ox', new Set(['O', 'OX']))).toBe('O2');
    expect(autoPrefix('Ox', new Set(['O', 'OX', 'O2', 'O3']))).toBe('O4');
    // Never past six: a full prefix steps on to digits in place of its last characters.
    expect(autoPrefix('a b c d e f', new Set(['ABCDEF']))).toBe('ABCDE2');
    expect(autoPrefix('a b c d e f', new Set(['ABCDEF', 'ABCDE2']))).toBe('ABCDE3');
  });

  it('is linear on a very long name', () => {
    const long = `${'Word '.repeat(20_000)}End`;
    expect(cpuMsOf(() => autoPrefix(long, new Set(['WWWWWW'])))).toBeLessThan(cpuBudgetMs(200));
  });
});

describe('normalPrefix', () => {
  it('reads a prefix upper case, trimmed', () => {
    expect(normalPrefix(' wi ')).toBe('WI');
    expect(normalPrefix('Bug2')).toBe('BUG2');
  });

  it('refuses one that is empty, too long, starts with a digit or holds anything but letters and digits', () => {
    for (const bad of ['', '   ', 'ABCDEFG', '2B', 'W-I', 'WÍ', 'W I', 3, null, undefined])
      expect(normalPrefix(bad)).toBeNull();
    expect(normalPrefix('A'.repeat(CARD_PREFIX_MAX))).toBe('AAAAAA');
  });
});

describe('prefixesOf', () => {
  it('makes each type its own, in catalogue order', () => {
    const types = [
      t('task', 'Task'),
      t('theme', 'Theme'),
      t('ticket', 'Ticket'),
      t('wi', 'Work Item'),
    ];
    expect([...prefixesOf(types)]).toEqual([
      ['task', 'T'],
      ['theme', 'TH'],
      ['ticket', 'TI'],
      ['wi', 'WI'],
    ]);
  });

  it('lets stored prefixes claim theirs first, so a made one steps round them', () => {
    const types = [t('task', 'Task'), t('theme', 'Theme', 'T')];
    expect(prefixOf(types, 'theme')).toBe('T');
    expect(prefixOf(types, 'task')).toBe('TA');
  });

  it('makes one for a stored prefix repeated or not a prefix', () => {
    const types = [t('a', 'Alpha', 'X'), t('b', 'Beta', 'x'), t('c', 'Gamma', '9z')];
    const map = prefixesOf(types);
    expect(map.get('a')).toBe('X');
    expect(map.get('b')).toBe('B');
    expect(map.get('c')).toBe('G');
  });

  it('works out the largest catalogue of clashing names, and names 5,000 cards, within budget', () => {
    // 32 types (ITEM_TYPES_MAX) all named alike, so every made prefix walks its letters and digits.
    const fresh = () => Array.from({ length: 32 }, (_, i) => t(`t${i}`, 'Tt'));
    const catalogue = fresh();
    expect(new Set(prefixesOf(catalogue).values()).size).toBe(32);
    const cards = Array.from({ length: 5000 }, (_, i) => ({ key: i + 1, type: `t${i % 32}` }));
    expect(
      cpuMsOf(() => {
        for (let n = 0; n < 100; n++) prefixesOf(fresh());
        for (const c of cards) cardRef(c, catalogue);
      }),
    ).toBeLessThan(cpuBudgetMs(100));
  });

  it('works a catalogue out once', () => {
    const types = [t('task', 'Task')];
    expect(prefixesOf(types)).toBe(prefixesOf(types));
    expect(prefixOf(types, 'gone')).toBeUndefined();
  });
});

describe('cardRef', () => {
  const types = [t('wi', 'Work Item'), t('bug', 'Bug', 'BUG')];

  it('reads a card’s number after its type’s prefix', () => {
    expect(cardRef({ key: 100, type: 'wi' }, types)).toBe('WI-100');
    expect(cardRef({ key: 7, type: 'bug' }, types)).toBe('BUG-7');
    expect(cardRefTitle({ key: 7, type: 'bug' }, 'Crash', types)).toBe('BUG-7 Crash');
  });

  it('reads #N for a type the catalogue lacks, or with no catalogue', () => {
    expect(cardRef({ key: 3, type: 'gone' }, types)).toBe('#3');
    expect(cardRef({ key: 3, type: 'wi' }, undefined)).toBe('#3');
    expect(cardRef({ key: 3, type: 'wi' }, [])).toBe('#3');
  });

  it('reads nothing for a card with no number (a tour’s practice card)', () => {
    expect(cardRef({ key: 0, type: 'wi' }, types)).toBe('');
    expect(cardRefTitle({ key: 0, type: 'wi' }, 'Practice', types)).toBe('Practice');
    expect(cardRefOrKey({ key: 0, type: 'wi' }, types)).toBe('#0');
    expect(cardRefOrKey({ key: 5, type: 'wi' }, types)).toBe('WI-5');
  });

  it('gives the prefixed ref a card carries across plans, none without a prefix or a number', () => {
    expect(prefixedCardRef({ key: 100, type: 'wi' }, types)).toBe('WI-100');
    expect(prefixedCardRef({ key: 3, type: 'gone' }, types)).toBeUndefined();
    expect(prefixedCardRef({ key: 3, type: 'wi' }, undefined)).toBeUndefined();
    expect(prefixedCardRef({ key: 0, type: 'wi' }, types)).toBeUndefined();
  });
});

describe('cardRefKey', () => {
  it('finds the number in every form', () => {
    for (const ref of ['WI-100', 'wi-100', '#WI-100', '#100', '100', ' 100 ', 'BUG2-100'])
      expect(cardRefKey(ref)).toBe(100);
  });

  it('reads nothing else as a number', () => {
    for (const ref of [
      '',
      '#',
      'WI-',
      'WI',
      '-100',
      '1WI-100',
      'ABCDEFG-1',
      'WI 100',
      '0',
      'WI-0',
      'x',
    ])
      expect(cardRefKey(ref)).toBeNull();
  });

  it('is fast on a long worst-case input', () => {
    const digits = '9'.repeat(50_000);
    const spaces = `#${' '.repeat(50_000)}x`;
    expect(
      cpuMsOf(() => [cardRefKey(digits), cardRefKey(spaces), cardRefKey(`W-${digits}`)]),
    ).toBeLessThan(cpuBudgetMs(50));
  });
});

describe('prefixOwner', () => {
  const types = [t('task', 'Task'), t('wi', 'Work Item', 'WI')];

  it('names the other type holding a prefix, its made one too, ignoring case', () => {
    expect(prefixOwner(types, 'new', 'wi')?.id).toBe('wi');
    expect(prefixOwner(types, 'new', 't')?.id).toBe('task');
    expect(prefixOwner(types, 'wi', 'WI')).toBeNull();
    expect(prefixOwner(types, 'new', 'ZZ')).toBeNull();
    expect(prefixTaken('wi', types[1]!)).toBe("WI is already Work Item's prefix. Pick another.");
  });
});

describe('withPinnedPrefixes', () => {
  it('stores a new type’s prefix', () => {
    const before = [t('task', 'Task')];
    const after = [...before, t('theme', 'Theme')];
    const pinned = withPinnedPrefixes(before, after);
    expect(pinned[0]).toBe(after[0]);
    expect(pinned[1]!.prefix).toBe('TH');
  });

  it('keeps a renamed type’s prefix', () => {
    const before = [t('task', 'Task')];
    expect(withPinnedPrefixes(before, [t('task', 'Chore')])[0]!.prefix).toBe('T');
  });

  it('keeps a type’s prefix when one before it is deleted', () => {
    const before = [t('task', 'Task'), t('theme', 'Theme')];
    const pinned = withPinnedPrefixes(before, [t('theme', 'Theme')]);
    expect(pinned[0]!.prefix).toBe('TH');
  });

  it('leaves a type whose prefix would not move as it is', () => {
    const before = [t('task', 'Task'), t('wi', 'Work Item')];
    const after = [t('task', 'Task'), t('wi', 'Work Item')];
    const pinned = withPinnedPrefixes(before, after);
    expect(pinned[0]).toBe(after[0]);
    expect(pinned[1]).toBe(after[1]);
  });

  it('lets a cleared prefix go back to the made one', () => {
    const before = [t('wi', 'Work Item', 'W')];
    const pinned = withPinnedPrefixes(before, [t('wi', 'Work Item')]);
    expect(pinned[0]!.prefix).toBeUndefined();
    expect(prefixOf(pinned, 'wi')).toBe('WI');
  });

  it('keeps a stored prefix as stored', () => {
    const before = [t('wi', 'Work Item')];
    const after = [t('wi', 'Work Item', 'W')];
    expect(withPinnedPrefixes(before, after)[0]).toBe(after[0]);
  });

  it('pins the made prefix another type’s new stored one takes, so the pair is a clash to refuse', () => {
    const before = [t('task', 'Task'), t('theme', 'Theme')];
    const pinned = withPinnedPrefixes(before, [t('task', 'Task'), t('theme', 'Theme', 'T')]);
    expect(pinned.map((x) => x.prefix)).toEqual(['T', 'T']);
  });
});
