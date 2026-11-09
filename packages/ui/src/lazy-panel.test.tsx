// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lazyPanel } from './lazy-panel';

// A panel from its own chunk (lazy-panel.tsx): drawn in the press's own commit once preloaded, after its code lands
// otherwise, and as nothing when its code cannot load.

afterEach(cleanup);

function Hello({ name }: { name: string }) {
  return <p>Hello {name}</p>;
}

describe('lazyPanel', () => {
  it('draws nothing until its code lands, then the panel', async () => {
    const Panel = lazyPanel('hello', () => Promise.resolve(Hello));
    render(<Panel name="Sam" />);
    expect(screen.queryByText('Hello Sam')).toBeNull();
    expect(await screen.findByText('Hello Sam')).toBeTruthy();
  });

  it('draws in its first commit once preloaded, and loads its code once', async () => {
    const load = vi.fn(() => Promise.resolve(Hello));
    const Panel = lazyPanel('hello', load);
    await Panel.preload();
    await Panel.preload();
    render(<Panel name="Ana" />);
    expect(screen.getByText('Hello Ana')).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps a panel mounted through the load it waited for', async () => {
    const Panel = lazyPanel('hello', () => Promise.resolve(Hello));
    const { rerender } = render(<Panel name="Sam" />);
    const first = await screen.findByText('Hello Sam');
    rerender(<Panel name="Sam" />);
    expect(screen.getByText('Hello Sam')).toBe(first);
  });

  it('draws nothing when its code cannot load, and a failed preload tries again', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const load = vi
      .fn<() => Promise<typeof Hello>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'));
    const Panel = lazyPanel('hello', load);
    await expect(Panel.preload()).resolves.toBeUndefined();
    const { container } = render(<Panel name="Sam" />);
    await act(async () => {});
    expect(container.innerHTML).toBe('');
    expect(load).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith('[hello] panel code failed to load', expect.any(Error));
    warn.mockRestore();
  });
});
