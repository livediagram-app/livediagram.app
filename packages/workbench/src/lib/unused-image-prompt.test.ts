import { describe, expect, it, vi } from 'vitest';
import { UNUSED_IMAGE_IDS_MAX } from '@liveworkspace/media';
import type { ToastActionSpec } from '@liveworkspace/ui/toast';
import {
  createUnusedImagePrompt,
  everyTabLoaded,
  mayOfferUnusedImages,
  picturesOfTabs,
  nextTask,
  UNUSED_IMAGE_TOAST_KEY,
  unusedImageWords,
  type UnusedImagePromptDeps,
} from './unused-image-prompt';
import { readUnusedImageChoice, withUnusedImageChoice } from './unused-image-choice';

// Each product's docs/specs/009-elements/images.md "Deleting an unused picture".
function harness(over: Partial<UnusedImagePromptDeps> = {}) {
  const placed = new Set<string>();
  const shown: ToastActionSpec[] = [];
  const errors: string[] = [];
  const dismissed: string[] = [];
  const check = vi.fn(async (ids: string[]) => ids);
  const remove = vi.fn(async (_id: string) => {});
  const loadAllTabs = vi.fn(async () => true);
  const deps: UnusedImagePromptDeps = {
    placed: () => placed,
    allTabsLoaded: () => true,
    loadAllTabs,
    check,
    remove,
    toast: {
      action: (spec) => void shown.push(spec),
      dismissAction: (key) => void dismissed.push(key),
      error: (message) => void errors.push(message),
    },
    settle: async () => {},
    ...over,
  };
  const offer = createUnusedImagePrompt(deps);
  const last = () => shown.at(-1)!;
  const press = (label: string) =>
    last()
      .actions.find((a) => a.label === label)!
      .onSelect();
  return { offer, placed, shown, errors, dismissed, check, remove, loadAllTabs, last, press };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the offer after a delete', () => {
  it('offers one unused picture, Keep then the destructive Delete from Storage, saying it can’t be undone', async () => {
    const h = harness();
    await h.offer(['img-1']);
    expect(h.check).toHaveBeenCalledWith(['img-1']);
    expect(h.last().key).toBe(UNUSED_IMAGE_TOAST_KEY);
    expect(h.last().message).toBe(
      'This image isn’t used anywhere else. Delete it from storage? It can’t be undone.',
    );
    expect(h.last().actions.map((a) => [a.label, a.destructive === true])).toEqual([
      ['Keep', false],
      ['Delete from Storage', true],
    ]);
    expect(h.last().actions[1]!.ariaLabel).toBe('Delete from Storage: the image');
    expect(h.remove).not.toHaveBeenCalled();
  });

  it('makes one offer with the count for a multi-selection, in one request', async () => {
    const h = harness();
    await h.offer(['a', 'b', 'a', 'c']);
    expect(h.check).toHaveBeenCalledTimes(1);
    expect(h.check).toHaveBeenCalledWith(['a', 'b', 'c']);
    expect(h.shown).toHaveLength(1);
    expect(h.last().message).toBe(
      '3 images aren’t used anywhere else. Delete them from storage? It can’t be undone.',
    );
    expect(h.last().actions[0]!.ariaLabel).toBe('Keep: leave the 3 images in storage');
  });

  it('asks about at most the cap', async () => {
    const h = harness();
    await h.offer(Array.from({ length: UNUSED_IMAGE_IDS_MAX + 3 }, (_, i) => `img-${i}`));
    expect(h.check.mock.calls[0]![0]).toHaveLength(UNUSED_IMAGE_IDS_MAX);
  });

  it('asks nothing for a placeholder, an Offline data URI, or a picture another element here still places', async () => {
    const h = harness();
    h.placed.add('kept');
    await h.offer(['', 'data:image/png;base64,AA']);
    await h.offer(['kept']);
    expect(h.check).not.toHaveBeenCalled();
    expect(h.shown).toHaveLength(0);
  });

  it('offers only what the api answers unused: another item, the Trash, a Library item keep the rest', async () => {
    const h = harness({ check: async () => ['free', 'never-asked'] });
    await h.offer(['free', 'in-another-app', 'in-the-trash', 'in-library']);
    expect(h.last().message).toMatch(/^This image/);
    h.press('Delete from Storage');
    await flush();
    expect(h.remove.mock.calls).toEqual([['free']]);
  });

  it('offers nothing when the api answers none, fails or throws (unknown, offline, not the owner)', async () => {
    for (const check of [async () => [], async () => Promise.reject(new Error('offline'))]) {
      const h = harness({ check });
      await h.offer(['img-1']);
      expect(h.shown).toHaveLength(0);
    }
  });

  it('loads the tabs not opened here only once the api has answered, and offers nothing when one fails', async () => {
    const h = harness({ allTabsLoaded: () => false });
    await h.offer(['img-1']);
    expect(h.loadAllTabs).toHaveBeenCalledTimes(1);
    expect(h.shown).toHaveLength(1);

    const failing = harness({ allTabsLoaded: () => false, loadAllTabs: async () => false });
    await failing.offer(['img-1']);
    expect(failing.shown).toHaveLength(0);

    const throwing = harness({
      allTabsLoaded: () => false,
      loadAllTabs: () => Promise.reject(new Error('net')),
    });
    await throwing.offer(['img-1']);
    expect(throwing.shown).toHaveLength(0);

    const none = harness({ allTabsLoaded: () => false, check: async () => [] });
    await none.offer(['img-1']);
    expect(none.loadAllTabs).not.toHaveBeenCalled();
  });

  it('offers nothing when a loaded tab places the picture', async () => {
    const h = harness({ allTabsLoaded: () => false });
    h.loadAllTabs.mockImplementation(async () => {
      h.placed.add('img-1');
      return true;
    });
    await h.offer(['img-1']);
    expect(h.shown).toHaveLength(0);
  });

  it('lets only the newest delete offer, an older answer arriving late saying nothing', async () => {
    let release: (ids: string[]) => void = () => {};
    const h = harness();
    h.check.mockImplementationOnce(
      (ids) => new Promise<string[]>((resolve) => (release = () => resolve(ids))),
    );
    const first = h.offer(['old']);
    await flush();
    await h.offer(['new']);
    release(['old']);
    await first;
    expect(h.shown).toHaveLength(1);
    expect(h.check.mock.calls.at(-1)![0]).toEqual(['new']);
  });

  it('gives way to a newer delete made while it settles or loads tabs', async () => {
    let first = true;
    const settling: ReturnType<typeof harness> = harness({
      settle: async () => {
        if (!first) return;
        first = false;
        void settling.offer(['b']);
      },
    });
    await settling.offer(['a']);
    await flush();
    expect(settling.check.mock.calls).toEqual([[['b']]]);

    let once = true;
    const loading: ReturnType<typeof harness> = harness({
      allTabsLoaded: () => false,
      loadAllTabs: async () => {
        if (once) {
          once = false;
          void loading.offer(['b']);
        }
        return true;
      },
    });
    await loading.offer(['a']);
    await flush();
    expect(loading.shown).toHaveLength(1);
    expect(loading.check.mock.calls.at(-1)![0]).toEqual(['b']);
  });

  it('runs by the next task by default, after the delete has rendered', async () => {
    const h = harness({ settle: undefined });
    const run = h.offer(['img-1']);
    expect(h.check).not.toHaveBeenCalled();
    await run;
    expect(h.check).toHaveBeenCalledTimes(1);
    await expect(nextTask()).resolves.toBeUndefined();
  });
});

