import { describe, expect, it, vi } from 'vitest';

// A structure's first page takes the untouched Start Here's place, which a new knowledgebase opens in edit mode on:
// edit mode is left first, so the page is written as saved, never into its draft (lost on a reload; sweep
// 2026-11-21).
const order: string[] = [];
const runSetup = vi.fn(async () => {
  order.push('write');
  return { imported: 0, first: null };
});
vi.mock('@/lib/knowledge-setup/run-setup', () => ({ runSetup }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/components/page-tree/select-page', () => ({ selectPage: vi.fn() }));

const { createStructure } = await import('./create-structure');

const chromeWith = (release: (id: string) => void) =>
  ({
    get: () => ({
      pageEditing: { release },
      tabs: [],
      activeTab: { id: 'start' },
      documentName: 'Untitled Knowledgebase',
      commitTabs: vi.fn(),
      markTabLoaded: vi.fn(),
      nameDocument: vi.fn(),
    }),
  }) as never;

describe('createStructure', () => {
  it('leaves edit mode on the page it replaces before writing', async () => {
    order.length = 0;
    const release = vi.fn((id: string) => order.push(`release ${id}`));
    await createStructure({
      chrome: chromeWith(release),
      documentId: 'kb',
      pages: [],
      name: 'Runbooks',
      from: 'FromStructure',
      replaceId: 'start',
      cancelled: () => false,
      onProgress: () => {},
    });
    expect(order).toEqual(['release start', 'write']);
  });

  it('leaves edit mode alone when nothing is replaced', async () => {
    const release = vi.fn();
    await createStructure({
      chrome: chromeWith(release),
      documentId: 'kb',
      pages: [],
      name: null,
      from: 'FromSetup',
      cancelled: () => false,
      onProgress: () => {},
    });
    expect(release).not.toHaveBeenCalled();
  });
});
