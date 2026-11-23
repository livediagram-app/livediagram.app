import { describe, expect, it } from 'vitest';
import {
  COVER_GRADIENT_IDS,
  MAX_KNOWLEDGEBASE_PAGES,
  MAX_PAGE_DEPTH,
  isPageIconId,
} from '@liveknowledge/document';
import {
  SETUP_MAX_DEPTH,
  SETUP_MAX_HEADINGS,
  SETUP_MAX_HEADING_CHARS,
  SETUP_MAX_PAGES,
  SETUP_MAX_SUMMARY_CHARS,
  SETUP_MAX_TITLE_CHARS,
} from './setup-limits';
import { GROUP_COVERS, SECTION_ICON, iconForTitle, styleStructure } from './structures/looks';
import { p } from './structures/shape';
import {
  SETUP_STRUCTURES,
  STRUCTURE_GROUPS,
  setupStructure,
  structureOutline,
  structurePageCount,
  structurePageTitles,
  structureSuggestion,
  type StructurePage,
} from './setup-structures';

// docs/specs/030-knowledgebase/describe-to-set-up.md "The start screen": every structure is a whole knowledgebase,
// within the bounds a suggestion keeps, and reads through the suggestion parser whole.
const count = (pages: readonly StructurePage[]): number =>
  pages.reduce((n, page) => n + 1 + count(page.pages), 0);

describe.each(SETUP_STRUCTURES.map((s) => [s.name, s] as const))('%s', (_, structure) => {
  const suggestion = structureSuggestion(structure);

  it('reads through the parser with every page, in tree order', () => {
    expect(suggestion.name).toBe(structure.name);
    expect(suggestion.pages).toHaveLength(count(structure.pages));
    const seen = new Set<string>();
    for (const page of suggestion.pages) {
      if (page.parent !== null) expect(seen.has(page.parent), page.title).toBe(true);
      seen.add(page.id);
    }
  });

  it('keeps within the bounds: pages, depth, lengths and the knowledgebase limits', () => {
    expect(suggestion.pages.length).toBeGreaterThanOrEqual(6);
    expect(suggestion.pages.length).toBeLessThanOrEqual(SETUP_MAX_PAGES);
    expect(suggestion.pages.length).toBeLessThan(MAX_KNOWLEDGEBASE_PAGES);
    for (const page of suggestion.pages) {
      expect(page.depth).toBeLessThanOrEqual(Math.min(SETUP_MAX_DEPTH, MAX_PAGE_DEPTH));
      expect(page.title.length).toBeLessThanOrEqual(SETUP_MAX_TITLE_CHARS);
      expect(page.summary.length, page.title).toBeGreaterThan(0);
      expect(page.summary.length).toBeLessThanOrEqual(SETUP_MAX_SUMMARY_CHARS);
      expect(page.headings.length).toBeLessThanOrEqual(SETUP_MAX_HEADINGS);
      for (const heading of page.headings)
        expect(heading.length).toBeLessThanOrEqual(SETUP_MAX_HEADING_CHARS);
    }
  });

  it('names its pages uniquely under each parent, in Title Case', () => {
    const under = new Map<string | null, string[]>();
    for (const page of suggestion.pages)
      under.set(page.parent, [...(under.get(page.parent) ?? []), page.title.toLowerCase()]);
    for (const titles of under.values()) expect(new Set(titles).size).toBe(titles.length);
    for (const page of suggestion.pages)
      expect(page.title[0], page.title).toBe(page.title[0]!.toUpperCase());
  });

  it('sits in a group of the start', () => {
    expect(STRUCTURE_GROUPS.map((g) => g.id)).toContain(structure.group);
  });
});

describe('the structures', () => {
  it('have unique ids and names, and are found by id', () => {
    const ids = SETUP_STRUCTURES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(SETUP_STRUCTURES.map((s) => s.name)).size).toBe(ids.length);
    expect(setupStructure('engineering-handbook')?.name).toBe('Engineering Handbook');
    expect(setupStructure('nope')).toBeUndefined();
  });

  it('read as an empty structure where there are no pages', () => {
    const empty = { ...SETUP_STRUCTURES[0]!, pages: [] };
    expect(structureSuggestion(empty)).toEqual({ name: empty.name, pages: [] });
  });

  it('fill every group', () => {
    for (const group of STRUCTURE_GROUPS)
      expect(
        SETUP_STRUCTURES.some((s) => s.group === group.id),
        group.id,
      ).toBe(true);
  });

  it('fill every group with four, a gallery shelf’s row', () => {
    expect(SETUP_STRUCTURES.length).toBe(32);
    for (const group of STRUCTURE_GROUPS)
      expect(SETUP_STRUCTURES.filter((s) => s.group === group.id).length, group.id).toBe(4);
  });

  // docs/specs/019-marketing/marketing-site.md "The pitch": the product says knowledgebase, as one word, and never
  // calls itself a wiki. The structures are read on the landing page as well as in the editor.
  it('say knowledgebase, never a wiki or a knowledge base', () => {
    const text = (pages: readonly StructurePage[]): string[] =>
      pages.flatMap((p) => [p.title, p.summary, ...p.headings, ...text(p.pages)]);
    for (const s of SETUP_STRUCTURES)
      for (const words of [s.name, s.line, ...text(s.pages)]) {
        expect(words, s.id).not.toMatch(/wiki|knowledge base|—/i);
      }
    for (const g of STRUCTURE_GROUPS) expect(`${g.name} ${g.line}`).not.toMatch(/wiki/i);
  });
});

