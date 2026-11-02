// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  ITEM_ATTACHMENTS_MAX,
  ITEM_TYPES,
  type Item,
  type ItemAttachment,
  type ItemTypeDef,
} from '@liveplanner/items';
import { AttachmentsField, takesText } from './AttachmentsField';
import { ItemFieldEditor, labelsItsControl } from './ItemFieldEditor';
import { PlanCardFace } from './PlanCardFace';
import { PlanBoardCard } from './PlanBoardCells';
import { ATTACHMENTS_FULL, ATTACHMENTS_OFFLINE } from './use-attachment-upload';
import type { PlanPalette } from './plan-palette';

// docs/specs/026-plan/items.md "Attachments": a card's pictures in the panel (add, open, cover, remove), on a board's
// card (a drop, a cover, a count), for each share role: an Editor and a Participant add and change them, a Viewer
// only opens and saves them; a This Browser plan takes none.

const api = vi.hoisted(() => ({
  upload: vi.fn(),
  url: vi.fn(),
  release: vi.fn(),
  original: vi.fn(),
}));
const offline = vi.hoisted(() => ({ value: false }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
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
vi.mock('@/lib/offline/offline-store', () => ({
  isOfflineId: async () => offline.value,
}));
vi.mock('@/hooks/persistence/useIsOfflineProject', () => ({
  useIsOfflineProject: (id: string | null) => (id ? offline.value : false),
}));
const plan = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('./PlanContext', () => ({ usePlan: () => plan.value }));

const SCOPE = { ownerId: 'o1', projectId: 'p1', shareCode: null };
const SAM = { id: 'p-sam', name: 'Sam Lee', color: '#2563eb' };
const SHOTS: ItemTypeDef = {
  ...ITEM_TYPES[1],
  id: 'shots',
  label: 'Shots',
  fields: ['title', 'status', 'attachments'],
  custom: [],
};
const pic = (id: string, cover = false): ItemAttachment => ({
  id,
  name: `${id}.png`,
  size: 1536 * 1024,
  type: 'image/png',
  ...(cover ? { cover: true as const } : {}),
});
const make = (attachments?: ItemAttachment[]): Item => ({
  id: 'item0001',
  type: 'shots',
  key: 1,
  rank: 'i',
  fields: { title: 'Home page', ...(attachments ? { attachments } : {}) },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: SAM,
  updatedBy: SAM,
});
const PALETTE = {
  card: '#fff',
  cardBorder: '#ddd',
  text: '#111',
  muted: '#666',
  column: '#eee',
  focus: '#00f',
} as unknown as PlanPalette;

let item: Item;
const patchItem = vi.fn(async () => true);
const notify = vi.fn();
function setPlan(over: Record<string, unknown> = {}) {
  plan.value = {
    itemsScope: SCOPE,
    items: new Map([[item.id, item]]),
    types: [SHOTS],
    canEditCards: true,
    patchItem,
    announce: vi.fn(),
    notify,
    presence: new Map(),
    ...over,
  };
}
const file = (name: string, type = 'image/png') => new File([new Uint8Array(4)], name, { type });
let uploaded = 0;
beforeEach(() => {
  offline.value = false;
  uploaded = 0;
  item = make();
  setPlan();
  patchItem.mockClear();
  notify.mockClear();
  api.upload.mockReset().mockImplementation(async (_scope, f: File) => {
    uploaded += 1;
    return {
      image: { id: `img-${uploaded}`, contentType: f.type, byteSize: 2048, originalName: f.name },
      deduped: false,
    };
  });
  api.url.mockReset().mockResolvedValue('blob:pic');
  api.release.mockReset();
  api.original.mockReset().mockResolvedValue(new Blob(['x'], { type: 'image/png' }));
});
afterEach(cleanup);
const flush = () => act(async () => {});

function field(value: ItemAttachment[] | undefined, canEdit = true) {
  const onSave = vi.fn();
  render(
    <AttachmentsField
      id="att"
      itemId={item.id}
      value={value as never}
      canEdit={canEdit}
      onSave={onSave}
    />,
  );
  return onSave;
}

describe('the card panel, for an Editor or a Participant', () => {
  it('uploads picked files one by one, then adds them all to the card in one write', async () => {
    field(undefined);
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    expect(input.multiple).toBe(true);
    fireEvent.change(input, { target: { files: [file('a.png'), file('b.jpg', 'image/jpeg')] } });
    await flush();
    expect(api.upload).toHaveBeenCalledTimes(2);
    expect(patchItem).toHaveBeenCalledTimes(1);
    expect(patchItem).toHaveBeenCalledWith(item.id, {
      set: {
        attachments: [
          { id: 'img-1', name: 'a.png', size: 2048, type: 'image/png' },
          { id: 'img-2', name: 'b.jpg', size: 2048, type: 'image/jpeg' },
        ],
      },
    });
  });

  it('takes a drop on the zone, and a pasted image outside a text field, never one pasted into text', async () => {
    field(undefined);
    const zone = screen.getByRole('button', { name: /Add Images/ });
    fireEvent.dragOver(zone, { dataTransfer: { types: ['Files'] } });
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [file('drop.png')] } });
    await flush();
    expect(patchItem).toHaveBeenCalledTimes(1);
    const paste = (target: EventTarget) => {
      const e = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
      Object.defineProperty(e, 'clipboardData', { value: { files: [file('paste.png')] } });
      target.dispatchEvent(e);
    };
    const text = document.createElement('textarea');
    document.body.appendChild(text);
    paste(text);
    await flush();
    expect(patchItem).toHaveBeenCalledTimes(1);
    paste(document.body);
    await flush();
    expect(patchItem).toHaveBeenCalledTimes(2);
    text.remove();
  });

  it('adds what fits and says the card is full', async () => {
    item = make(Array.from({ length: ITEM_ATTACHMENTS_MAX - 1 }, (_, i) => pic(`p${i}`)));
    setPlan();
    field(item.fields['attachments'] as ItemAttachment[]);
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file('a.png'), file('b.png')] } });
    await flush();
    expect(api.upload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert').textContent).toBe(ATTACHMENTS_FULL);
  });

  it('says why a file was refused, and still adds the rest', async () => {
    const { ImageUploadError } = await import('@/lib/api/images');
    api.upload.mockRejectedValueOnce(new ImageUploadError('file_too_large'));
    field(undefined);
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file('big.png'), file('ok.png')] } });
    await flush();
    expect(screen.getByRole('alert').textContent).toBe('That image is over 10 MB.');
    expect(patchItem).toHaveBeenCalledTimes(1);
  });

  it('lists each picture with its name, size and Cover tag, and sets, moves and removes the cover', async () => {
    const onSave = field([pic('a'), pic('b', true)]);
    await flush();
    const rows = within(screen.getByRole('list', { name: 'Attachments' })).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[1]!.textContent).toContain('1.5 MB');
    expect(rows[1]!.textContent).toContain('Cover');
    fireEvent.click(screen.getByRole('button', { name: 'More for a.png' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Set as Cover' }));
    expect(onSave).toHaveBeenLastCalledWith([pic('a', true), pic('b')]);
    fireEvent.click(screen.getByRole('button', { name: 'More for b.png' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove Cover' }));
    expect(onSave).toHaveBeenLastCalledWith([pic('a'), pic('b')]);
    fireEvent.click(screen.getByRole('button', { name: 'More for a.png' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));
    expect(onSave).toHaveBeenLastCalledWith([pic('b', true)]);
  });

  it('clears the field when its last picture is removed', () => {
    const onSave = field([pic('a')]);
    fireEvent.click(screen.getByRole('button', { name: 'More for a.png' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));
    expect(onSave).toHaveBeenLastCalledWith(undefined);
  });

  it('opens a picture whole in a new tab, and downloads it under its name', async () => {
    const tab = { location: { href: '' }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as never);
    const create = vi.fn(() => 'blob:whole');
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    field([pic('a')]);
    fireEvent.click(screen.getByRole('button', { name: /^Open a\.png/ }));
    await flush();
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(tab.location.href).toBe('blob:whole');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'More for a.png' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Download' }));
    await flush();
    expect(click).toHaveBeenCalled();
    open.mockRestore();
    click.mockRestore();
  });

  it('closes the new tab when the picture can’t be read', async () => {
    api.original.mockResolvedValue(null);
    const tab = { location: { href: '' }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as never);
    field([pic('a')]);
    fireEvent.click(screen.getByRole('button', { name: /^Open a\.png/ }));
    await flush();
    expect(tab.close).toHaveBeenCalled();
    open.mockRestore();
  });
});

describe('the card panel, edges', () => {
  it('opens the picker from the zone, and lets go of a drag that leaves', () => {
    field([pic('a')]);
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: /Add Images/ }));
    expect(click).toHaveBeenCalled();
    const list = screen.getByRole('list', { name: 'Attachments' });
    fireEvent.dragOver(list, { dataTransfer: { types: ['Files'] } });
    expect(list.className).toContain('ring-brand-500');
    fireEvent.dragLeave(list.parentElement!, { relatedTarget: document.body });
    expect(list.className).not.toContain('ring-brand-500');
  });

  it('opens from the menu, and in a tab of its own when the first was blocked', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    Object.assign(URL, { createObjectURL: () => 'blob:whole', revokeObjectURL: vi.fn() });
    field([pic('a')]);
    fireEvent.click(screen.getByRole('button', { name: 'More for a.png' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open' }));
    await flush();
    expect(open).toHaveBeenLastCalledWith('blob:whole', '_blank');
    open.mockRestore();
  });

  it('says so when the card refuses the pictures', async () => {
    patchItem.mockResolvedValueOnce(false);
    field(undefined);
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file('a.png')] } });
    await flush();
    expect(screen.getByRole('alert').textContent).toContain("couldn't be added");
  });
});

