import { describe, expect, it } from 'vitest';
import { newFlashcardPage, newSlidePage, type Tab } from '@livedocuments/document';
import { importFormatsFor } from './import-formats';

const tab = (pages: unknown[] | undefined, elements: unknown[] = []) =>
  ({ id: 't', name: 'T', elements, ...(pages ? { pages } : {}) }) as unknown as Tab;

describe('importFormatsFor: Import offers each format on its own kind of tab', () => {
  it('offers every format on an empty tab, which the import then gives its kind', () => {
    expect(importFormatsFor(tab(undefined))).toEqual(['json', 'markdown', 'word', 'powerpoint']);
    expect(importFormatsFor(tab([{ id: 'p', orientation: 'portrait' }]))).toEqual([
      'json',
      'markdown',
      'word',
      'powerpoint',
    ]);
  });

  it('offers Markdown and Word on an article, PowerPoint on a slide deck', () => {
    expect(
      importFormatsFor(tab([{ id: 'a', orientation: 'portrait', kind: 'article', flow: 'f' }])),
    ).toEqual(['json', 'markdown', 'word']);
    expect(importFormatsFor(tab([newSlidePage('s')]))).toEqual(['json', 'powerpoint']);
  });

  it('offers JSON alone on an infographic or flashcards, and on an unchosen page with something on it', () => {
    expect(
      importFormatsFor(tab([{ id: 'i', orientation: 'portrait', kind: 'infographic' }])),
    ).toEqual(['json']);
    expect(importFormatsFor(tab([newFlashcardPage('c', 'f')]))).toEqual(['json']);
    expect(importFormatsFor(tab([{ id: 'p', orientation: 'portrait' }], [{ id: 'x' }]))).toEqual([
      'json',
    ]);
  });
});
