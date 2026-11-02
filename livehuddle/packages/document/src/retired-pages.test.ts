import { describe, expect, it } from 'vitest';
import { dropRetiredPages } from './retired-pages';
import { migrateIncomingTab, migrateStoredTab } from './stored-tab';
import { opensInOf } from './editor-mode';
import { isValidTab } from './validate';
import type { Tab } from './index';

// Pages mode moved out to livedocuments: a tab stored in it opens in Diagram with its ordinary elements.
const square = { id: 'sq', type: 'shape', shape: 'square', x: 0, y: 0, width: 120, height: 80 };
const text = { id: 'tx', type: 'text', x: 0, y: 200, width: 200, height: 40, label: 'Title' };
const tabWindow = {
  id: 'tw',
  type: 'shape',
  shape: 'tab-window',
  x: 0,
  y: 300,
  width: 640,
  height: 360,
  windowTabId: 't2',
};
const marginNote = {
  id: 'mn',
  type: 'annotation',
  x: 900,
  y: 40,
  width: 24,
  height: 24,
  articleNote: 'comment',
};

const pagesTab = () =>
  ({
    id: 't',
    name: 'Deck',
    opensIn: 'pages',
    pages: [{ id: 'p1', orientation: 'landscape', kind: 'slide' }],
    articles: { f1: { blocks: [{ id: 'b1', kind: 'paragraph', text: 'Hello' }] } },
    pageOrientation: 'portrait',
    theme: 'ocean',
    elements: [square, tabWindow, text, marginNote],
  }) as unknown as Tab;

describe('dropRetiredPages', () => {
  it('opens a Pages tab in Diagram, drops its pages and articles, and keeps its ordinary elements', () => {
    const out = dropRetiredPages(pagesTab()) as unknown as Record<string, unknown>;
    expect('opensIn' in out).toBe(false);
    expect(opensInOf(out)).toBe('diagram');
    expect('pages' in out).toBe(false);
    expect('articles' in out).toBe(false);
    expect('pageOrientation' in out).toBe(false);
    expect(out.theme).toBe('ocean');
    expect((out.elements as { id: string }[]).map((e) => e.id)).toEqual(['sq', 'tx']);
  });

  it('reads either older name of Pages mode the same way', () => {
    for (const opensIn of ['illustrate', 'infographic']) {
      const out = dropRetiredPages({ id: 't', name: 'T', opensIn, elements: [] });
      expect('opensIn' in out).toBe(false);
    }
  });

  it('drops pages left on a tab in another mode, and keeps that mode', () => {
    const out = dropRetiredPages({
      id: 't',
      name: 'T',
      opensIn: 'draw',
      pages: [{ id: 'p1', orientation: 'portrait' }],
      elements: [square],
    }) as unknown as Record<string, unknown>;
    expect(out.opensIn).toBe('draw');
    expect('pages' in out).toBe(false);
    expect(out.elements).toEqual([square]);
  });

  it('keeps an annotation that is not an article note', () => {
    const note = { ...marginNote, id: 'a' } as Record<string, unknown>;
    delete note.articleNote;
    const tab = { id: 't', name: 'T', elements: [note] };
    expect(dropRetiredPages(tab)).toBe(tab);
  });

  it('hands back the same tab when there is nothing of Pages on it', () => {
    const tab = { id: 't', name: 'T', opensIn: 'workshop', elements: [square, text] };
    expect(dropRetiredPages(tab)).toBe(tab);
  });
});

describe('a stored Pages tab on the way in', () => {
  it('is read by the stored-tab migration as a valid Diagram tab', () => {
    const out = migrateStoredTab(pagesTab());
    expect(opensInOf(out)).toBe('diagram');
    expect(out.elements.map((e) => e.id)).toEqual(['sq', 'tx']);
    expect(isValidTab(out)).toBe(true);
  });

  it('is accepted from outside once migrated, its Pages-only parts gone', () => {
    const out = migrateIncomingTab(pagesTab()) as Tab;
    expect(isValidTab(out)).toBe(true);
    expect(out.elements).toHaveLength(2);
  });
});
