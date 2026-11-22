// @vitest-environment jsdom

// A version's pages with what changed outlined (docs/specs/006-document/version-history.md "Opening a version").

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@liveknowledge/document';

vi.mock('@/lib/export-tab-images', () => ({ loadTabImages: vi.fn(async () => new Map()) }));
vi.mock('@/lib/map-geometry-loader', () => ({ ensureMapGeometryFor: vi.fn(async () => {}) }));
vi.mock('@liveworkspace/workbench/lib/icon-registry', () => ({
  ensureIconCatalogs: vi.fn(async () => {}),
  resolveIconArtLoaded: () => undefined,
  resolveStickerArtLoaded: () => undefined,
}));

import { VersionPreview } from './VersionPreview';

afterEach(cleanup);

const box = (id: string, x: number, y: number): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y,
  width: 100,
  height: 60,
  label: id,
});

// Two slides side by side, as the layout lays them: `a` on the first, `b` on the second.
const tab: Tab = {
  id: 't1',
  name: 'Deck',
  elements: [box('a', -800, -400), box('b', 1200, -400)],
  pages: [
    { id: 's1', orientation: 'landscape', kind: 'slide' },
    { id: 's2', orientation: 'landscape', kind: 'slide' },
  ],
};
const ctx = { ownerId: 'me', documentId: 'd1', shareCode: null };

describe('VersionPreview', () => {
  it('draws each page once its art has arrived', async () => {
    const { container } = render(
      <VersionPreview tab={tab} marks={null} imageContext={ctx} label="Version from today" />,
    );
    expect(
      screen.getByRole('group', { name: 'Version from today' }).getAttribute('aria-busy'),
    ).toBe('true');
    await waitFor(() => expect(container.querySelectorAll('figure svg').length).toBe(2));
    expect(screen.getByRole('group').getAttribute('aria-busy')).toBe('false');
  });

  it('outlines removed and changed elements on the pages they reach', async () => {
    const { container } = render(
      <VersionPreview
        tab={tab}
        marks={{ removed: new Set(['a']), changed: new Set(['b']) }}
        imageContext={ctx}
        label="Version"
      />,
    );
    await waitFor(() =>
      expect(container.querySelectorAll('rect[data-mark]').length).toBeGreaterThan(0),
    );
    const kinds = [...container.querySelectorAll('rect[data-mark]')].map((r) =>
      r.getAttribute('data-mark'),
    );
    expect(kinds.sort()).toEqual(['changed', 'removed']);
    expect(screen.getAllByText(/changed since/)).toHaveLength(2);
  });
});
