// @vitest-environment jsdom

// What appears at once (docs/specs/008-canvas/canvas-and-palette.md "Motion and animations"): the
// board a tab opens with, and a burst of more than ARRIVAL_BURST elements landing in one commit.
import { cleanup, render } from '@testing-library/react';
import { memo } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ARRIVAL_BURST, CanvasArrivalProvider, useArrivesWithBoard } from './CanvasArrivalContext';

afterEach(cleanup);

const seen = new Map<string, boolean>();
let renders = 0;

const Item = memo(function Item({ id }: { id: string }) {
  renders++;
  const arrives = useArrivesWithBoard();
  if (!seen.has(id)) seen.set(id, arrives);
  return null;
});

const ids = (from: number, n: number) => Array.from({ length: n }, (_, i) => `e${from + i}`);

function Board({
  tabId,
  list,
  counted = true,
}: {
  tabId: string;
  list: string[];
  counted?: boolean;
}) {
  return (
    <CanvasArrivalProvider tabId={tabId} count={counted ? list.length : undefined}>
      {list.map((id) => (
        <Item key={id} id={id} />
      ))}
    </CanvasArrivalProvider>
  );
}

describe('CanvasArrivalProvider', () => {
  it('lets the board a tab opens with arrive, and pops a handful added later', () => {
    seen.clear();
    const first = ids(0, 5);
    const { rerender } = render(<Board tabId="t" list={first} />);
    expect([...seen.values()].every(Boolean)).toBe(true);
    rerender(<Board tabId="t" list={[...first, ...ids(5, 3)]} />);
    expect(seen.get('e5')).toBe(false);
    expect(seen.get('e7')).toBe(false);
  });

  it('lets a burst of more than ARRIVAL_BURST elements arrive at once, and pops exactly ARRIVAL_BURST', () => {
    seen.clear();
    const first = ids(0, 10);
    const { rerender } = render(<Board tabId="t" list={first} />);
    const atLimit = [...first, ...ids(10, ARRIVAL_BURST)];
    rerender(<Board tabId="t" list={atLimit} />);
    expect(seen.get('e10')).toBe(false);
    const burst = [...atLimit, ...ids(100, ARRIVAL_BURST + 1)];
    rerender(<Board tabId="t" list={burst} />);
    expect(ids(100, ARRIVAL_BURST + 1).every((id) => seen.get(id) === true)).toBe(true);
    // The burst is over once it commits: the next single addition pops again.
    rerender(<Board tabId="t" list={[...burst, 'late']} />);
    expect(seen.get('late')).toBe(false);
  });

  it('counts nothing as a burst without a count', () => {
    seen.clear();
    const first = ids(0, 2);
    const { rerender } = render(<Board tabId="t" list={first} counted={false} />);
    rerender(<Board tabId="t" list={[...first, ...ids(2, 60)]} counted={false} />);
    expect(seen.get('e2')).toBe(false);
  });

  it('renders no element view for a burst', () => {
    seen.clear();
    const first = ids(0, 4);
    const { rerender } = render(<Board tabId="t" list={first} />);
    renders = 0;
    rerender(<Board tabId="t" list={[...first, ...ids(4, 40)]} />);
    // Only the 40 new views render: the context value kept its identity, so the memoised four did not.
    expect(renders).toBe(40);
  });

  it('reads every element as an addition outside a provider', () => {
    seen.clear();
    render(<Item id="alone" />);
    expect(seen.get('alone')).toBe(false);
  });
});
