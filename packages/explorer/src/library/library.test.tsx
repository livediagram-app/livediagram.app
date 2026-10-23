// The Library's host pages: the Image Gallery and Shape Libraries, from the host's sources, and their sidebar rows.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex } from '../test/fakeClient';
import { Explorer } from '../explorer/Explorer';
import type { ExplorerView } from '../views';
import type { GalleryHost, GalleryImage, ShapeLibrariesHost, ShapeLibrary } from './types';

const image = (i: number, over: Partial<GalleryImage> = {}): GalleryImage => ({
  id: `img-${i}`,
  name: `photo-${i}.png`,
  byteSize: 2048 * i,
  width: 640,
  height: 480,
  ...over,
});

function galleryHost(images: GalleryImage[] | null, over: Partial<GalleryHost> = {}) {
  const host: GalleryHost & { blobs: string[] } = {
    blobs: [],
    list: vi.fn(async () => images),
    usage: vi.fn(async () => ({ 'img-1': [{ id: 'd1', title: 'Roadmap', href: '/d/d1' }] })),
    imageBlob: vi.fn(async (img: GalleryImage) => {
      host.blobs.push(img.id);
      return new Blob(['x'], { type: 'image/png' });
    }),
    remove: vi.fn(async () => {}),
    upload: vi.fn(async () => {}),
    ...over,
  };
  return host;
}

function page(view: ExplorerView, extra: Partial<React.ComponentProps<typeof Explorer>> = {}) {
  const onNavigate = vi.fn();
  render(
    <Explorer
      app="livediagram"
      client={createFakeIndex({}).client}
      view={view}
      onNavigate={onNavigate}
      itemHref={(i) => `/d/${i.id}`}
      onCreate={vi.fn()}
      heroHidden
      {...extra}
    />,
  );
  return onNavigate;
}

beforeEach(() => {
  localStorage.clear();
  URL.createObjectURL ??= () => 'blob:x';
  URL.revokeObjectURL ??= () => {};
});

describe('the Image Gallery', () => {
  it('lists each image with its size, its use, and its picture', async () => {
    const host = galleryHost([image(1), image(2)]);
    page({ kind: 'gallery' }, { gallery: host });
    expect(await screen.findByText('photo-1.png')).toBeTruthy();
    expect(screen.getByText('640 × 480 · 2.0 KB')).toBeTruthy();
    expect(screen.getByText('Not used')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Used in 1 canvas' }));
    expect(screen.getByRole('link', { name: 'Roadmap' }).getAttribute('href')).toBe('/d/d1');
    await waitFor(() => expect(host.blobs.sort()).toEqual(['img-1', 'img-2']));
    expect(host.list).toHaveBeenCalledTimes(1);
  });

  it('deletes after asking, saying where it is still used', async () => {
    const host = galleryHost([image(1)]);
    page({ kind: 'gallery' }, { gallery: host });
    fireEvent.click(await screen.findByRole('button', { name: 'Delete photo-1.png' }));
    const confirm = await screen.findByRole('dialog');
    expect(confirm.textContent).toContain('It’s still in 1 canvas');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete Image' }));
    await waitFor(() => expect(host.remove).toHaveBeenCalledWith(image(1)));
    expect(screen.queryByText('photo-1.png')).toBeNull();
  });

  it('uploads a chosen file and reads the gallery again; a refusal is said as it is', async () => {
    const host = galleryHost([], {
      upload: vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Your gallery is full.')),
    });
    page({ kind: 'gallery' }, { gallery: host });
    expect(await screen.findByText('No images yet')).toBeTruthy();
    const input = screen.getByLabelText('Upload an image') as HTMLInputElement;
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(host.list).toHaveBeenCalledTimes(2));
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText('Your gallery is full.')).toBeTruthy();
  });

  it('says when images are off, and when the host has no gallery', async () => {
    page({ kind: 'gallery' }, { gallery: galleryHost(null) });
    expect(await screen.findByText('Images are not enabled here.')).toBeTruthy();
  });

  it('has a Library row only where the host has a gallery', async () => {
    const onNavigate = page({ kind: 'all' }, { gallery: galleryHost([]) });
    fireEvent.click(await screen.findByRole('button', { name: 'Expand Library' }));
    const row = screen.getByRole('treeitem', { name: 'Image Gallery' });
    fireEvent.click(row.querySelector('[data-tree-activate]')!);
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'gallery' }, '/explorer/images');
    expect(screen.queryByRole('treeitem', { name: 'Shape Libraries' })).toBeNull();
  });
});

const library = (over: Partial<ShapeLibrary> = {}): ShapeLibrary => ({
  id: 'lib-1',
  name: 'Network',
  items: [
    { id: 's1', title: 'Router', width: 40, height: 20 },
    { id: 's2', title: '', width: 10, height: 10 },
  ],
  ...over,
});

function shapesHost(libraries: ShapeLibrary[], over: Partial<ShapeLibrariesHost> = {}) {
  return {
    list: vi.fn(async () => libraries),
    rename: vi.fn(async () => ({ ok: true as const })),
    remove: vi.fn(async () => {}),
    removeShape: vi.fn(async () => {}),
    ...over,
  } satisfies ShapeLibrariesHost;
}

describe('Shape Libraries', () => {
  it('shows each library with its shapes, drawn by the host', async () => {
    const host = shapesHost([library()], { renderShape: (s) => <i data-drawn={s.id} /> });
    page({ kind: 'shape-libraries' }, { shapeLibraries: host });
    expect(await screen.findByRole('heading', { name: 'Network' })).toBeTruthy();
    expect(screen.getByText('2 shapes')).toBeTruthy();
    expect(document.querySelectorAll('[data-drawn]')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Show shapes' }));
    const shapes = screen.getByRole('list', { name: 'Shapes in Network' });
    expect(within(shapes).getByText('Router')).toBeTruthy();
    expect(within(shapes).getByText('Shape 2')).toBeTruthy();
    fireEvent.click(within(shapes).getByRole('button', { name: 'Delete Router' }));
    await waitFor(() =>
      expect(host.removeShape).toHaveBeenCalledWith(library(), library().items[0]),
    );
    expect(screen.getByText('1 shape')).toBeTruthy();
  });

  it('renames in place, keeping a refused name open with its reason', async () => {
    const host = shapesHost([library()], {
      rename: vi
        .fn()
        .mockResolvedValueOnce({ ok: false, error: 'You already have a library called that.' })
        .mockResolvedValueOnce({ ok: true }),
    });
    page({ kind: 'shape-libraries' }, { shapeLibraries: host });
    fireEvent.click(await screen.findByRole('button', { name: 'Rename Network' }));
    const input = screen.getByRole('textbox', { name: 'Library name' });
    fireEvent.change(input, { target: { value: 'Infra' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByText('You already have a library called that.')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'Infra 2' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByRole('heading', { name: 'Infra 2' })).toBeTruthy();
  });

  it('deletes a library after asking, and shows plain tiles without a drawing', async () => {
    const host = shapesHost([library()]);
    page({ kind: 'shape-libraries' }, { shapeLibraries: host });
    expect(await screen.findAllByTestId('library-preview')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Network' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(host.remove).toHaveBeenCalled());
    expect(await screen.findByText('No shape libraries yet')).toBeTruthy();
  });

  it('says so where the host keeps none', async () => {
    page({ kind: 'shape-libraries' });
    expect(await screen.findByText('No Shape Libraries here')).toBeTruthy();
  });
});
