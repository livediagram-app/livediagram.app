// @vitest-environment jsdom

// The Search tab's loaders (docs/specs/009-elements/image-search.md "Loading" and "Picking"): placeholder
// photos while a search runs, and the picked tile's stage while it is stored.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpenverseImage } from '@/lib/image-search/openverse';
import type { PickOutcome, PickStage } from '@/lib/image-search/pick';

const search = vi.hoisted(() => ({
  resolve: null as null | ((v: unknown) => void),
}));
const pick = vi.hoisted(() => ({
  onStage: null as null | ((s: PickStage) => void),
  resolve: null as null | ((v: PickOutcome) => void),
}));

vi.mock('@/lib/image-search/search', () => ({
  searchOpenverse: vi.fn(
    () =>
      new Promise((r) => {
        search.resolve = r;
      }),
  ),
}));
vi.mock('@/lib/import-images/browser', () => ({
  createBrowserImportImageSession: () => ({ store: vi.fn() }),
}));
vi.mock('@/lib/image-search/pick', async (orig) => ({
  ...(await orig<typeof import('@/lib/image-search/pick')>()),
  storeSearchResult: vi.fn(
    (_r: unknown, _s: unknown, _f: unknown, _fb: unknown, onStage: (s: PickStage) => void) =>
      new Promise<PickOutcome>((r) => {
        pick.onStage = onStage;
        onStage('downloading');
        pick.resolve = r;
      }),
  ),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { ImageSearchPane } from './ImageSearchPane';

const result = (id: string): OpenverseImage => ({
  id,
  url: `https://images.example/${id}.jpg`,
  thumbnail: `https://api.openverse.org/${id}/thumb/`,
  width: 100,
  height: 100,
  title: `Picture ${id}`,
  creator: 'Ada',
  license: 'by',
  licenseVersion: '4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  landingUrl: `https://images.example/${id}`,
});

beforeEach(() => {
  search.resolve = null;
  pick.resolve = null;
});
afterEach(cleanup);

async function searchFor(q: string) {
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: q } });
  fireEvent.submit(screen.getByRole('search'));
  await act(async () => {});
}

describe('ImageSearchPane loading', () => {
  it('fills the grid with placeholder photos and names the query while it searches', async () => {
    render(<ImageSearchPane ownerId="o" documentId="d" onPicked={vi.fn()} />);
    await searchFor('mountains');
    expect(screen.getByText(/Searching Openverse for/).textContent).toContain('“mountains”');
    expect(document.querySelectorAll('[data-image-search-skeleton]')).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Search' }).hasAttribute('disabled')).toBe(true);

    await act(async () => {
      search.resolve!({ results: [result('a'), result('b')], page: 1, pageCount: 1 });
    });
    expect(document.querySelectorAll('[data-image-search-skeleton]')).toHaveLength(0);
    expect(screen.queryByText(/Searching Openverse/)).toBeNull();
  });

  it('shows each tile as a placeholder until its thumbnail loads', async () => {
    render(<ImageSearchPane ownerId="o" documentId="d" onPicked={vi.fn()} />);
    await searchFor('cats');
    await act(async () => {
      search.resolve!({ results: [result('a')], page: 1, pageCount: 1 });
    });
    const tile = screen.getByRole('button', { name: /Picture a/ });
    expect(tile.className).toContain('lvd-search-skeleton');
    fireEvent.load(tile.querySelector('img')!);
    expect(tile.className).not.toContain('lvd-search-skeleton');
  });
});

describe('ImageSearchPane picking', () => {
  it('marks the picked tile busy and walks its stages, then hands the picture on', async () => {
    const onPicked = vi.fn();
    render(<ImageSearchPane ownerId="o" documentId="d" onPicked={onPicked} />);
    await searchFor('cats');
    await act(async () => {
      search.resolve!({ results: [result('a'), result('b')], page: 1, pageCount: 1 });
    });
    fireEvent.click(screen.getByRole('button', { name: /Picture a/ }));
    await act(async () => {});

    const tile = screen.getByRole('button', { name: /Picture a/ });
    expect(tile.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toContain('Downloading the full-size picture');
    expect(screen.getByRole('button', { name: /Picture b/ }).hasAttribute('disabled')).toBe(true);

    act(() => pick.onStage!('saving'));
    expect(screen.getByRole('status').textContent).toContain('Adding it to your gallery');
    expect(tile.textContent).toContain('Adding');

    const picked = { id: 'img', width: 1, height: 1, originalName: 'a' };
    await act(async () => pick.resolve!({ ok: true, picked }));
    expect(onPicked).toHaveBeenCalledWith(picked);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
