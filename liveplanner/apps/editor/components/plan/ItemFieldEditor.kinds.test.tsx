// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ITEM_TYPES, type Item, type ItemTypeDef } from '@liveplanner/items';
import { ItemFieldEditor, labelsItsControl, type ItemFieldContext } from './ItemFieldEditor';
import { customKindPill, isBuiltInKindPill } from './CustomKindPill';
import { BuiltInKindField } from './BuiltInKindField';
import type { PlanPalette } from './plan-palette';

// docs/specs/026-plan/item-types.md "Custom field kinds" and "Image fields": a custom field of a built-in kind is
// edited, and drawn on the card, as its built-in field is; an Image field uploads and shows one picture.

const api = vi.hoisted(() => ({
  upload: vi.fn(),
  url: vi.fn(),
  release: vi.fn(),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/api/images', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/images')>('@/lib/api/images');
  return {
    ...actual,
    apiUploadImage: api.upload,
    apiImageUrl: api.url,
    releaseImageUrl: api.release,
  };
});
const SCOPE = { ownerId: 'o1', projectId: 'p1', shareCode: null, tabId: null };
const plan = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('./PlanContext', () => ({ usePlan: () => plan.value }));

beforeEach(() => {
  plan.value = { itemsScope: SCOPE, people: [SAM], items: new Map(), types: [REVIEW] };
  api.upload.mockReset();
  api.url.mockReset().mockResolvedValue('blob:pic');
  api.release.mockReset();
});
afterEach(cleanup);

const SAM = { id: 'p-sam', name: 'Sam Lee', color: '#2563eb' };
const REVIEW: ItemTypeDef = {
  ...ITEM_TYPES[1],
  id: 'review',
  label: 'Review',
  fields: ['title', 'status', 'f-reviewer', 'f-areas', 'f-tone', 'f-steps', 'f-shot'],
  custom: [
    { id: 'f-reviewer', label: 'Reviewer', kind: 'person' },
    { id: 'f-areas', label: 'Areas', kind: 'labels' },
    { id: 'f-tone', label: 'Tone', kind: 'colour' },
    { id: 'f-steps', label: 'Steps', kind: 'checklist' },
    { id: 'f-shot', label: 'Shot', kind: 'image' },
  ],
};
const make = (fields: Item['fields']): Item => ({
  id: 'item0001',
  type: 'review',
  key: 1,
  rank: 'i',
  fields: { title: 'Home page', ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: SAM,
  updatedBy: SAM,
});
function ctx(item: Item, over: Partial<ItemFieldContext> = {}): ItemFieldContext {
  return {
    item,
    type: REVIEW,
    statuses: [],
    people: [SAM],
    canEdit: true,
    labels: [{ label: 'Web', count: 1 }],
    onSave: vi.fn(),
    onPatch: vi.fn(),
    onOpenItem: vi.fn(),
    ...over,
  };
}
const flush = () => act(async () => {});

describe('the card panel', () => {
  it('edits a Person field with the people picker, saving under the field’s own id', () => {
    const c = ctx(make({}));
    render(<ItemFieldEditor f="f-reviewer" ctx={c} />);
    fireEvent.click(screen.getByRole('button', { name: /^Reviewer:/ }));
    const list = screen.getByRole('listbox', { name: 'Reviewer' });
    expect(list.textContent).toContain('+ Custom Reviewer');
    fireEvent.click(screen.getByRole('option', { name: 'Sam Lee' }));
    expect(c.onSave).toHaveBeenCalledWith('f-reviewer', SAM);
  });

  it('edits a Checklist field with the checklist rows', () => {
    const c = ctx(make({ 'f-steps': [{ text: 'Draft', done: false }] }));
    render(<ItemFieldEditor f="f-steps" ctx={c} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Draft/ }));
    expect(c.onSave).toHaveBeenCalledWith('f-steps', [{ text: 'Draft', done: true }]);
  });

  it('labels the controls it can, as the built-ins do', () => {
    expect(labelsItsControl(REVIEW, 'f-reviewer')).toBe(true);
    expect(labelsItsControl(REVIEW, 'f-areas')).toBe(true);
    expect(labelsItsControl(REVIEW, 'f-tone')).toBe(false);
    expect(labelsItsControl(REVIEW, 'f-steps')).toBe(false);
    expect(labelsItsControl(REVIEW, 'f-shot')).toBe(false);
    expect(labelsItsControl(REVIEW, 'checklist')).toBe(false);
  });

  it('draws a Colour field with the colour picker’s field', () => {
    render(<ItemFieldEditor f="f-tone" ctx={ctx(make({ 'f-tone': '#0d9488' }))} />);
    expect(screen.getByRole('button', { name: /Teal/ })).toBeTruthy();
  });
});

