import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { createIntentPrefetcher, INTENT_DELAY_MS, type PrefetchItem } from './intent-prefetch';
import { useIntentPrefetch } from './use-intent-prefetch';

type Load = NonNullable<Parameters<typeof useIntentPrefetch>[2]>;

// The prefetcher's code at once, as a cached chunk would arrive.
const loaded: Load = () => Promise.resolve({ createIntentPrefetcher });

function Root({ prefetch, load = loaded }: { prefetch?: PrefetchItem; load?: Load }) {
  const root = useRef<HTMLDivElement>(null);
  useIntentPrefetch(root, prefetch, load);
  return (
    <div ref={root}>
      <a href="https://www.livediagram.app/document/a">
        <span data-testid="inner">A</span>
      </a>
      <a href="https://www.livediagram.app/document/b">B</a>
      <button type="button">Menu</button>
    </div>
  );
}

const pointer = (type: string, target: Element, pointerType: string, related?: Element) => {
  const e = new MouseEvent(type, { bubbles: true, relatedTarget: related ?? null });
  Object.defineProperty(e, 'pointerType', { value: pointerType });
  act(() => {
    target.dispatchEvent(e);
  });
};

// Lets the prefetcher's code arrive, then the intent delay pass.
const rest = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(INTENT_DELAY_MS);
  });

const A = 'https://www.livediagram.app/document/a';
const B = 'https://www.livediagram.app/document/b';

describe('useIntentPrefetch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('prefetches the link a mouse rests on, and not one it leaves first', async () => {
    const prefetch = vi.fn<PrefetchItem>(() => Promise.resolve());
    const { getByText, getByTestId } = render(<Root prefetch={prefetch} />);
    const a = getByText('A').closest('a')!;
    const b = getByText('B');
    pointer('pointerover', b, 'mouse');
    pointer('pointerout', b, 'mouse');
    // Moving between a link's own children keeps intent.
    pointer('pointerover', getByTestId('inner'), 'mouse');
    pointer('pointerout', getByTestId('inner'), 'mouse', a);
    await rest();
    expect(prefetch.mock.calls).toEqual([[A]]);
    // Once the code is here, intent goes straight to the prefetcher.
    pointer('pointerover', b, 'mouse');
    await rest();
    expect(prefetch.mock.calls).toEqual([[A], [B]]);
    // And leaving a link cancels its wait there too.
    pointer('pointerover', getByTestId('inner'), 'mouse');
    pointer('pointerout', a, 'mouse');
    pointer('pointerover', a.firstChild!.firstChild as unknown as Element, 'mouse');
    await rest();
    expect(prefetch.mock.calls).toEqual([[A], [B]]);
  });

  it('never prefetches for a touch, nor for what is not a link', async () => {
    const prefetch = vi.fn<PrefetchItem>(() => Promise.resolve());
    const load = vi.fn(loaded);
    const { getByText } = render(<Root prefetch={prefetch} load={load} />);
    pointer('pointerover', getByText('A'), 'touch');
    pointer('pointerover', getByText('Menu'), 'mouse');
    pointer('pointerout', getByText('Menu'), 'mouse');
    await rest();
    expect(prefetch).not.toHaveBeenCalled();
    // Nothing that counts as intent, so the prefetcher's code is never fetched.
    expect(load).not.toHaveBeenCalled();
  });

  it('prefetches the link focus reaches, and cancels when focus moves on first', async () => {
    const prefetch = vi.fn<PrefetchItem>(() => Promise.resolve());
    const { getByText } = render(<Root prefetch={prefetch} />);
    act(() => getByText('A').closest('a')!.focus());
    act(() => getByText('Menu').focus());
    act(() => getByText('B').focus());
    await rest();
    expect(prefetch.mock.calls).toEqual([[B]]);
  });

  it('fetches the code once, handing it the latest intent that is still there', async () => {
    let arrive: () => void = () => {};
    const load = vi.fn<Load>(
      () =>
        new Promise((resolve) => {
          arrive = () => resolve({ createIntentPrefetcher });
        }),
    );
    const prefetch = vi.fn<PrefetchItem>(() => Promise.resolve());
    const { getByText } = render(<Root prefetch={prefetch} load={load} />);
    pointer('pointerover', getByText('A'), 'mouse');
    pointer('pointerover', getByText('B'), 'mouse');
    // Leaving a link that is not the latest intent keeps it.
    pointer('pointerout', getByText('A'), 'mouse');
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => arrive());
    await rest();
    expect(prefetch.mock.calls).toEqual([[B]]);
  });

  it('starts nothing when intent left before the code arrived', async () => {
    let arrive: () => void = () => {};
    const load: Load = () =>
      new Promise((resolve) => {
        arrive = () => resolve({ createIntentPrefetcher });
      });
    const prefetch = vi.fn<PrefetchItem>(() => Promise.resolve());
    const { getByText } = render(<Root prefetch={prefetch} load={load} />);
    pointer('pointerover', getByText('B'), 'mouse');
    pointer('pointerout', getByText('B'), 'mouse');
    await act(async () => arrive());
    await rest();
    expect(prefetch).not.toHaveBeenCalled();
  });

  it('tries the code again on the next intent after it failed to load', async () => {
    const load = vi
      .fn<Load>()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockImplementation(loaded);
    const prefetch = vi.fn<PrefetchItem>(() => Promise.resolve());
    const { getByText } = render(<Root prefetch={prefetch} load={load} />);
    pointer('pointerover', getByText('A'), 'mouse');
    await rest();
    expect(prefetch).not.toHaveBeenCalled();
    pointer('pointerover', getByText('B'), 'mouse');
    await rest();
    expect(load).toHaveBeenCalledTimes(2);
    expect(prefetch.mock.calls).toEqual([[B]]);
  });

  it('listens for nothing without a host prefetch, and stops on unmount', async () => {
    const { getByText, unmount } = render(<Root />);
    pointer('pointerover', getByText('B'), 'mouse');
    unmount();
    const prefetch = vi.fn<PrefetchItem>(() => Promise.resolve());
    // Unmounted while the code was on its way.
    const again = render(<Root prefetch={prefetch} />);
    pointer('pointerover', again.getByText('B'), 'mouse');
    again.unmount();
    await rest();
    // Unmounted once the code was here, with a wait running.
    const third = render(<Root prefetch={prefetch} />);
    pointer('pointerover', third.getByText('A'), 'mouse');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    pointer('pointerover', third.getByText('B'), 'mouse');
    third.unmount();
    await rest();
    expect(prefetch.mock.calls).toEqual([]);
  });
});

describe('useIntentPrefetch, loading its code for real', () => {
  it('fetches the prefetcher on the first intent', async () => {
    const prefetch = vi.fn<PrefetchItem>(() => Promise.resolve());
    function RealRoot() {
      const root = useRef<HTMLDivElement>(null);
      useIntentPrefetch(root, prefetch);
      return (
        <div ref={root}>
          <a href={A}>A</a>
        </div>
      );
    }
    const { getByText } = render(<RealRoot />);
    pointer('pointerover', getByText('A'), 'mouse');
    await waitFor(() => expect(prefetch).toHaveBeenCalledWith(A));
  });
});
