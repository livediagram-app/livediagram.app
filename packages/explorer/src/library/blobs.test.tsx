import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBlobUrl } from './blobs';

// liveworkspace/docs/specs/004-index/one-explorer.md "Cost and performance": a tile's picture waits until the tile
// nears the screen, one observer per tile, attached once and never re-attached on a re-render.

type Fire = (entries: { isIntersecting: boolean }[]) => void;
const made: {
  fire: Fire;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}[] = [];

class FakeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(callback: Fire) {
    made.push({ fire: callback, observe: this.observe, disconnect: this.disconnect });
  }
}

beforeEach(() => {
  made.length = 0;
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  // jsdom has no object URLs.
  Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

function Tile({ load, tick }: { load: () => Promise<Blob | null>; tick: number }) {
  const { ref, state } = useBlobUrl<HTMLDivElement>('k', load);
  return (
    <div ref={ref} data-tick={tick}>
      {state.status}
    </div>
  );
}

describe('useBlobUrl', () => {
  it('keeps one observer through re-renders, and reads the picture once near', async () => {
    const load = vi.fn(() => Promise.resolve(new Blob(['x'])));
    const { rerender, container } = render(<Tile load={load} tick={0} />);
    rerender(<Tile load={load} tick={1} />);
    rerender(<Tile load={load} tick={2} />);
    expect(made).toHaveLength(1);
    expect(made[0]!.disconnect).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    await act(async () => made[0]!.fire([{ isIntersecting: true }]));
    expect(made[0]!.disconnect).toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('ready');
    rerender(<Tile load={load} tick={3} />);
    expect(made).toHaveLength(1);
  });

  it('reads at once where there is no IntersectionObserver', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const load = vi.fn(() => Promise.resolve(null));
    const { container } = render(<Tile load={load} tick={0} />);
    await act(async () => {});
    expect(load).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('broken');
  });
});
