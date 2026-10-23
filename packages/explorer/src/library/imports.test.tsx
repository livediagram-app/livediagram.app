// Import from: the host's sources beside New, filed where New would file, and the library sources on Shape Libraries.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { Explorer } from '../explorer/Explorer';
import type { ExplorerView } from '../views';
import { importLine } from '../welcome/types';
import type { ImportHost } from './types';

const sources = [
  { id: 'excalidraw', name: 'Excalidraw' },
  { id: 'drawio', name: 'draw.io', libraries: true },
];

function page(view: ExplorerView, imports?: ImportHost) {
  render(
    <Explorer
      app="livediagram"
      client={createFakeIndex({ items: [makeItem(1)] }).client}
      view={view}
      onNavigate={vi.fn()}
      itemHref={(i) => `/d/${i.id}`}
      onCreate={vi.fn()}
      heroHidden
      {...(imports ? { imports } : {})}
      shapeLibraries={{
        list: async () => [],
        rename: async () => ({ ok: true }),
        remove: async () => {},
        removeShape: async () => {},
      }}
    />,
  );
}

beforeEach(() => localStorage.clear());

describe('Import from', () => {
  it('sits beside New and files where New would', async () => {
    const onImport = vi.fn();
    page({ kind: 'folder', id: 'f1' }, { sources, onImport });
    const bar = await screen.findByRole('toolbar', { name: 'Import from' });
    fireEvent.click(within(bar).getByRole('button', { name: 'Import from draw.io' }));
    expect(onImport).toHaveBeenCalledWith(sources[1], {
      what: 'items',
      placement: { folderId: 'f1', teamId: null },
    });
  });

  it('offers only the library sources on Shape Libraries, including its empty state', async () => {
    const onImport = vi.fn();
    page({ kind: 'shape-libraries' }, { sources, onImport });
    expect(await screen.findByText('No shape libraries yet')).toBeTruthy();
    const bars = screen.getAllByRole('toolbar', { name: 'Import from' });
    expect(bars).toHaveLength(2);
    expect(within(bars[0]!).queryByRole('button', { name: 'Import from Excalidraw' })).toBeNull();
    fireEvent.click(within(bars[1]!).getByRole('button', { name: 'Import from draw.io' }));
    expect(onImport).toHaveBeenCalledWith(sources[1], {
      what: 'libraries',
      placement: { folderId: null, teamId: null },
    });
  });

  it('is not there without a host', async () => {
    page({ kind: 'all' });
    expect(await screen.findByRole('heading', { name: 'My Work' })).toBeTruthy();
    expect(screen.queryByRole('toolbar', { name: 'Import from' })).toBeNull();
  });

  it("names the host's tools on Home's first run", () => {
    expect(importLine(['Excalidraw', 'draw.io', 'Microsoft Whiteboard'], 'canvas')).toBe(
      'Import boards from Excalidraw, draw.io or Microsoft Whiteboard; each becomes its own canvas.',
    );
  });
});
