// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMPONENT_SAVE_DEBOUNCE_MS, type DesignComponent, type Element } from '@livedesign/design';

const api = {
  load: vi.fn<(...a: unknown[]) => Promise<DesignComponent[]>>(),
  put: vi.fn<(...a: unknown[]) => Promise<DesignComponent>>(),
  patch: vi.fn<(...a: unknown[]) => Promise<DesignComponent>>(),
};
vi.mock('@/lib/api/components', () => ({
  apiLoadComponents: (...a: unknown[]) => api.load(...a),
  apiPutComponent: (...a: unknown[]) => api.put(...a),
  apiPatchComponent: (...a: unknown[]) => api.patch(...a),
}));

import { ApiError } from '@/lib/api/core';
import { componentRegistry } from '@/lib/component-registry';
import { noteStored, useComponentLibrary } from './useComponentLibrary';

const box = (id: string, label = id): Element =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, label });

const main = (over: Partial<DesignComponent> = {}): DesignComponent => ({
  id: 'm',
  name: 'Header',
  width: 10,
  height: 10,
  elements: [box('a'), box('b')],
  updatedAt: 10,
  ...over,
});

const instanceOf = (componentId: string): Element =>
  ({
    id: `i-${componentId}`,
    type: 'shape',
    shape: 'instance',
    componentId,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  });

function setup(elements: Element[] = []) {
  const onSaveError = vi.fn();
  const view = renderHook(
    ({ els }: { els: Element[] }) =>
      useComponentLibrary({
        hydrated: true,
        designId: 'd1',
        ownerId: 'o',
        shareCode: null,
        elements: els,
        onSaveError,
      }),
    { initialProps: { els: elements } },
  );
  return { ...view, onSaveError };
}

beforeEach(() => {
  api.load.mockReset().mockResolvedValue([main()]);
  api.put.mockReset().mockImplementation((...a) => Promise.resolve(a[2] as DesignComponent));
  api.patch.mockReset().mockResolvedValue(main({ updatedAt: 20 }));
});
afterEach(() => vi.useRealTimers());

describe('useComponentLibrary', () => {
  it('loads the library, publishes it to the export registry, and clears it on close', async () => {
    const { result, unmount } = setup();
    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.lookup('m')?.name).toBe('Header');
    expect(componentRegistry()?.get('m')).toBeDefined();
    unmount();
    expect(componentRegistry()).toBeNull();
  });

  it('counts a failed load as loaded, so instances say Missing rather than Loading for ever', async () => {
    api.load.mockRejectedValueOnce(new Error('offline'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.library.size).toBe(0);
    warn.mockRestore();
  });

  it('reads the library again once for an instance naming a main it lacks', async () => {
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    api.load.mockResolvedValue([main(), main({ id: 'n', name: 'Footer' })]);
    rerender({ els: [instanceOf('n')] });
    await waitFor(() => expect(result.current.lookup('n')?.name).toBe('Footer'));
    expect(api.load).toHaveBeenCalledTimes(2);
    rerender({ els: [instanceOf('n'), instanceOf('zzz')] });
    rerender({ els: [instanceOf('zzz')] });
    await waitFor(() => expect(api.load).toHaveBeenCalledTimes(3));
  });

  it('adds a main at once and stores it; a failed store says so', async () => {
    const { result, onSaveError } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(() => result.current.addComponent(main({ id: 'new' })));
    expect(result.current.lookup('new')).toBeDefined();
    expect(api.put).toHaveBeenCalledTimes(1);
    api.put.mockRejectedValueOnce(new Error('down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await act(() => result.current.addComponent(main({ id: 'other' })));
    expect(onSaveError).toHaveBeenCalled();
    // A clipboard's mains: only the missing ones are added.
    act(() => result.current.addMissing([main(), main({ id: 'third' })]));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(3));
    warn.mockRestore();
  });

  it('saves a change after a pause, as a patch of what changed', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    vi.useFakeTimers();
    act(() => result.current.changeComponent(main({ elements: [box('a', 'A1'), box('b')] })));
    act(() => result.current.changeComponent(main({ elements: [box('a', 'A2'), box('b')] })));
    expect(result.current.lookup('m')?.elements[0]).toMatchObject({ label: 'A2' });
    expect(api.patch).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(COMPONENT_SAVE_DEBOUNCE_MS);
    });
    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(api.patch.mock.calls[0]![3]).toEqual({ upsert: [box('a', 'A2')] });
    // No change at all saves nothing.
    act(() => result.current.changeComponent(result.current.lookup('m')!));
    await act(async () => {
      vi.advanceTimersByTime(COMPONENT_SAVE_DEBOUNCE_MS);
    });
    expect(api.patch).toHaveBeenCalledTimes(1);
  });

  it('reads the library again when a save finds the main gone, and says when a save fails', async () => {
    const { result, onSaveError } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();
    api.patch.mockRejectedValueOnce(new ApiError('save component', 404, 'not_found'));
    act(() => result.current.changeComponent(main({ name: 'X' })));
    await act(async () => {
      vi.advanceTimersByTime(COMPONENT_SAVE_DEBOUNCE_MS);
    });
    vi.useRealTimers();
    await waitFor(() => expect(api.load).toHaveBeenCalledTimes(2));
    expect(onSaveError).not.toHaveBeenCalled();
    vi.useFakeTimers();
    api.patch.mockRejectedValueOnce(new Error('down'));
    act(() => result.current.changeComponent(main({ name: 'Y' })));
    await act(async () => {
      vi.advanceTimersByTime(COMPONENT_SAVE_DEBOUNCE_MS);
    });
    vi.useRealTimers();
    await waitFor(() => expect(onSaveError).toHaveBeenCalled());
    warn.mockRestore();
  });

  it('takes a stored main from the room, keeping a change here not saved yet on top', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.changeComponent(main({ elements: [box('a', 'Mine'), box('b')] })));
    act(() =>
      result.current.receiveComponent({
        kind: 'component',
        component: main({ elements: [box('a'), box('b', 'Theirs')], updatedAt: 30 }),
        tabIds: [],
      }),
    );
    expect(
      result.current.lookup('m')?.elements.map((e) => (e as { label?: string }).label),
    ).toEqual(['Mine', 'Theirs']);
    // An older op arriving late is dropped.
    act(() =>
      result.current.receiveComponent({
        kind: 'component',
        component: main({ name: 'Old', updatedAt: 25 }),
        tabIds: [],
      }),
    );
    expect(result.current.lookup('m')?.name).toBe('Header');
    act(() =>
      result.current.receiveComponent({
        kind: 'component',
        component: main({ id: 'fresh', updatedAt: 1 }),
        tabIds: ['t'],
      }),
    );
    expect(result.current.lookup('fresh')).toBeDefined();
  });

  it('saves what is still waiting when the editor closes', async () => {
    const { result, unmount } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.changeComponent(main({ name: 'Closing' })));
    unmount();
    expect(api.patch).toHaveBeenCalledWith(
      'o',
      'd1',
      'm',
      { name: 'Closing' },
      null,
      expect.anything(),
    );
  });
});

describe('noteStored', () => {
  it('keeps only newer versions', () => {
    const stamps = new Map<string, number>();
    expect(noteStored(stamps, main({ updatedAt: 5 }))).toBe(true);
    expect(noteStored(stamps, main({ updatedAt: 5 }))).toBe(false);
    expect(noteStored(stamps, main({ updatedAt: 4 }))).toBe(false);
    expect(noteStored(stamps, main({ updatedAt: 6 }))).toBe(true);
  });
});
