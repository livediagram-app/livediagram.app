// @vitest-environment jsdom

// The stat row's change line and count-up (docs/specs/009-elements/stat-row.md): the change edits in place and takes
// its trend's colour, and while the slide is presented the values count up outside React, then land as typed.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyShapeVariant,
  createShape,
  STAT_COUNT_DELAY_MS,
  STAT_COUNT_MS,
  type ShapeElement,
  type WebRows,
} from '@livedocuments/document';
import { PresentingProvider } from '@/components/canvas/PresentingContext';
import { StatRowFace } from './StatRowFace';

afterEach(cleanup);

const big = applyShapeVariant(createShape('stat-row', 0, 0), 'big-number');

function face(element: ShapeElement, opts: { editable?: boolean; presenting?: boolean } = {}) {
  const onSetRows = vi.fn<(rows: WebRows) => void>();
  let renders = 0;
  const view = render(
    <Profiler id="stat" onRender={() => (renders += 1)}>
      <PresentingProvider when={opts.presenting ?? false}>
        <StatRowFace
          element={element}
          labelNode={null}
          accent="#4f46e5"
          fill="#ffffff"
          textColor="#334155"
          fontFamily={undefined}
          editable={opts.editable ?? true}
          onSetRows={onSetRows}
          onSetHeading={vi.fn()}
        />
      </PresentingProvider>
    </Profiler>,
  );
  return { onSetRows, view, renders: () => renders };
}

describe('the change line', () => {
  it('shows the change, coloured by its trend, and edits it in place', () => {
    const { onSetRows, view } = face(big);
    expect(view.container.querySelector('[data-stat-trend="up"]')).not.toBeNull();
    const line = screen.getByRole('textbox', { name: 'Stat 1 change' });
    expect(line.textContent).toBe('▲ 24% on last year');
    fireEvent.focus(line);
    line.textContent = '▼ 3%';
    fireEvent.keyDown(line, { key: 'Enter' });
    fireEvent.blur(line);
    expect(onSetRows).toHaveBeenCalledWith({
      stats: [{ value: '86k', caption: 'Active teams', change: '▼ 3%' }],
    });
  });

  it('a row with no change draws no change line', () => {
    face(createShape('stat-row', 0, 0));
    expect(screen.queryByRole('textbox', { name: /change/ })).toBeNull();
  });
});

describe('the count-up', () => {
  let now = 0;
  let queue: FrameRequestCallback[] = [];
  const step = (ms: number) => {
    now += ms;
    const due = queue;
    queue = [];
    for (const cb of due) cb(now);
  };
  beforeEach(() => {
    now = 0;
    queue = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => queue.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
  });
  afterEach(() => vi.unstubAllGlobals());

  const value = (c: HTMLElement) => c.querySelector('[data-count-up]')?.textContent;

  it('counts from zero to the value while presenting, without rendering React per frame', () => {
    const { view, renders } = face(big, { presenting: true, editable: false });
    const before = renders();
    expect(value(view.container)).toBe('0k');
    act(() => step(16));
    act(() => step(STAT_COUNT_DELAY_MS + STAT_COUNT_MS / 2));
    const mid = Number(value(view.container)!.replace('k', ''));
    expect(mid).toBeGreaterThan(40);
    expect(mid).toBeLessThan(86);
    for (let i = 0; i < 60; i += 1) act(() => step(16));
    act(() => step(STAT_COUNT_MS));
    expect(value(view.container)).toBe('86k');
    // Seventy-odd frames, and React rendered none of them.
    expect(renders()).toBe(before);
    expect(queue).toHaveLength(0);
  });

  it('shows the value at once under reduced motion, when switched off, or while editing', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const reduced = face(big, { presenting: true, editable: false });
    expect(value(reduced.view.container)).toBe('86k');
    cleanup();
    const off = face({ ...big, statCountUp: false }, { presenting: true });
    expect(off.view.container.querySelector('[data-count-up]')).toBeNull();
    cleanup();
    const editing = face(big);
    expect(editing.view.container.querySelector('[data-count-up]')).toBeNull();
  });

  it('lands the value when the slide goes mid-count', () => {
    const { view } = face(big, { presenting: true, editable: false });
    const node = view.container.querySelector('[data-count-up]') as HTMLElement;
    act(() => step(STAT_COUNT_DELAY_MS + 200));
    view.unmount();
    expect(node.textContent).toBe('86k');
  });
});
