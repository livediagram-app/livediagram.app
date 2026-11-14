// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState, type Context } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PresentingBuild, ShapeElement, Slide, Tab } from '@livedocuments/document';
import { DEFAULT_PRESENTATION_CONFIG } from '@/lib/presentation-config';
import { loadPresentationOverlay } from '@/lib/editor-deferred-code';
import * as editorContext from '@/app/document/[id]/EditorContext';
import { PresentationHost } from './PresentationHost';

const { TestContext } = editorContext as unknown as { TestContext: Context<unknown> };

// docs/specs/012-collaboration/presentation-mode.md "Builds": Next plays a slide's builds before it moves on, Back takes
// them off before it goes back, a slide reached by Back arrives finished, and quick presses all land.
const shape = (id: string, order?: number): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...(order ? { build: { order, effect: 'fade' as const } } : {}),
});
const tab: Tab = {
  id: 't',
  name: 't',
  elements: [
    shape('title'),
    shape('a', 1),
    shape('b', 2),
    shape('c', 3),
    shape('x', 1),
    shape('y', 5),
  ],
};
const slide = (id: string, elementIds: string[]): Slide => ({ id, tabId: 't', elementIds });
// Three builds, none, then two.
const runnable = [
  { slide: slide('s1', ['title', 'a', 'b', 'c']), tab, index: 0 },
  { slide: slide('s2', ['title']), tab, index: 1 },
  { slide: slide('s3', ['x', 'y']), tab, index: 2 },
];

// The editor's context, handed in by the harness below through a context of the test's own.
vi.mock('@/app/document/[id]/EditorContext', async () => {
  const { createContext, useContext } = await import('react');
  const TestContext = createContext<unknown>(null);
  return { TestContext, useEditorContext: () => useContext(TestContext) };
});
vi.mock('@liveworkspace/workbench/components/canvas/CanvasSurfaceContext', () => ({
  useCanvasSurface: () => 'light',
}));
vi.mock('@/components/canvas/PresentationOverlay', () => ({
  PresentationOverlay: ({
    at,
    build,
    onGo,
  }: {
    at: number;
    build: { shown: number; count: number };
    onGo: (next: number, step?: 1 | -1) => void;
  }) => (
    <div>
      <output>{`${at}:${build.shown}/${build.count}`}</output>
      <button onClick={() => onGo(at + 1, 1)}>Next</button>
      <button onClick={() => onGo(at - 1, -1)}>Back</button>
      <button onClick={() => onGo(2)}>Jump</button>
    </div>
  ),
}));
// While `held`, the deck's updates queue in order and commit together later, as React holds a transition while a
// View Transition runs: presses land on a slide still on its way.
const held = vi.hoisted(() => ({ on: false, queue: [] as (() => void)[] }));
vi.mock('@liveworkspace/workbench/lib/view-transition', () => ({
  startTypedTransition: (_type: string, change: () => void) => change(),
}));
const lagged =
  <T,>(set: (v: T) => void) =>
  (v: T) => {
    if (held.on) held.queue.push(() => set(v));
    else set(v);
  };
vi.mock('@liveworkspace/workbench/components/canvas/slide-transition', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@liveworkspace/workbench/components/canvas/slide-transition')
  >()),
  whenScreenSettles: () => () => {},
}));

function Harness({ start = 0 }: { start?: number }) {
  const [at, setAt] = useState<number | null>(start);
  const [build, setBuild] = useState<PresentingBuild | null>(null);
  const ctx = {
    slideDeck: {
      presentingAt: at,
      runnable,
      config: DEFAULT_PRESENTATION_CONFIG,
      setPresentingAt: lagged(setAt),
      presentingBuild: build,
      setPresentingBuild: lagged(setBuild),
      exitPresentation: () => setAt(null),
      updateConfig: vi.fn(),
    },
    canvasTool: 'select',
    setCanvasTool: vi.fn(),
  };
  return (
    <TestContext.Provider value={ctx}>
      <PresentationHost />
    </TestContext.Provider>
  );
}

beforeAll(async () => {
  await loadPresentationOverlay();
});
afterEach(() => {
  cleanup();
  held.on = false;
  held.queue = [];
});

const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const where = () => screen.getByRole('status').textContent;

describe('PresentationHost builds', () => {
  it('presents a slide with three builds in four steps, then moves on', () => {
    render(<Harness />);
    const seen = [where()];
    for (let i = 0; i < 4; i++) {
      press('Next');
      seen.push(where());
    }
    expect(seen).toEqual(['0:0/3', '0:1/3', '0:2/3', '0:3/3', '1:0/0']);
  });

  it('goes back onto a slide finished, then takes its builds off in four steps', () => {
    render(<Harness start={1} />);
    const seen = [where()];
    for (let i = 0; i < 4; i++) {
      press('Back');
      seen.push(where());
    }
    expect(seen).toEqual(['1:0/0', '0:3/3', '0:2/3', '0:1/3', '0:0/3']);
  });

  it('arrives unbuilt from a jump', () => {
    render(<Harness />);
    press('Next');
    press('Jump');
    expect(where()).toBe('2:0/2');
  });

  it('counts quick presses from the slide and build last asked for', () => {
    render(<Harness start={1} />);
    held.on = true;
    // To s3 (on its way), then its first build rides that move.
    press('Next');
    press('Next');
    expect(where()).toBe('1:0/0');
    held.on = false;
    act(() => held.queue.splice(0).forEach((change) => change()));
    expect(where()).toBe('2:1/2');
  });
});