describe('the answers', () => {
  it('Keep closes it and deletes nothing', async () => {
    const h = harness();
    await h.offer(['img-1']);
    h.press('Keep');
    expect(h.dismissed).toEqual([UNUSED_IMAGE_TOAST_KEY]);
    expect(h.remove).not.toHaveBeenCalled();
  });

  it('Delete from Storage deletes each and says so', async () => {
    const h = harness();
    await h.offer(['a', 'b']);
    h.press('Delete from Storage');
    await flush();
    expect(h.remove.mock.calls).toEqual([['a'], ['b']]);
    expect(h.last()).toEqual({
      key: UNUSED_IMAGE_TOAST_KEY,
      message: '2 images deleted from storage',
      actions: [],
    });
  });

  it('leaves out a picture placed again since (an undo), and deletes nothing when all are', async () => {
    const h = harness();
    await h.offer(['a', 'b']);
    h.placed.add('a');
    h.press('Delete from Storage');
    await flush();
    expect(h.remove.mock.calls).toEqual([['b']]);
    expect(h.last().message).toBe('Image deleted from storage');

    const back = harness();
    await back.offer(['a']);
    back.placed.add('a');
    back.press('Delete from Storage');
    await flush();
    expect(back.remove).not.toHaveBeenCalled();
    expect(back.dismissed).toEqual([UNUSED_IMAGE_TOAST_KEY]);
  });

  it('says a failed delete, counting the pictures that stayed', async () => {
    const h = harness();
    h.remove.mockImplementation(async (id) => {
      if (id !== 'ok') throw new Error('500');
    });
    await h.offer(['ok', 'x', 'y']);
    h.press('Delete from Storage');
    await flush();
    expect(h.errors).toEqual(['Couldn’t delete 2 images from storage. Try again.']);
    expect(h.dismissed).toEqual([UNUSED_IMAGE_TOAST_KEY]);
    expect(unusedImageWords(1).failed).toBe('Couldn’t delete the image from storage. Try again.');
  });
});