describe('an Image field', () => {
  it('uploads a picked file and saves its id', async () => {
    api.upload.mockResolvedValue({ image: { id: 'img_1' }, deduped: false });
    const c = ctx(make({}));
    const { container } = render(<ItemFieldEditor f="f-shot" ctx={c} />);
    expect(screen.getByRole('button', { name: /Add an Image/ })).toBeTruthy();
    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText('Uploading…')).toBeTruthy();
    await flush();
    expect(api.upload).toHaveBeenCalledWith(SCOPE, file);
    expect(c.onSave).toHaveBeenCalledWith('f-shot', 'img_1');
  });

  it('takes a dropped file, and says why an upload was refused', async () => {
    const { ImageUploadError } = await import('@/lib/api/images');
    api.upload.mockRejectedValue(new ImageUploadError('gallery_full'));
    render(<ItemFieldEditor f="f-shot" ctx={ctx(make({}))} />);
    const zone = screen.getByRole('button', { name: /Add an Image/ });
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    fireEvent.dragOver(zone, { dataTransfer: { types: ['Files'], files: [file] } });
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [file] } });
    expect(
      await screen.findByText('Your image gallery is full. Delete some images and try again.'),
    ).toBeTruthy();
  });

  it('offers no upload once the server says it has no media service', async () => {
    const { ImageUploadError } = await import('@/lib/api/images');
    api.upload.mockRejectedValue(new ImageUploadError('images_unavailable'));
    const { container } = render(<ItemFieldEditor f="f-shot" ctx={ctx(make({}))} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    });
    expect(await screen.findByText("Image uploads aren't available here.")).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add an Image/ })).toHaveProperty('disabled', true);
  });

  it('shows the picture with Replace and Remove, and Remove clears it', async () => {
    const c = ctx(make({ 'f-shot': 'img_1' }));
    const { unmount } = render(<ItemFieldEditor f="f-shot" ctx={c} />);
    const img = await screen.findByRole('img', { name: 'Shot: image' });
    expect(img.getAttribute('src')).toBe('blob:pic');
    expect(api.url).toHaveBeenCalledWith(SCOPE, 'img_1', {});
    expect(screen.getByRole('button', { name: 'Replace' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(c.onSave).toHaveBeenCalledWith('f-shot', undefined);
    unmount();
    expect(api.release).toHaveBeenCalledWith('blob:pic');
  });

  it('says a picture it can’t read can’t be shown, and a Viewer sees no controls', async () => {
    api.url.mockResolvedValue(null);
    render(
      <ItemFieldEditor f="f-shot" ctx={ctx(make({ 'f-shot': 'img_1' }), { canEdit: false })} />,
    );
    expect(await screen.findByText("This image can't be shown")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Replace' })).toBeNull();
    cleanup();
    render(<ItemFieldEditor f="f-shot" ctx={ctx(make({}), { canEdit: false })} />);
    expect(screen.getByText('None')).toBeTruthy();
  });
});

describe('an Image field, fetching', () => {
  it('gives back a picture that arrives after the panel closed', async () => {
    let answer: (url: string) => void = () => {};
    api.url.mockReturnValue(new Promise<string>((resolve) => (answer = resolve)));
    const { unmount } = render(
      <ItemFieldEditor f="f-shot" ctx={ctx(make({ 'f-shot': 'img_1' }))} />,
    );
    expect(screen.getByRole('img', { name: 'Shot: image, loading' })).toBeTruthy();
    unmount();
    answer('blob:late');
    await flush();
    expect(api.release).toHaveBeenCalledWith('blob:late');
  });

  it('shows the drop target while a file is dragged over, and not after it leaves', () => {
    render(<ItemFieldEditor f="f-shot" ctx={ctx(make({}))} />);
    const zone = screen.getByRole('button', { name: /Add an Image/ });
    fireEvent.dragOver(zone, { dataTransfer: { types: ['Files'], files: [] } });
    expect(zone.classList.contains('border-brand-500')).toBe(true);
    fireEvent.dragLeave(zone);
    expect(zone.classList.contains('border-brand-500')).toBe(false);
    fireEvent.dragOver(zone, { dataTransfer: { types: ['text/plain'], files: [] } });
    expect(zone.classList.contains('border-brand-500')).toBe(false);
  });

  it('says a picture can’t be shown where the plan has no scope to read it from', async () => {
    plan.value = { people: [SAM] };
    render(<ItemFieldEditor f="f-shot" ctx={ctx(make({ 'f-shot': 'img_1' }))} />);
    expect(screen.getByText("This image can't be shown")).toBeTruthy();
    expect(api.url).not.toHaveBeenCalled();
  });

  it('waits for a card face thumbnail to scroll into view', async () => {
    const seen: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
          seen.push(cb);
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    try {
      const shot = REVIEW.custom!.find((f) => f.id === 'f-shot')!;
      render(<div>{customKindPill(shot, 'img_1', {} as PlanPalette)}</div>);
      await flush();
      expect(api.url).not.toHaveBeenCalled();
      act(() => seen[0]!([{ isIntersecting: false }]));
      expect(api.url).not.toHaveBeenCalled();
      act(() => seen[0]!([{ isIntersecting: true }]));
      await flush();
      expect(disconnect).toHaveBeenCalled();
      expect(api.url).toHaveBeenCalledWith(SCOPE, 'img_1', { maxEdge: 512 });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('on the card face', () => {
  const palette = { column: '#eee', muted: '#666' } as PlanPalette;
  const def = (id: string) => REVIEW.custom!.find((f) => f.id === id)!;
  const draw = (id: string, value: unknown) =>
    render(<div>{customKindPill(def(id), value as never, palette)}</div>);

  it('draws each built-in kind as its field, named for assistive technology', async () => {
    expect(isBuiltInKindPill(def('f-reviewer'))).toBe(true);
    expect(isBuiltInKindPill({ id: 'f-x', label: 'X', kind: 'text' })).toBe(false);
    draw('f-reviewer', SAM);
    expect(screen.getByLabelText('Reviewer: Sam Lee')).toBeTruthy();
    cleanup();
    draw('f-areas', ['Web', 'Q3']);
    expect(screen.getByText('Areas: Web, Q3')).toBeTruthy();
    cleanup();
    draw('f-tone', '#0d9488');
    expect(screen.getByText('Tone: Teal')).toBeTruthy();
    cleanup();
    draw('f-steps', [{ text: 'a', done: true }]);
    expect(screen.getByText('Steps 1 of 1 done')).toBeTruthy();
    cleanup();
    draw('f-shot', 'img_1');
    expect(screen.getByRole('img', { name: 'Shot: image' })).toBeTruthy();
    await flush();
    expect(api.url).toHaveBeenCalledWith(SCOPE, 'img_1', { maxEdge: 512 });
  });

  it('draws nothing for an empty or wrong value', () => {
    for (const [id, value] of [
      ['f-reviewer', 'Sam'],
      ['f-areas', []],
      ['f-tone', 'teal'],
      ['f-steps', []],
      ['f-shot', ''],
    ] as const) {
      const { container } = draw(id, value);
      expect(container.textContent).toBe('');
      cleanup();
    }
    const { container } = render(
      <div>{customKindPill({ id: 'f-x', label: 'X', kind: 'text' }, 'a', palette)}</div>,
    );
    expect(container.textContent).toBe('');
  });
});

describe('New {Type}’s required fields', () => {
  it('asks a Person, Labels, Colour and Checklist with their built-in controls', () => {
    const onSave = vi.fn();
    render(
      <BuiltInKindField id="r" label="Reviewer" kind="person" value={undefined} onSave={onSave} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Reviewer:/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Sam Lee' }));
    expect(onSave).toHaveBeenCalledWith(SAM);
    cleanup();
    render(<BuiltInKindField id="r" label="F" kind="labels" value={['Web']} onSave={onSave} />);
    expect(screen.getByText('Web')).toBeTruthy();
    cleanup();
    render(<BuiltInKindField id="r" label="F" kind="colour" value="#0D9488" onSave={onSave} />);
    expect(screen.getByRole('button', { name: /Teal/ })).toBeTruthy();
    cleanup();
    render(<BuiltInKindField id="r" label="F" kind="checklist" value={[]} onSave={onSave} />);
    expect(screen.getByRole('textbox')).toBeTruthy();
    cleanup();
    const { container } = render(
      <BuiltInKindField id="r" label="F" kind="text" value={undefined} onSave={onSave} />,
    );
    expect(container.textContent).toBe('');
  });
});
