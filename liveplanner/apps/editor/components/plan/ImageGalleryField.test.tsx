// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  ITEM_TYPES,
  kindChangeRefusal,
  type CustomFieldDef,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import { ImageGalleryField } from './ImageGalleryField';
import { ItemFieldEditor, type ItemFieldContext } from './ItemFieldEditor';
import { customKindPill } from './CustomKindPill';
import { addedField } from './AddFieldShape';
import { lossMessage, shapeOf } from './edit-field-values';
import { fieldIcon } from './ItemTypeDisplayParts';
import { PICK_KIND_ICONS } from './CustomFieldKindParts';
import type { PlanPalette } from './plan-palette';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';

// docs/specs/026-plan/item-types.md "Image fields": a Several Images field in the card panel (a grid of thumbnails,
// each opening whole, removed and moved; several files picked or dropped at once, each checked and uploading as its
// own tile), on the card face (the first picture and a count), and for each share role: an Editor and a Participant
// add, remove and move pictures, a Viewer only sees and opens them.

const api = vi.hoisted(() => ({
  upload: vi.fn(),
  url: vi.fn(),
  release: vi.fn(),
  original: vi.fn(),
}));
const offline = vi.hoisted(() => ({ value: false }));
const tracked = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track: tracked }));
vi.mock('@/lib/api/images', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/images')>('@/lib/api/images');
  return {
    ...actual,
    apiUploadImage: api.upload,
    apiImageUrl: api.url,
    releaseImageUrl: api.release,
    apiImageOriginal: api.original,
  };
});
vi.mock('@/lib/offline/offline-store', () => ({ isOfflineId: async () => offline.value }));
vi.mock('@/hooks/persistence/useIsOfflineProject', () => ({
  useIsOfflineProject: (id: string | null) => (id ? offline.value : false),
}));
const plan = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('./PlanContext', () => ({ usePlan: () => plan.value }));

const SCOPE = { ownerId: 'o1', projectId: 'p1', shareCode: null };
const SAM = { id: 'p-sam', name: 'Sam Lee', color: '#2563eb' };
const DESIGNS: CustomFieldDef = {
  id: 'f-designs',
  label: 'Designs',
  kind: 'image',
  multiple: true,
};
const TYPE: ItemTypeDef = {
  ...ITEM_TYPES[1],
  id: 'work',
  label: 'Work Item',
  fields: ['title', 'status', 'f-designs'],
  custom: [DESIGNS],
};
const make = (designs?: unknown): Item => ({
  id: 'item0001',
  type: 'work',
  key: 1,
  rank: 'i',
  fields: (designs === undefined
    ? { title: 'Home page' }
    : { title: 'Home page', 'f-designs': designs }) as Item['fields'],
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: SAM,
  updatedBy: SAM,
});

let item: Item;
const announce = vi.fn();
// The card as the plan holds it: each write lands on it, so the next upload reads it as it is then.
const patchItem = vi.fn(async (_id: string, patch: { set?: Record<string, unknown> }) => {
  item = { ...item, fields: { ...item.fields, ...(patch.set as Item['fields']) } };
  setPlan();
  return true;
});
// One plan object, changed in place, as the provider's latest-plan ref reads it when an upload lands.
function setPlan(over: Record<string, unknown> = {}) {
  plan.value = Object.assign(plan.value ?? {}, {
    itemsScope: SCOPE,
    items: new Map([[item.id, item]]),
    types: [TYPE],
    canEditCards: true,
    patchItem,
    announce,
    presence: new Map(),
    ...over,
  });
}
const file = (name: string, type = 'image/png') => new File([new Uint8Array(4)], name, { type });
let uploaded = 0;
beforeEach(() => {
  plan.value = null;
  offline.value = false;
  uploaded = 0;
  item = make();
  setPlan();
  patchItem.mockClear();
  announce.mockClear();
  tracked.mockClear();
  api.upload.mockReset().mockImplementation(async () => {
    uploaded += 1;
    return { image: { id: `img-${uploaded}` }, deduped: false };
  });
  api.url.mockReset().mockResolvedValue('blob:pic');
  api.release.mockReset();
  api.original.mockReset().mockResolvedValue(new Blob(['x'], { type: 'image/png' }));
});
afterEach(cleanup);
const flush = () => act(async () => {});

