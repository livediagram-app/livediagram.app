// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMediaQuery } from './useMediaQuery';

// A matchMedia that counts what it is asked: the lists it builds and the listeners each holds.
function fakeMatchMedia(initial: boolean) {
  const lists: { matches: boolean; listeners: Set<() => void> }[] = [];
  const matchMedia = vi.fn((query: string) => {
    const listeners = new Set<() => void>();
    const list = {
      media: query,
      matches: initial,
      listeners,
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    };
    lists.push(list);
    return list as unknown as MediaQueryList;
  });
  return { matchMedia, lists };
}

function Probe({ query, id }: { query: string; id: string }) {
  return <span data-testid={id}>{String(useMediaQuery(query))}</span>;
}

const original = window.matchMedia;
afterEach(() => {
  window.matchMedia = original;
});

describe('useMediaQuery', () => {
  it('shares one list and one listener among every caller of a query', () => {
    const fake = fakeMatchMedia(false);
    window.matchMedia = fake.matchMedia;
    const many = Array.from({ length: 50 }, (_, i) => (
      <Probe key={i} id={`p${i}`} query="(pointer: coarse)" />
    ));
    const { getByTestId, unmount } = render(<>{many}</>);
    expect(fake.lists).toHaveLength(1);
    expect(fake.lists[0]!.listeners.size).toBe(1);
    expect(getByTestId('p7').textContent).toBe('false');
    // The query starts matching: every caller follows.
    act(() => {
      fake.lists[0]!.matches = true;
      for (const cb of [...fake.lists[0]!.listeners]) cb();
    });
    expect(getByTestId('p7').textContent).toBe('true');
    expect(getByTestId('p49').textContent).toBe('true');
    // The last caller gone, so is the listener.
    unmount();
    expect(fake.lists[0]!.listeners.size).toBe(0);
  });

  it('asks again once nobody listens, and keeps queries apart', () => {
    const fake = fakeMatchMedia(true);
    window.matchMedia = fake.matchMedia;
    const first = render(<Probe id="a" query="(min-width: 1px)" />);
    first.unmount();
    const { getByTestId } = render(
      <>
        <Probe id="b" query="(min-width: 1px)" />
        <Probe id="c" query="(max-width: 1px)" />
      </>,
    );
    expect(fake.lists).toHaveLength(3);
    expect(getByTestId('b').textContent).toBe('true');
  });

  it('reads no match without matchMedia', () => {
    // @ts-expect-error jsdom and old browsers can lack it
    window.matchMedia = undefined;
    const { getByTestId } = render(<Probe id="d" query="(pointer: coarse)" />);
    expect(getByTestId('d').textContent).toBe('false');
  });
});