describe('who is offered it', () => {
  const owner = {
    itemId: 'd1',
    signedIn: true,
    offline: false,
    embedded: false,
    workbench: false,
    structureReadOnly: false,
    participating: false,
  };

  it('is the signed-in owner or Editor of a whole cloud item', () => {
    expect(mayOfferUnusedImages(owner)).toBe(true);
  });

  it('is never a guest, an Offline item, an embed, a workbench, a Viewer, a tab-scoped visitor or a Participant', () => {
    expect(mayOfferUnusedImages({ ...owner, itemId: null })).toBe(false);
    expect(mayOfferUnusedImages({ ...owner, signedIn: false })).toBe(false);
    expect(mayOfferUnusedImages({ ...owner, offline: true })).toBe(false);
    expect(mayOfferUnusedImages({ ...owner, embedded: true })).toBe(false);
    expect(mayOfferUnusedImages({ ...owner, workbench: true })).toBe(false);
    expect(mayOfferUnusedImages({ ...owner, structureReadOnly: true })).toBe(false);
    expect(mayOfferUnusedImages({ ...owner, participating: true })).toBe(false);
  });
});

describe('reading the item', () => {
  it('gathers every tab’s pictures once', () => {
    const tabs = [{ ids: ['a', 'b'] }, { ids: ['b', 'c'] }];
    expect([...picturesOfTabs(tabs, (t) => t.ids)]).toEqual(['a', 'b', 'c']);
  });

  it('counts a tab whole when loaded or holding elements', () => {
    const loaded = new Set(['t1']);
    expect(
      everyTabLoaded(
        [
          { id: 't1', elements: [] },
          { id: 't2', elements: [1] },
        ],
        loaded,
      ),
    ).toBe(true);
    expect(everyTabLoaded([{ id: 't3', elements: [] }], loaded)).toBe(false);
  });
});