describe('the Display’s example card', () => {
  it('draws the cover as a placeholder where Cover Image sits', () => {
    item = make([pic('a')]);
    setPlan();
    render(
      <PlanCardFace
        item={item}
        palette={PALETTE}
        fields={['cover']}
        typeOverride={SHOTS}
        edit={{ slot: (_slot, bits) => bits, bit: (_f, node) => node }}
      />,
    );
    expect(screen.getByText('Cover image')).toBeTruthy();
    expect(screen.getByText('Cover Image')).toBeTruthy();
  });
});

describe('the card panel, for a Viewer', () => {
  it('shows the pictures to open and save, with no zone and no changes in the menu', async () => {
    field([pic('a', true)], false);
    await flush();
    expect(screen.queryByRole('button', { name: /Add Images/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More for a.png' }));
    const items = screen.getAllByRole('menuitem').map((m) => m.textContent);
    expect(items).toEqual(['Open', 'Download']);
  });

  it('reads None with no pictures', () => {
    field(undefined, false);
    expect(screen.getByText('None')).toBeTruthy();
  });
});

describe('a This Browser plan', () => {
  it('takes no picture, and says why', async () => {
    offline.value = true;
    field(undefined);
    await flush();
    const zone = screen.getByRole('button', { name: /Add Images/ });
    expect(zone).toHaveProperty('disabled', true);
    expect(zone.textContent).toContain(ATTACHMENTS_OFFLINE);
  });
});

describe('in the item panel', () => {
  it('draws the field for a type that offers it, labelled by its own controls', () => {
    expect(labelsItsControl(SHOTS, 'attachments')).toBe(false);
    render(
      <ItemFieldEditor
        f="attachments"
        ctx={{
          item,
          type: SHOTS,
          statuses: [],
          people: [SAM],
          canEdit: true,
          labels: [],
          onSave: vi.fn(),
          onPatch: vi.fn(),
          onOpenItem: vi.fn(),
        }}
      />,
    );
    expect(screen.getByRole('button', { name: /Add Images/ })).toBeTruthy();
  });

  it('knows a text field from anything else', () => {
    const input = document.createElement('input');
    const div = document.createElement('div');
    expect(takesText(input)).toBe(true);
    expect(takesText(div)).toBe(false);
    expect(takesText(null)).toBe(false);
  });
});

describe('on the card face', () => {
  it('draws the cover across a Detailed card, and the count as a chip', async () => {
    item = make([pic('a'), pic('b', true), pic('c')]);
    setPlan();
    render(<PlanCardFace item={item} palette={PALETTE} fields={['key', 'attachments', 'cover']} />);
    await flush();
    expect(screen.getByRole('img', { name: 'Cover: b.png' })).toBeTruthy();
    expect(screen.getByText('Attachments: 3')).toBeTruthy();
    expect(api.url).toHaveBeenCalledWith(SCOPE, 'b', { maxEdge: 640 });
  });

  it('draws no cover on a Minimal card, nor without one set', async () => {
    item = make([pic('a')]);
    setPlan();
    render(
      <PlanCardFace
        item={item}
        palette={PALETTE}
        fields={['attachments', 'cover']}
        size="minimal"
      />,
    );
    render(<PlanCardFace item={item} palette={PALETTE} fields={['attachments', 'cover']} />);
    await flush();
    expect(screen.queryByRole('img', { name: /^Cover/ })).toBeNull();
  });
});

describe('a file dropped on a board’s card', () => {
  const card = () =>
    render(
      <PlanBoardCard
        item={item}
        palette={PALETTE}
        placeholderBefore={undefined}
        lifted={false}
        done={false}
        setupFields={['key']}
        cardSize="detailed"
        faceDown={false}
        presence={undefined}
        interactive
        canMove
        onPress={vi.fn()}
        onOpen={vi.fn()}
        onKey={vi.fn()}
        onMenu={vi.fn()}
      />,
    );

  it('joins its Attachments, the card ringed while the file is over it', async () => {
    card();
    const el = document.querySelector('[data-plan-card]')!;
    fireEvent.dragOver(el, { dataTransfer: { types: ['Files'] } });
    expect(screen.getByText('Drop to Attach')).toBeTruthy();
    fireEvent.drop(el, { dataTransfer: { types: ['Files'], files: [file('drop.png')] } });
    await flush();
    expect(patchItem).toHaveBeenCalledWith(item.id, {
      set: { attachments: [{ id: 'img-1', name: 'drop.png', size: 2048, type: 'image/png' }] },
    });
  });

  it('lets the ring go when the file leaves', () => {
    card();
    const el = document.querySelector('[data-plan-card]')!;
    fireEvent.dragOver(el, { dataTransfer: { types: ['Files'] } });
    fireEvent.dragLeave(el, { relatedTarget: document.body });
    expect(screen.queryByText('Drop to Attach')).toBeNull();
  });

  it('is said in a toast when the plan is in This Browser', async () => {
    card();
    offline.value = true;
    const el = document.querySelector('[data-plan-card]')!;
    fireEvent.drop(el, { dataTransfer: { types: ['Files'], files: [file('drop.png')] } });
    await flush();
    expect(notify).toHaveBeenCalledWith(ATTACHMENTS_OFFLINE);
    expect(patchItem).not.toHaveBeenCalled();
  });

  it('is not taken by a Viewer, nor by a card whose type has no Attachments', () => {
    setPlan({ canEditCards: false });
    card();
    const el = document.querySelector('[data-plan-card]')!;
    fireEvent.dragOver(el, { dataTransfer: { types: ['Files'] } });
    expect(screen.queryByText('Drop to Attach')).toBeNull();
    cleanup();
    setPlan({ types: [{ ...SHOTS, fields: ['title', 'status'] }] });
    card();
    fireEvent.dragOver(document.querySelector('[data-plan-card]')!, {
      dataTransfer: { types: ['Files'] },
    });
    expect(screen.queryByText('Drop to Attach')).toBeNull();
  });
});