describe('a structure outline', () => {
  const handbook = setupStructure('engineering-handbook')!;

  it('lists each top page with its subpages, and counts every page', () => {
    const { lines, more } = structureOutline(handbook);
    expect(lines.map((l) => l.title)).toEqual([
      'Overview',
      'Architecture',
      'Development',
      'Shipping',
    ]);
    expect(lines[3]!.under).toEqual(['Release Process', 'On-Call']);
    expect(more).toBe(0);
    expect(structurePageCount(handbook)).toBe(13);
    expect(structurePageTitles(handbook).slice(0, 3)).toEqual([
      'Overview',
      'Architecture',
      'Services',
    ]);
  });

  it('gives its last line to a count of the top pages past it', () => {
    expect(structureOutline(handbook, 4).more).toBe(0);
    const { lines, more } = structureOutline(handbook, 3);
    expect(lines.map((l) => l.title)).toEqual(['Overview', 'Architecture']);
    expect(more).toBe(2);
  });
});

// describe-to-set-up.md "Icons and covers": a structure's pages are not bare in the tree. The ids are held to the
// picker's own sets in the editor (apps/editor/lib/knowledge-setup/structure-looks.test.ts).
describe('the structures’ looks', () => {
  const walk = (
    pages: readonly StructurePage[],
    top: boolean,
  ): { page: StructurePage; top: boolean }[] =>
    pages.flatMap((page) => [{ page, top }, ...walk(page.pages, false)]);

  it('give every section an icon, and every top section and the first page a cover', () => {
    for (const s of SETUP_STRUCTURES)
      for (const { page, top } of walk(s.pages, true)) {
        const where = `${s.id}: ${page.title}`;
        if (page.pages.length > 0) expect(page.icon, where).toBeTruthy();
        const covered = top && (page.pages.length > 0 || page === s.pages[0]);
        expect(page.cover !== undefined, where).toBe(covered);
      }
  });

  it('keep each structure calm: one gradient to a structure, only built-in ones, and leaves mostly bare', () => {
    for (const s of SETUP_STRUCTURES) {
      const all = walk(s.pages, true).map((w) => w.page);
      expect(new Set(all.flatMap((p) => (p.cover ? [p.cover] : []))), s.id).toEqual(
        new Set([GROUP_COVERS[s.group]]),
      );
      expect(COVER_GRADIENT_IDS as readonly string[]).toContain(GROUP_COVERS[s.group]);
      for (const p of all) if (p.icon) expect(isPageIconId(p.icon), p.icon).toBe(true);
    }
    const leaves = SETUP_STRUCTURES.flatMap((s) => walk(s.pages, true)).filter(
      (w) => w.page.pages.length === 0,
    );
    const dressed = leaves.filter((w) => w.page.icon).length / leaves.length;
    // A leaf takes an icon only when its title names a thing, so the tree reads calm, not dressed.
    expect(dressed).toBeLessThan(0.7);
    expect(dressed).toBeGreaterThan(0.3);
  });

  it('carry through the suggestion, page for page', () => {
    for (const s of SETUP_STRUCTURES) {
      const flat = walk(s.pages, true).map((w) => w.page);
      const made = structureSuggestion(s).pages;
      expect(made.map((p) => p.icon)).toEqual(flat.map((p) => p.icon));
      expect(made.map((p) => p.cover)).toEqual(flat.map((p) => p.cover));
    }
  });

  it('name an icon by its title where a rule does, and a bare section takes the folder', () => {
    expect(iconForTitle('Glossary')).toBe('book');
    expect(iconForTitle('Pay and Benefits')).toBe('dollar-sign');
    expect(iconForTitle('Weekly Updates')).toBeUndefined();
    expect(SECTION_ICON).toBe('folder');
    const bare = { ...SETUP_STRUCTURES[0]!, pages: [p('Zzz', 'x', [], [p('Yyy', 'x')])] };
    expect(styleStructure(bare).pages[0]).toMatchObject({
      icon: 'folder',
      cover: GROUP_COVERS.team,
    });
    expect(styleStructure(bare).pages[0]!.pages[0]).not.toHaveProperty('icon');
  });
});
