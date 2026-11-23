// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '@liveworkspace/ui/toast';
import { useUnusedImagePrompt, type UseUnusedImagePromptDeps } from './useUnusedImagePrompt';

afterEach(cleanup);

// Each product's docs/specs/009-elements/images.md "Deleting an unused picture": the hook every canvas editor wires.
let offer: (ids: Iterable<string>) => void = () => {};
function Editor(deps: UseUnusedImagePromptDeps) {
  const made = useUnusedImagePrompt(deps);
  useEffect(() => {
    offer = made;
  });
  return null;
}

const deps = (over: Partial<UseUnusedImagePromptDeps> = {}): UseUnusedImagePromptDeps => ({
  enabled: true,
  placed: () => new Set(),
  allTabsLoaded: () => true,
  loadAllTabs: async () => true,
  check: async (ids) => ids,
  remove: async () => {},
  ...over,
});

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

describe('useUnusedImagePrompt', () => {
  it('offers in the page’s toast after a delete, and Delete from Storage deletes', async () => {
    const remove = vi.fn(async () => {});
    render(
      <ToastProvider>
        <Editor {...deps({ remove, allTabsLoaded: () => false })} />
      </ToastProvider>,
    );
    act(() => offer(['img-1']));
    await settle();
    await settle();
    await settle();
    expect(
      screen.getByText(
        'This image isn’t used anywhere else. Delete it from storage? It can’t be undone.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete from Storage: the image' }));
    await settle();
    expect(remove).toHaveBeenCalledWith('img-1');
    expect(screen.getByText('Image deleted from storage')).toBeTruthy();
  });

  // images.md "Remember My Choice" and "The setting".
  it('saves the answer with Remember My Choice on, and Always Keep asks nothing', async () => {
    const remember = vi.fn();
    const check = vi.fn(async (ids: string[]) => ids);
    const { rerender } = render(
      <ToastProvider>
        <Editor {...deps({ remember, check })} />
      </ToastProvider>,
    );
    act(() => offer(['img-1']));
    await settle();
    fireEvent.click(screen.getByRole('switch', { name: 'Remember My Choice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep: leave the image in storage' }));
    expect(remember).toHaveBeenCalledWith('keep');
    rerender(
      <ToastProvider>
        <Editor {...deps({ remember, check, choice: () => 'keep' })} />
      </ToastProvider>,
    );
    check.mockClear();
    act(() => offer(['img-2']));
    await settle();
    expect(check).not.toHaveBeenCalled();
  });

  it('asks nothing while it is off (a Participant, a Viewer, a guest, an Offline item)', async () => {
    const check = vi.fn(async (ids: string[]) => ids);
    const { rerender } = render(
      <ToastProvider>
        <Editor {...deps({ check, enabled: false })} />
      </ToastProvider>,
    );
    act(() => offer(['img-1']));
    await settle();
    expect(check).not.toHaveBeenCalled();
    // The newest deps are read when an offer runs, the same function kept.
    const kept = offer;
    rerender(
      <ToastProvider>
        <Editor {...deps({ check, settle: async () => {} })} />
      </ToastProvider>,
    );
    expect(offer).toBe(kept);
    act(() => offer(['img-1']));
    await settle();
    expect(check).toHaveBeenCalledWith(['img-1']);
  });

  it('closes on Keep and deletes nothing, and reports a failed delete', async () => {
    const remove = vi.fn(async () => Promise.reject(new Error('500')));
    render(
      <ToastProvider>
        <Editor {...deps({ remove })} />
      </ToastProvider>,
    );
    act(() => offer(['a', 'b']));
    await settle();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Keep: leave the 2 images in storage' }));
    expect(remove).not.toHaveBeenCalled();
    act(() => offer(['c']));
    await settle();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Delete from Storage: the image' }));
    await settle();
    expect(screen.getByText('Couldn’t delete the image from storage. Try again.')).toBeTruthy();
  });
});