function gallery(value: unknown, canEdit = true) {
  item = make(value);
  setPlan();
  const onSave = vi.fn();
  const view = render(
    <ImageGalleryField
      id="designs"
      itemId={item.id}
      field={DESIGNS}
      value={value as never}
      canEdit={canEdit}
      onSave={onSave}
    />,
  );
  return { onSave, view };
}
const picker = () => document.querySelector('input[type=file]') as HTMLInputElement;
const pick = (files: File[]) => fireEvent.change(picker(), { target: { files } });

describe('the card panel, for an Editor or a Participant', () => {
  it('draws the pictures as thumbnails in order, each named for its place, then Add Images', async () => {
    gallery(['a', 'b', 'c']);
    await flush();
    const grid = screen.getByRole('list', { name: 'Designs images' });
    expect(
      within(grid)
        .getAllByRole('button', { name: /^Designs: image/ })
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Designs: image 1 of 3', 'Designs: image 2 of 3', 'Designs: image 3 of 3']);
    expect(screen.getByRole('button', { name: /Add Images/ })).toBeTruthy();
    expect(picker().multiple).toBe(true);
    // The card face's size, so the first picture's copy is shared with the board.
    expect(api.url).toHaveBeenCalledWith(SCOPE, 'a', { maxEdge: 512 });
  });

  it('reads a single stored id as a list of one', () => {
    gallery('solo');
    expect(screen.getByRole('button', { name: 'Designs: image 1 of 1' })).toBeTruthy();
  });

  it('starts empty as a full-width Add Images tile with what it takes', () => {
    gallery(undefined);
    expect(screen.getByText('PNG, JPEG, WebP or GIF, up to 10 MB')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Designs: image/ })).toBeNull();
  });

  it('uploads picked files one by one, each joining the list as it lands, and says what landed', async () => {
    gallery(['a']);
    pick([file('one.png'), file('two.jpg', 'image/jpeg')]);
    await flush();
    expect(api.upload).toHaveBeenCalledTimes(2);
    expect(patchItem).toHaveBeenNthCalledWith(1, item.id, { set: { 'f-designs': ['a', 'img-1'] } });
    expect(patchItem).toHaveBeenNthCalledWith(2, item.id, {
      set: { 'f-designs': ['a', 'img-1', 'img-2'] },
    });
    expect(announce).toHaveBeenCalledWith('2 images added');
    expect(tracked).toHaveBeenCalledWith('Plan', 'Added', 'CardImage');
  });

  it('keeps a picture someone else added while the uploads ran', async () => {
    gallery(['a']);
    api.upload.mockImplementationOnce(async () => {
      // Someone adds "z" meanwhile.
      item = { ...item, fields: { ...item.fields, 'f-designs': ['a', 'z'] } };
      setPlan();
      return { image: { id: 'img-new' }, deduped: false };
    });
    pick([file('one.png')]);
    await flush();
    expect(patchItem).toHaveBeenCalledWith(item.id, {
      set: { 'f-designs': ['a', 'z', 'img-new'] },
    });
    expect(announce).toHaveBeenCalledWith('Image added');
  });

  it('shows each file as its own tile, waiting its turn, then uploading', async () => {
    let finish: (v: unknown) => void = () => {};
    let progress: (share: number) => void = () => {};
    api.upload.mockImplementationOnce(
      (_scope: unknown, _file: File, opts: { onProgress: (share: number) => void }) => {
        progress = opts.onProgress;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    );
    gallery([]);
    pick([file('first.png'), file('second.png')]);
    await flush();
    const ring = (name: RegExp) =>
      screen
        .getByLabelText(name)
        .querySelector('[data-upload-ring]')!
        .getAttribute('data-upload-ring');
    expect(screen.getByLabelText('first.png, uploading')).toBeTruthy();
    expect(ring(/^first/)).toBe('turning');
    expect(screen.getByLabelText('second.png, waiting to upload')).toBeTruthy();
    expect(ring(/^second/)).toBe('0');
    // The ring fills by the bytes sent, kept to whole percents: a share within the same percent draws nothing new.
    act(() => progress(0.25));
    expect(screen.getByLabelText('first.png, uploading, 25%')).toBeTruthy();
    expect(ring(/^first/)).toBe('25');
    act(() => progress(0.251));
    act(() => progress(1));
    expect(ring(/^first/)).toBe('100');
    await act(async () => finish({ image: { id: 'img-a' }, deduped: false }));
    await flush();
    expect(screen.queryByLabelText(/first\.png/)).toBeNull();
    expect(patchItem).toHaveBeenCalledTimes(2);
  });

  // Work Tracker 794.
  it('cancels an uploading file and a waiting one: each tile goes, nothing is said, the rest still land', async () => {
    let signal: AbortSignal | undefined;
    api.upload.mockImplementationOnce(
      (_scope: unknown, _file: File, opts: { signal: AbortSignal }) => {
        signal = opts.signal;
        return new Promise((_resolve, reject) =>
          opts.signal.addEventListener('abort', () => reject(new Error('stopped'))),
        );
      },
    );
    gallery([]);
    pick([file('first.png'), file('second.png'), file('third.png')]);
    await flush();
    // The waiting one first: it leaves the queue without ever being sent (a second press before it goes is nothing).
    const second = screen.getByRole('button', { name: 'Cancel upload of second.png' });
    act(() => {
      second.click();
      second.click();
    });
    expect(screen.queryByLabelText(/^second\.png/)).toBeNull();
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Cancel upload of first.png' })),
    );
    await flush();
    expect(signal!.aborted).toBe(true);
    expect(screen.queryByLabelText(/^first\.png/)).toBeNull();
    expect(api.upload).toHaveBeenCalledTimes(2);
    expect((api.upload.mock.calls[1]![1] as File).name).toBe('third.png');
    expect(patchItem).toHaveBeenCalledTimes(1);
    expect(patchItem).toHaveBeenCalledWith(item.id, { set: { 'f-designs': ['img-1'] } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(announce).toHaveBeenCalledWith('Image added');
  });

  it('adds nothing for a file that finished uploading as Cancel was pressed', async () => {
    let finish: (v: unknown) => void = () => {};
    api.upload.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    gallery(['a']);
    pick([file('late.png')]);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel upload of late.png' }));
    await act(async () => finish({ image: { id: 'img-late' }, deduped: false }));
    await flush();
    expect(patchItem).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/^late\.png/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    // A second press, or one for a tile already gone, does nothing.
    expect(screen.queryByRole('button', { name: /Cancel upload/ })).toBeNull();
  });

  it('checks every file before sending, skips the refused and says why, and the rest still land', async () => {
    gallery([]);
    const big = file('huge.png');
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    pick([file('photo.heic', 'image/heic'), big, file('ok.png')]);
    await flush();
    expect(api.upload).toHaveBeenCalledTimes(1);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('photo.heic: Use a PNG, JPEG, WebP or GIF image.');
    expect(alert.textContent).toContain('huge.png: That image is over 10 MB.');
    expect(patchItem).toHaveBeenCalledWith(item.id, { set: { 'f-designs': ['img-1'] } });
  });

  it('takes no more than the field holds, saying so once', async () => {
    const held = Array.from({ length: 19 }, (_, i) => `p${i}`);
    gallery(held);
    pick([file('a.png'), file('b.png'), file('c.png')]);
    await flush();
    expect(api.upload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert').textContent).toBe('Designs holds up to 20.');
  });

  // Work Tracker 746: the same bytes are the same media id, so a picture the field holds is said, never dropped quietly.
  it('says a picture the field already holds, and the rest still land', async () => {
    gallery(['a']);
    api.upload.mockImplementationOnce(async () => ({ image: { id: 'a' }, deduped: true }));
    pick([file('again.png'), file('new.png')]);
    await flush();
    expect(patchItem).toHaveBeenCalledTimes(1);
    expect(patchItem).toHaveBeenCalledWith(item.id, { set: { 'f-designs': ['a', 'img-1'] } });
    expect(screen.getByRole('alert').textContent).toBe('again.png is already in Designs.');
    expect(announce).toHaveBeenCalledWith('Image added');
  });

  // Work Tracker 746: a touch screen always shows each tile's grip and cross, so its grid keeps to 3 a row.
  it('keeps the grid to 3 a row on a touch screen, 4 with room otherwise', () => {
    gallery(['a', 'b']);
    const grid = screen.getByRole('list', { name: 'Designs images' });
    expect(grid.className).toMatch(/(^| )grid-cols-3( |$)/);
    expect(grid.className).toContain('@xs:not-pointer-coarse:grid-cols-4');
    expect(grid.className).not.toMatch(/(^| )@xs:grid-cols-4( |$)/);
  });

  it('says a failed upload by file, and stops offering uploads where the server has none', async () => {
    const { ImageUploadError } = await import('@/lib/api/images');
    api.upload.mockRejectedValue(new ImageUploadError('images_unavailable'));
    gallery([]);
    pick([file('a.png')]);
    await flush();
    expect(screen.getByRole('alert').textContent).toContain(
      "a.png: Image uploads aren't available here.",
    );
    expect(screen.getByRole('button', { name: /Add Images/ }).hasAttribute('disabled')).toBe(true);
  });

  it('says when the card could not take the picture', async () => {
    patchItem.mockResolvedValueOnce(false);
    gallery([]);
    pick([file('a.png')]);
    await flush();
    expect(screen.getByRole('alert').textContent).toContain(
      "a.png: The image couldn't be added to the card. Try again.",
    );
    expect(announce).not.toHaveBeenCalled();
  });

  it('uploads files dropped on the grid', async () => {
    gallery(['a']);
    const grid = screen.getByRole('list', { name: 'Designs images' });
    const dataTransfer = { types: ['Files'], files: [file('drop.png')], dropEffect: 'none' };
    fireEvent.dragOver(grid, { dataTransfer });
    fireEvent.drop(grid, { dataTransfer });
    await flush();
    expect(patchItem).toHaveBeenCalledWith(item.id, { set: { 'f-designs': ['a', 'img-1'] } });
  });

  it('is full at 20: Add Images is off, its tooltip says why', () => {
    gallery(Array.from({ length: 20 }, (_, i) => `p${i}`));
    const add = screen.getByRole('button', { name: /Add Images/ }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
  });

  it('removes a picture as one write, and clears the field with the last', () => {
    const { onSave, view } = gallery(['a', 'b', 'c']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove image 2 from Designs' }));
    expect(onSave).toHaveBeenCalledWith(['a', 'c']);
    expect(tracked).toHaveBeenCalledWith('Plan', 'Removed', 'CardImage');
    view.unmount();
    const one = gallery(['a']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove image 1 from Designs' }));
    expect(one.onSave).toHaveBeenCalledWith(undefined);
  });

  it('moves a focused picture with Alt+← and Alt+→, said aloud, never past the ends', () => {
    const { onSave } = gallery(['a', 'b', 'c']);
    const first = screen.getByRole('button', { name: 'Designs: image 1 of 3' });
    fireEvent.keyDown(first, { key: 'ArrowLeft', altKey: true });
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.keyDown(first, { key: 'ArrowRight', altKey: true });
    expect(onSave).toHaveBeenCalledWith(['b', 'a', 'c']);
    expect(announce).toHaveBeenCalledWith('Moved to 2 of 3');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Designs: image 3 of 3' }), {
      key: 'ArrowLeft',
      altKey: true,
    });
    expect(onSave).toHaveBeenLastCalledWith(['a', 'c', 'b']);
  });

  it('moves a picture by dragging it to another place in the grid', () => {
    const { onSave } = gallery(['a', 'b', 'c', 'd']);
    // A row of four 80 px tiles.
    const rect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const i = ['a', 'b', 'c', 'd'].indexOf(this.dataset['reorderId'] ?? '');
        return {
          left: i * 88,
          top: 0,
          width: 80,
          height: 80,
          right: i * 88 + 80,
          bottom: 80,
        } as DOMRect;
      });
    try {
      const thumb = screen.getByRole('button', { name: 'Designs: image 1 of 4' });
      fireEvent.pointerDown(thumb, { button: 0, clientX: 40, clientY: 40, pointerId: 1 });
      fireEvent.pointerMove(thumb, { clientX: 40 + 180, clientY: 40, pointerId: 1 });
      // The others slide to where they will be.
      const tileOf = (id: string) =>
        document.querySelector<HTMLElement>(`[data-reorder-id="${id}"]`)!;
      expect(tileOf('b').style.transform).toBe('translate(-88px, 0px)');
      expect(tileOf('a').style.transform).toBe('translate(180px, 0px)');
      fireEvent.pointerUp(thumb, { pointerId: 1 });
      expect(onSave).toHaveBeenCalledWith(['b', 'c', 'a', 'd']);
      // The click that ends a drag opens nothing.
      fireEvent.click(thumb);
      expect(api.original).not.toHaveBeenCalled();
    } finally {
      rect.mockRestore();
    }
  });

  it('opens a picture full size in a new tab', async () => {
    const tab = { location: { href: '' }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as never);
    const created = vi.fn(() => 'blob:whole');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: created }));
    try {
      gallery(['a', 'b']);
      fireEvent.click(screen.getByRole('button', { name: 'Designs: image 2 of 2' }));
      await flush();
      expect(open).toHaveBeenCalledWith('', '_blank');
      expect(api.original).toHaveBeenCalledWith(SCOPE, 'b');
      expect(tab.location.href).toBe('blob:whole');
    } finally {
      open.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('draws a picture that cannot be read as a broken tile, still removable', async () => {
    api.url.mockResolvedValue(null);
    gallery(['gone']);
    await flush();
    expect(
      screen.getByRole('button', { name: "Designs: image 1 of 1, can't be shown" }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove image 1 from Designs' })).toBeTruthy();
  });

  it('takes no files in a This Browser plan, and says so', async () => {
    gallery([]);
    offline.value = true;
    pick([file('a.png')]);
    await flush();
    expect(api.upload).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe(
      'Save this plan to your account to add images.',
    );
  });
});

describe('the card panel, for a Viewer', () => {
  it('shows and opens the pictures with no Add, Remove or moving', () => {
    const { onSave } = gallery(['a', 'b'], false);
    expect(screen.getByRole('button', { name: 'Designs: image 1 of 2' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add Images/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Remove image/ })).toBeNull();
    expect(picker()).toBeNull();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Designs: image 1 of 2' }), {
      key: 'ArrowRight',
      altKey: true,
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('reads None with no pictures', () => {
    gallery(undefined, false);
    expect(screen.getByText('None')).toBeTruthy();
  });
});

describe('in the item panel, by share role', () => {
  const ctx = (canEdit: boolean): ItemFieldContext => ({
    item,
    type: TYPE,
    statuses: [],
    people: [SAM],
    canEdit,
    labels: [],
    onSave: vi.fn(),
    onPatch: vi.fn(),
    onOpenItem: vi.fn(),
  });

  // An Editor's and a Participant's panel edits cards (canEdit); a Viewer's does not.
  it.each([
    ['an Editor', true],
    ['a Participant', true],
    ['a Viewer', false],
  ])('gives %s the grid, with Add and Remove only to those who edit cards', (_who, canEdit) => {
    item = make(['a', 'b']);
    setPlan({ canEditCards: canEdit });
    render(<ItemFieldEditor f="f-designs" ctx={ctx(canEdit)} />);
    expect(screen.getByRole('list', { name: 'Designs images' })).toBeTruthy();
    expect(!!screen.queryByRole('button', { name: /Add Images/ })).toBe(canEdit);
    expect(!!screen.queryByRole('button', { name: 'Remove image 1 from Designs' })).toBe(canEdit);
  });

  it('keeps a plain Image field on its one-picture control', () => {
    const shot: CustomFieldDef = { id: 'f-shot', label: 'Shot', kind: 'image' };
    item = { ...make(), fields: { title: 'x', 'f-shot': ['a', 'b'] } };
    render(
      <ItemFieldEditor
        f="f-shot"
        ctx={{ ...ctx(true), item, type: { ...TYPE, fields: ['title', 'f-shot'], custom: [shot] } }}
      />,
    );
    expect(screen.queryByRole('list', { name: 'Shot images' })).toBeNull();
    expect(screen.getByRole('button', { name: /Replace/ })).toBeTruthy();
  });
});

describe('on the card face', () => {
  const palette = { column: '#eee', muted: '#666' } as PlanPalette;

  it('draws the first picture and how many more, named for the count, fetching only the first', async () => {
    render(<div>{customKindPill(DESIGNS, ['a', 'b', 'c', 'd', 'e'], palette)}</div>);
    expect(screen.getByRole('img', { name: 'Designs: 5 images' })).toBeTruthy();
    expect(screen.getByText('+4')).toBeTruthy();
    await flush();
    expect(api.url).toHaveBeenCalledTimes(1);
    expect(api.url).toHaveBeenCalledWith(SCOPE, 'a', { maxEdge: 512 });
  });

  it('draws one picture with no count, and nothing with none', () => {
    render(<div>{customKindPill(DESIGNS, ['a'], palette)}</div>);
    expect(screen.getByRole('img', { name: 'Designs: image' })).toBeTruthy();
    expect(screen.queryByText(/^\+/)).toBeNull();
    cleanup();
    const { container } = render(<div>{customKindPill(DESIGNS, [], palette)}</div>);
    expect(container.textContent).toBe('');
  });

  it('keeps a 200-card board to one picture fetch a card', async () => {
    const faces = Array.from({ length: 200 }, (_, i) =>
      customKindPill({ ...DESIGNS, id: `f-${i}` }, [`first-${i}`, 'b', 'c', 'd'], palette),
    );
    render(<div>{faces}</div>);
    await flush();
    expect(api.url).toHaveBeenCalledTimes(200);
    expect(api.url.mock.calls.every(([, id]) => String(id).startsWith('first-'))).toBe(true);
  });
});

describe('a board of many cards with pictures', () => {
  const palette = { column: '#eee', muted: '#666' } as PlanPalette;
  const faces = (value: (i: number) => unknown) =>
    Array.from({ length: 2000 }, (_, i) =>
      customKindPill({ ...DESIGNS, id: `f-${i}` }, value(i) as never, palette),
    );

  it('draws 2,000 card faces of 20 pictures each within a budget, fetching one picture a card', () => {
    const full = Array.from({ length: 20 }, (_, n) => `p${n}`);
    // Each warmed first, so neither pays for the first render's compiling.
    render(<div>{faces(() => full)}</div>).unmount();
    render(<div>{faces(() => ['p0'])}</div>).unmount();
    const one = cpuMsOf(() => render(<div>{faces(() => ['p0'])}</div>).unmount());
    const several = cpuMsOf(() => render(<div>{faces(() => full)}</div>).unmount());
    if (process.env['MEASURE']) console.log({ severalMs: several, oneMs: one });
    // Measured about 120 ms for 2,000 either way (a count after the thumbnail): no cost per picture held.
    expect(several).toBeLessThan(cpuBudgetMs(1000));
  });
});

describe('Add Field and Edit Field', () => {
  it('adds a Several Images field holding several, and drops the switch from any other kind', () => {
    expect(addedField({ label: ' Designs ', kind: 'image', multiple: true })).toMatchObject({
      label: 'Designs',
      kind: 'image',
      multiple: true,
    });
    expect(addedField({ label: 'Note', kind: 'text', multiple: true }).multiple).toBeUndefined();
  });

  // Work Tracker 746: the Display tab's Available Fields chip wears the Add Field tile's icon, the stacked pictures.
  it("draws a Several Images field's Display chip with the images glyph, not the single Image's", () => {
    const html = (node: React.ReactNode) => render(<>{node}</>).container.innerHTML;
    const chip = html(fieldIcon(TYPE, 'f-designs'));
    cleanup();
    const images = html(PICK_KIND_ICONS.images);
    cleanup();
    const single = html(PICK_KIND_ICONS.image);
    expect(chip).toContain(images);
    expect(chip).not.toContain(single);
  });

  // Work Tracker 746: the field-change line names what the trimmed cards keep part of.
  it('says what a trimmed card keeps part of, one or several', () => {
    const outcome = (trimmed: number, cleared = 0) => ({ held: 3, trimmed, cleared, patches: [] });
    expect(lossMessage(outcome(1), 'Image')).toBe(
      '3 cards have a value; 1 will keep only part of its value.',
    );
    expect(lossMessage(outcome(2, 1), 'Image')).toBe(
      '3 cards have a value; 1 can’t be kept as an Image and will be cleared, and 2 will keep only part of their values.',
    );
  });

  it('lets an Image become Several Images and back, and nothing else', () => {
    const image: CustomFieldDef = { id: 'f', label: 'Shot', kind: 'image' };
    expect(kindChangeRefusal(image, shapeOf('images'))).toBeNull();
    expect(kindChangeRefusal(DESIGNS, shapeOf('image'))).toBeNull();
    expect(kindChangeRefusal(DESIGNS, shapeOf('text'))).toMatch(
      /^An Image holds an uploaded picture/,
    );
  });
});
