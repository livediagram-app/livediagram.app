// The editor panel's Timeline and Library sections, as livediagram's panel has them.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex, makeEvent, makeItem } from '../test/fakeClient';
import type { GalleryHost, ShapeLibrariesHost } from '../library/types';
import { ExplorerPanel, type ExplorerPanelProps } from './ExplorerPanel';

const gallery: GalleryHost = {
  list: vi.fn(async () => [
    { id: 'img-1', name: 'photo.png', byteSize: 2048, width: 640, height: 480 },
  ]),
  imageBlob: vi.fn(async () => new Blob(['x'], { type: 'image/png' })),
  remove: vi.fn(async () => {}),
};
const shapeLibraries: ShapeLibrariesHost = {
  list: vi.fn(async () => [{ id: 'lib-1', name: 'Network', items: [] }]),
  rename: vi.fn(async () => ({ ok: true as const })),
  remove: vi.fn(async () => {}),
  removeShape: vi.fn(async () => {}),
};

function renderPanel(
  index: ReturnType<typeof createFakeIndex>,
  over: Partial<ExplorerPanelProps> = {},
) {
  const onOpenExplorer = vi.fn();
  render(
    <ExplorerPanel
      app="liveplanner"
      client={index.client}
      itemHref={(item) => `/project/${item.id}`}
      onCreate={vi.fn()}
      onOpenExplorer={onOpenExplorer}
      viewerId="user_me"
      {...over}
    />,
  );
  return { onOpenExplorer };
}

const rail = () => within(screen.getByRole('navigation', { name: 'Explorer sections' }));

beforeEach(() => {
  localStorage.clear();
  URL.createObjectURL ??= () => 'blob:x';
  URL.revokeObjectURL ??= () => {};
});

describe('the panel’s Timeline', () => {
  it('lists the events under their days, in place', async () => {
    const index = createFakeIndex({
      items: [makeItem(1)],
      events: [makeEvent(1, { id: 'e1', itemId: 'item-1', type: 'renamed' })],
    });
    const { onOpenExplorer } = renderPanel(index);
    fireEvent.click(rail().getByRole('button', { name: 'Timeline' }));
    expect(await screen.findByText(/Renamed/)).toBeTruthy();
    expect(onOpenExplorer).not.toHaveBeenCalled();
  });

  it('says so when nothing has happened', async () => {
    renderPanel(createFakeIndex({ items: [] }));
    fireEvent.click(rail().getByRole('button', { name: 'Timeline' }));
    expect(await screen.findByText('No activity yet')).toBeTruthy();
  });
});

describe('the panel’s Library', () => {
  it('is on the rail only where the host keeps one', () => {
    renderPanel(createFakeIndex({ items: [] }));
    expect(rail().queryByRole('button', { name: 'Library' })).toBeNull();
  });

  it('shows the Image Gallery and Shape Libraries as tabs', async () => {
    renderPanel(createFakeIndex({ items: [] }), {
      gallery,
      shapeLibraries,
    });
    fireEvent.click(rail().getByRole('button', { name: 'Library' }));
    const tabs = screen.getByRole('tablist', { name: 'Library' });
    expect(
      within(tabs)
        .getByRole('tab', { name: /Image Gallery/ })
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(await screen.findByText('photo.png')).toBeTruthy();
    fireEvent.click(within(tabs).getByRole('tab', { name: /Shape Libraries/ }));
    expect(await screen.findByText('Network')).toBeTruthy();
  });

  it('shows the one page without tabs when the host keeps only that', async () => {
    renderPanel(createFakeIndex({ items: [] }), { gallery });
    fireEvent.click(rail().getByRole('button', { name: 'Library' }));
    expect(await screen.findByText('photo.png')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  });
});
