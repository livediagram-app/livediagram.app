import { describe, expect, it } from 'vitest';
import { SETUP_STRUCTURES, STRUCTURE_GROUPS } from '@liveknowledge/knowledge';
import {
  BLANK_START,
  galleryShelves,
  galleryStructure,
  structureCreateHref,
} from './template-gallery';

// docs/specs/019-marketing/marketing-site.md "Structure" 3: the gallery's templates are the knowledgebase
// structures, the same ones the editor's start offers, on one shelf per group.
describe('the gallery shelves', () => {
  it('are the structure groups, in the start’s order, Company and Team first', () => {
    const shelves = galleryShelves();
    expect(shelves.map((s) => s.id)).toEqual(STRUCTURE_GROUPS.map((g) => g.id));
    expect(shelves.map((s) => s.label)).toEqual([
      'Company and Team',
      'Engineering',
      'Product and Research',
      'Customers',
    ]);
  });

  it('hold every structure once, on its own group’s shelf', () => {
    const shelves = galleryShelves();
    const dealt = shelves.flatMap((s) => s.templates.map((t) => t.kind));
    expect([...dealt].sort()).toEqual(SETUP_STRUCTURES.map((s) => s.id).sort());
    for (const shelf of shelves)
      for (const t of shelf.templates)
        expect(SETUP_STRUCTURES.find((s) => s.id === t.kind)?.group, t.kind).toBe(shelf.id);
  });

  it('give each shelf four, so an open shelf fills its four-across row', () => {
    for (const shelf of galleryShelves()) expect(shelf.templates).toHaveLength(4);
  });

  it('never call a structure a wiki, or the product a knowledge base', () => {
    for (const shelf of galleryShelves()) {
      expect(shelf.label).not.toMatch(/wiki|knowledge base/i);
      for (const t of shelf.templates) {
        const words = [t.title, t.line, ...t.outline.lines.flatMap((l) => [l.title, ...l.under])];
        for (const w of words) expect(w, t.kind).not.toMatch(/wiki|knowledge base|—/i);
      }
    }
  });
});

describe('a gallery structure', () => {
  it('carries its name, line, page count and two-level outline', () => {
    expect(galleryStructure('engineering-handbook')).toMatchObject({
      kind: 'engineering-handbook',
      title: 'Engineering Handbook',
      pageCount: 13,
      outline: { more: 0 },
    });
    const outline = galleryStructure('engineering-handbook')!.outline;
    expect(outline.lines.at(-1)).toEqual({
      title: 'Shipping',
      under: ['Release Process', 'On-Call'],
    });
  });

  it('keeps its outline to five lines, the last counting the rest', () => {
    for (const shelf of galleryShelves())
      for (const t of shelf.templates) {
        expect(t.outline.lines.length + (t.outline.more > 0 ? 1 : 0)).toBeLessThanOrEqual(5);
      }
    // Company Knowledgebase has six top pages: four lines, then "and 2 More".
    expect(galleryStructure('company-knowledgebase')!.outline.more).toBe(2);
  });

  it('is none for an id no structure has', () => {
    expect(galleryStructure('meeting-notes')).toBeNull();
  });

  it('links to a new knowledgebase made from it', () => {
    expect(structureCreateHref('team-handbook')).toBe('/new?structure=team-handbook');
    expect(structureCreateHref('a b')).toBe('/new?structure=a%20b');
  });
});

// Blank Knowledgebase leads the group tiles but is no group (owner 2026-11-21): a link that makes a blank one.
describe('the blank', () => {
  it('is the start tile, on no shelf', () => {
    expect(BLANK_START).toMatchObject({ label: 'Blank Knowledgebase', kind: 'blank-article' });
    for (const shelf of galleryShelves())
      expect(shelf.templates.map((t) => t.kind)).not.toContain(BLANK_START.kind);
  });
});
