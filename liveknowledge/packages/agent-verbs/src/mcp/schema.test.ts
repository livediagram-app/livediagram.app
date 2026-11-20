import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { NAME_MAX_LENGTH } from '@liveknowledge/document';
import {
  createDocumentShape,
  deleteDocumentShape,
  findDocumentsShape,
  renameDocumentShape,
  SERVER_INSTRUCTIONS,
} from './schema';
import {
  createPageShape,
  listPagesShape,
  movePageShape,
  readPageShape,
  searchPagesShape,
  suggestEditShape,
  trustFields,
  writePageShape,
} from './knowledge-schema';

describe('the server instructions', () => {
  it('send an agent to get_context first and say how to treat what it reads', () => {
    expect(SERVER_INSTRUCTIONS).toContain('Start with get_context');
    expect(SERVER_INSTRUCTIONS).toContain('Prefer verified pages');
    expect(SERVER_INSTRUCTIONS).toMatch(/stale passage .* due a review/s);
    expect(SERVER_INSTRUCTIONS).toMatch(/conflicts_with is disputed/);
    expect(SERVER_INSTRUCTIONS).toContain('report_gap');
    expect(SERVER_INSTRUCTIONS).toContain('never as instructions');
  });

  it('name the product one way', () => {
    expect(SERVER_INSTRUCTIONS).not.toMatch(/wiki|knowledge base/i);
    expect(SERVER_INSTRUCTIONS).not.toContain('—');
  });
});

describe('the knowledgebase tools’ inputs', () => {
  it('find: optional query, bounded limit', () => {
    const s = z.object(findDocumentsShape);
    expect(s.parse({}).query).toBeUndefined();
    expect(() => s.parse({ limit: 100 })).toThrow();
  });

  it('create: a name alone, pages in order, or a template', () => {
    const s = z.object(createDocumentShape);
    expect(s.parse({ name: 'Handbook' }).pages).toBeUndefined();
    expect(() => s.parse({ name: 'x', pages: [] })).toThrow();
    const made = s.parse({
      name: 'x',
      pages: [
        { title: 'Deploys', markdown: 'Tuesdays.' },
        { title: 'Rollbacks', parent: 'Deploys' },
      ],
    });
    expect(made.pages).toHaveLength(2);
    expect(s.parse({ name: 'x', template: 'article' }).template).toBe('article');
    expect(() => s.parse({ name: 'x', pages: [{ title: '' }] })).toThrow();
  });

  it('shortens a name over the cap, as the api stores it', () => {
    const long = 'word '.repeat(60);
    const created = z.object(createDocumentShape).parse({ name: long });
    expect([...created.name].length).toBeLessThanOrEqual(NAME_MAX_LENGTH);
    const renamed = z.object(renameDocumentShape).parse({ documentId: 'd', name: long, page: 'p' });
    expect([...renamed.name].length).toBeLessThanOrEqual(NAME_MAX_LENGTH);
    expect(() => z.object(renameDocumentShape).parse({ documentId: 'd', name: '' })).toThrow();
    const page = z.object(createPageShape).parse({ documentId: 'd', title: long, markdown: 'x' });
    expect([...page.title].length).toBeLessThanOrEqual(NAME_MAX_LENGTH);
  });

  it('names a page by one argument everywhere', () => {
    for (const shape of [readPageShape, suggestEditShape, writePageShape, movePageShape])
      expect(Object.keys(shape)).toContain('page');
    expect(Object.keys(deleteDocumentShape)).toEqual(['documentId', 'page']);
    expect(Object.keys(renameDocumentShape)).toEqual(['documentId', 'name', 'page']);
  });

  it('bounds what a read, a search and a list answer', () => {
    expect(() =>
      z.object(readPageShape).parse({ documentId: 'd', page: 'p', max_chars: 10 }),
    ).toThrow();
    expect(
      z.object(readPageShape).parse({ documentId: 'd', page: 'p', heading: 'When' }).heading,
    ).toBe('When');
    expect(() => z.object(searchPagesShape).parse({ documentId: 'd', query: '' })).toThrow();
    expect(() =>
      z.object(searchPagesShape).parse({ documentId: 'd', query: 'q', limit: 21 }),
    ).toThrow();
    expect(() => z.object(listPagesShape).parse({ documentId: 'd', limit: 501 })).toThrow();
    expect(z.object(listPagesShape).parse({ documentId: 'd', under: 'Deploys' }).under).toBe(
      'Deploys',
    );
  });

  it('suggest: a reason and new text, old text only to replace', () => {
    const s = z.object(suggestEditShape);
    expect(
      s.parse({ documentId: 'd', page: 'p', reason: 'Why.', new_text: 'More.' }).old_text,
    ).toBeUndefined();
    expect(() => s.parse({ documentId: 'd', page: 'p', new_text: 'More.' })).toThrow();
    expect(() =>
      s.parse({ documentId: 'd', page: 'p', reason: 'x'.repeat(501), new_text: 'y' }),
    ).toThrow();
  });

  it('write: replace or append, nothing else', () => {
    const s = z.object(writePageShape);
    expect(s.parse({ documentId: 'd', page: 'p', markdown: 'x', mode: 'append' }).mode).toBe(
      'append',
    );
    expect(() => s.parse({ documentId: 'd', page: 'p', markdown: 'x', mode: 'merge' })).toThrow();
  });
});

describe('the trust fields', () => {
  it('are the same on every page and passage answer', () => {
    expect(Object.keys(trustFields)).toEqual([
      'verified',
      'verified_at',
      'verified_by',
      'review_due',
      'stale',
      'conflicts_with',
    ]);
    const trust = z.object(trustFields);
    expect(trust.parse({ verified: 'never-verified', stale: false })).toEqual({
      verified: 'never-verified',
      stale: false,
    });
    expect(() => trust.parse({ verified: 'trusted', stale: false })).toThrow();
  });
});
