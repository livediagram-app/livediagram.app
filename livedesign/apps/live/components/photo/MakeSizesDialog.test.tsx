// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRaster } from '@livedesign/photo-engine';
import { sizeTicks } from '@/lib/photo-editor/make-sizes';
import { MakeSizesDialog } from './MakeSizesDialog';
import { photoView } from './photo-view-test-utils';

const toastApi = vi.hoisted(() => ({ action: vi.fn(), error: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toastApi }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
// The preview's picture and file need a canvas and the photo worker: stood in for here.
vi.mock('@/lib/photo-editor/preview', () => ({
  previewRaster: async (p: { width: number; height: number }) => createRaster(p.width, p.height),
  encodePreview: async () => ({ id: 'prev', type: 'image/webp', bytes: new Uint8Array([1]) }),
}));
vi.mock('@/lib/photo-editor/upload-queue', () => ({ photoUploads: { enqueue: vi.fn() } }));

// docs/specs/031-photo/photo-pages.md "Making sizes" The dialog.
afterEach(() => {
  cleanup();
  localStorage.clear();
  toastApi.action.mockClear();
});

function open(over: Parameters<typeof photoView>[2] = {}) {
  const addSizes = vi.fn(() => true);
  const exportAllSizes = vi.fn(async () => {});
  const pv = photoView(undefined, undefined, { addSizes, exportAllSizes, ...over });
  pv.view.store = pv.store;
  const onClose = vi.fn();
  render(<MakeSizesDialog photo={pv.view} onClose={onClose} />);
  return { ...pv, addSizes, exportAllSizes, onClose };
}

const tile = (name: RegExp) => screen.getByRole('checkbox', { name });
const make = () => screen.getByRole('button', { name: /^Mak(e\b|ing)/ });

describe('the Make Sizes dialog', () => {
  it('offers every format and Custom, none ticked the first time', () => {
    open();
    expect(screen.getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))).toEqual([
      'Instagram Post, 1080 by 1350',
      'Instagram Story, 1080 by 1920',
      'LinkedIn Post, 1200 by 627',
      'LinkedIn Banner, 1584 by 396',
      'X Post, 1600 by 900',
      'X Header, 1500 by 500',
      'Facebook Cover, 851 by 315',
      'YouTube Thumbnail, 1280 by 720',
      'Custom, 1080 by 1080',
    ]);
    expect(
      screen.getAllByRole('checkbox').every((c) => c.getAttribute('aria-checked') === 'false'),
    );
    expect(make().textContent).toBe('Make Sizes');
    expect((make() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Room for 9 more photo pages in this tab.')).toBeTruthy();
  });

  it('ticks, counts and remembers the formats; Select All and Clear', () => {
    open();
    fireEvent.click(tile(/^Instagram Post/));
    expect(make().textContent).toBe('Make 1 Size');
    fireEvent.click(tile(/^X Post/));
    expect(make().textContent).toBe('Make 2 Sizes');
    expect(sizeTicks.get().ticked).toEqual(['instagram-post', 'x-post']);
    fireEvent.click(tile(/^Instagram Post/));
    expect(tile(/^Instagram Post/).getAttribute('aria-checked')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    expect(make().textContent).toBe('Make 9 Sizes');
    expect(screen.getByText(/These are all that fit/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(make().textContent).toBe('Make Sizes');
  });

  it('holds the ticks to the room the tab has left', () => {
    sizeTicks.set({ ticked: ['x-post', 'x-header', 'custom'], custom: { width: 10, height: 10 } });
    open({ photoRoom: 2 });
    expect(make().textContent).toBe('Make 2 Sizes');
    expect(tile(/^Custom/).getAttribute('aria-checked')).toBe('false');
    expect(tile(/^Custom/).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(tile(/^Custom/));
    expect(make().textContent).toBe('Make 2 Sizes');
    expect(
      screen.getByText(/A tab holds up to 10 photo pages\. These are all that fit\./),
    ).toBeTruthy();
    fireEvent.click(tile(/^X Post/));
    expect(screen.getByText('Room for 1 more photo page in this tab.')).toBeTruthy();
  });

  it('takes a custom size, refusing one past the cap', () => {
    open();
    fireEvent.click(tile(/^Custom/));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Width' }), {
      target: { value: '9000' },
    });
    expect(screen.getByText(/Photos can be up to 8192 px on a side/)).toBeTruthy();
    expect((make() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Width' }), {
      target: { value: '640' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Height' }), {
      target: { value: '480' },
    });
    expect(tile(/^Custom/).getAttribute('aria-label')).toBe('Custom, 640 by 480');
    expect(sizeTicks.get().custom).toEqual({ width: 640, height: 480 });
  });

  it('makes the sizes as new pages, then offers Export All Sizes', async () => {
    const { addSizes, exportAllSizes, onClose } = open();
    fireEvent.click(tile(/^Instagram Story/));
    fireEvent.click(tile(/^YouTube Thumbnail/));
    fireEvent.click(make());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(addSizes).toHaveBeenCalledOnce();
    const [source, made] = addSizes.mock.calls[0] as unknown as [
      string,
      { id: string; name: string; photo: { width: number; height: number; preview?: string } }[],
    ];
    expect(source).toBe('p');
    expect(made.map((m) => [m.name, m.photo.width, m.photo.height, m.photo.preview])).toEqual([
      ['Instagram Story', 1080, 1920, 'prev'],
      ['YouTube Thumbnail', 1280, 720, 'prev'],
    ]);
    expect(new Set(made.map((m) => m.id)).size).toBe(2);
    const spec = toastApi.action.mock.calls[0]![0] as {
      message: string;
      actions: { label: string; onSelect: () => void }[];
    };
    expect(spec.message).toBe('Made 2 sizes.');
    expect(spec.actions.map((a) => a.label)).toEqual(['Export All Sizes']);
    spec.actions[0]!.onSelect();
    expect(exportAllSizes).toHaveBeenCalledWith('');
  });

  it('says so when the pages could not be added, and offers no export without a scope', async () => {
    const { onClose } = open({ addSizes: vi.fn(() => false) });
    fireEvent.click(tile(/^X Header/));
    fireEvent.click(make());
    expect(await screen.findByText('The sizes could not be made. Try again.')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    cleanup();
    localStorage.clear();
    const second = open({ exportAllSizes: undefined });
    fireEvent.click(tile(/^X Header/));
    fireEvent.click(make());
    await waitFor(() => expect(second.onClose).toHaveBeenCalled());
    expect(toastApi.action.mock.calls.at(-1)![0]).toMatchObject({
      message: 'Made 1 size.',
      actions: [],
    });
  });

  it('adds nothing once closed mid-way', async () => {
    const { addSizes } = open();
    fireEvent.click(tile(/^X Header/));
    fireEvent.click(make());
    expect(make().textContent).toMatch(/^Making 1 of 1/);
    cleanup();
    await new Promise((r) => setTimeout(r, 50));
    expect(addSizes).not.toHaveBeenCalled();
  });
});