// images.md "Remember My Choice" and "The setting".
describe('the person’s choice', () => {
  it('asks by default, with no switch when nothing can save the answer', async () => {
    const h = harness();
    await h.offer(['a']);
    expect(h.last().toggle).toBeUndefined();
    expect(h.last().actions.map((a) => a.label)).toEqual(['Keep', 'Delete from Storage']);
  });

  it('Always Keep asks nothing and sends nothing', async () => {
    const h = harness({ choice: () => 'keep' });
    await h.offer(['a']);
    expect(h.check).not.toHaveBeenCalled();
    expect(h.shown).toHaveLength(0);
    expect(h.remove).not.toHaveBeenCalled();
  });

  it('Always Delete deletes after the same checks, with a notice shown whatever the toasts', async () => {
    const h = harness({ choice: () => 'delete' });
    await h.offer(['a', 'b']);
    expect(h.check).toHaveBeenCalledWith(['a', 'b']);
    expect(h.remove.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
    expect(h.last().message).toBe(
      '2 images weren’t used anywhere else, so they were deleted from storage.',
    );
    expect(h.last().important).toBe(true);
    expect(h.last().actions).toEqual([]);

    const one = harness({ choice: () => 'delete' });
    await one.offer(['a']);
    expect(one.last().message).toBe(
      'The image wasn’t used anywhere else, so it was deleted from storage.',
    );
  });

  it('Always Delete still keeps what is used or unsure', async () => {
    const used = harness({ choice: () => 'delete', check: vi.fn(async () => []) });
    await used.offer(['a']);
    expect(used.remove).not.toHaveBeenCalled();
    expect(used.shown).toHaveLength(0);

    const tabs = harness({
      choice: () => 'delete',
      allTabsLoaded: () => false,
      loadAllTabs: vi.fn(async () => false),
    });
    await tabs.offer(['a']);
    expect(tabs.remove).not.toHaveBeenCalled();

    const failing = harness({
      choice: () => 'delete',
      remove: vi.fn(async () => Promise.reject(new Error('x'))),
    });
    await failing.offer(['a']);
    expect(failing.errors).toEqual(['Couldn’t delete the image from storage. Try again.']);
  });

  it('reads the choice again before the end: a change made meanwhile wins', async () => {
    let choice: 'ask' | 'keep' | 'delete' = 'ask';
    const check = vi.fn(async (ids: string[]) => {
      choice = 'keep';
      return ids;
    });
    const h = harness({ choice: () => choice, check });
    await h.offer(['a']);
    expect(h.shown).toHaveLength(0);
  });

  it('Remember My Choice saves the answer pressed, and only then', async () => {
    const remember = vi.fn();
    const h = harness({ remember });
    await h.offer(['a']);
    const toggle = h.last().toggle!;
    expect(toggle.label).toBe('Remember My Choice');
    expect(toggle.checked).toBeUndefined();
    toggle.onChange(true);
    expect(remember).not.toHaveBeenCalled();
    h.press('Delete from Storage');
    expect(remember).toHaveBeenCalledWith('delete');
    await flush();
    expect(h.remove).toHaveBeenCalledWith('a');

    const k = harness({ remember });
    await k.offer(['b']);
    k.last().toggle!.onChange(true);
    k.press('Keep');
    expect(remember).toHaveBeenLastCalledWith('keep');
    expect(k.remove).not.toHaveBeenCalled();
  });

  it('saves nothing with the switch off, or turned back off', async () => {
    const remember = vi.fn();
    const h = harness({ remember });
    await h.offer(['a']);
    h.press('Keep');
    await h.offer(['b']);
    h.last().toggle!.onChange(true);
    h.last().toggle!.onChange(false);
    h.press('Delete from Storage');
    expect(remember).not.toHaveBeenCalled();
  });
});

describe('the stored choice', () => {
  it('reads Ask unless Delete or Keep is stored, and writes the choice', () => {
    expect(readUnusedImageChoice({})).toBe('ask');
    expect(readUnusedImageChoice({ unusedImageChoice: 'nonsense' })).toBe('ask');
    expect(readUnusedImageChoice({ unusedImageChoice: 'delete' })).toBe('delete');
    expect(readUnusedImageChoice({ unusedImageChoice: 'keep' })).toBe('keep');
    expect(withUnusedImageChoice({ other: 1, unusedImageChoice: 'delete' }, 'keep')).toEqual({
      other: 1,
      unusedImageChoice: 'keep',
    });
  });
});
