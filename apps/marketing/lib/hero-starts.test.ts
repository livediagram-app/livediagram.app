import { describe, expect, it } from 'vitest';
import { seededRandom } from '@livediagram/document';
import { galleryTemplates } from './template-gallery';
import {
  HERO_FAN_OPENING,
  HERO_FAN_POOL,
  HERO_FAN_SLOTS,
  HERO_SEARCH_LIMIT,
  heroSearch,
  heroTemplate,
  nextFanKind,
  shuffleFan,
} from './hero-starts';

// docs/specs/019-marketing/marketing-site.md "Hero": the search's matches, and the fan's deal.
describe('heroSearch', () => {
  it('lists nothing until something is typed', () => {
    expect(heroSearch('')).toEqual([]);
    expect(heroSearch('   ')).toEqual([]);
  });

  it('lists at most the limit', () => {
    expect(heroSearch('a').length).toBe(HERO_SEARCH_LIMIT);
  });

  it('puts a title match before one found only through its description or category', () => {
    const kinds = heroSearch('retro').map((t) => t.kind);
    expect(kinds[0]).toBe('retrospective');
    const titled = heroSearch('retro', 50).map((t) => t.title.toLowerCase().includes('retro'));
    // Every title match comes before every other match.
    expect(titled.indexOf(false) === -1 || titled.lastIndexOf(true) < titled.indexOf(false)).toBe(
      true,
    );
  });

  it('finds the blanks too, and through search words, as the editor does', () => {
    expect(heroSearch('whiteboard').map((t) => t.kind)).toContain('whiteboard');
    expect(heroSearch('mortgage').map((t) => t.kind)).toContain('loan-calculator');
  });

  it('never lists a template twice', () => {
    const kinds = heroSearch('blank', 50).map((t) => t.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});

describe('the fan', () => {
  it('deals from every listed template but the blanks, each once, across every mode', () => {
    expect(new Set(HERO_FAN_POOL).size).toBe(HERO_FAN_POOL.length);
    expect([...HERO_FAN_POOL].sort()).toEqual(galleryTemplates().map((t) => t.kind).sort());
    const modes = new Set(HERO_FAN_POOL.map((k) => heroTemplate(k).mode));
    expect([...modes].sort()).toEqual(['diagram', 'draw', 'facilitate', 'illustrate', 'plan']);
    for (const kind of HERO_FAN_OPENING) expect(HERO_FAN_POOL).toContain(kind);
    expect(HERO_FAN_OPENING).toHaveLength(HERO_FAN_SLOTS);
  });

  it('shuffles the whole pool, differently for a different random source', () => {
    const a = shuffleFan(seededRandom(1));
    const b = shuffleFan(seededRandom(2));
    expect([...a].sort()).toEqual([...HERO_FAN_POOL].sort());
    expect(a).not.toEqual(b);
    expect(shuffleFan(seededRandom(1))).toEqual(a);
  });

  it('deals the next kind not already showing, wrapping round the pool', () => {
    const pool = ['kanban', 'flowchart', 'mindmap'] as const;
    expect(nextFanKind(pool, ['kanban'], 0)).toEqual({ kind: 'flowchart', at: 1 });
    expect(nextFanKind(pool, ['flowchart'], 0)).toEqual({ kind: 'mindmap', at: 2 });
    expect(nextFanKind(pool, ['flowchart'], 2)).toEqual({ kind: 'kanban', at: 0 });
  });

  it('throws for a kind the catalogue does not list', () => {
    expect(() => heroTemplate('no-such-template' as never)).toThrow();
  });
});
