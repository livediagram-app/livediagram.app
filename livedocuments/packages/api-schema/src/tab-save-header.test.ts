import { describe, expect, it } from 'vitest';
import type { Tab } from '@livedocuments/document';
import { readTabSaveChanges, tabSaveChangesHeader } from './tab-save-header';

const tab = (blocks: number, text = 'x'): Tab => ({
  id: 't1',
  name: 'Brief',
  elements: [],
  pages: [{ id: 'p1', orientation: 'portrait', kind: 'article', flow: 'f1' }],
  articles: {
    f1: {
      blocks: Array.from({ length: blocks }, (_, i) => ({
        id: `b-${String(i).padStart(8, '0')}`,
        type: 'paragraph' as const,
        runs: [{ text }],
      })),
    },
  },
});

describe('the X-Save-Changes header', () => {
  it('is null for a tab the baseline lacks, and round-trips a save it has', () => {
    expect(tabSaveChangesHeader(undefined, tab(1))).toBeNull();
    const header = tabSaveChangesHeader(tab(1), tab(2))!;
    expect(readTabSaveChanges(header)).toEqual({
      pages: [],
      articles: { f1: [{ kind: 'put', id: 'b-00000001', after: 'b-00000000', before: null }] },
    });
  });

  it('takes the article whole when its block steps would not fit, and sends none when nothing fits', () => {
    const header = tabSaveChangesHeader(tab(1), tab(400))!;
    expect(readTabSaveChanges(header)).toEqual({ pages: [], articles: { f1: 'whole' } });
    const pages = Array.from({ length: 400 }, (_, i) => ({
      id: `page-${'p'.repeat(20)}-${i}`,
      orientation: 'portrait' as const,
    }));
    expect(tabSaveChangesHeader(tab(1), { ...tab(1), pages })).toBeNull();
  });

  it('reads an absent or unreadable header as no changes', () => {
    expect(readTabSaveChanges(null)).toBeNull();
    expect(readTabSaveChanges('%7B%22pages%22%3A5%7D')).toBeNull();
  });
});
