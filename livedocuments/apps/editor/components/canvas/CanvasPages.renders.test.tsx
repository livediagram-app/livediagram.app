// @vitest-environment jsdom

// A render of the pages re-renders only the pages it changed (docs/specs/008-canvas/canvas-performance.md): the
// editor hands CanvasPages a new view on every render (new edits, new closures), and a pause in typing is one such
// render. Every page's sheet keeps its props then, so none of their title bars renders again; a change to one
// page (its cog opened) renders that page's alone.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { layOutPages, newSlidePage } from '@livedocuments/document';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { CanvasPages } from './CanvasPages';

const renders = vi.hoisted(() => {
  const counts = { titleBars: 0 };
  return { counts, bump: () => void counts.titleBars++ };
});

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@liveworkspace/workbench/components/canvas/PageTitleBar', async (importOriginal) => {
  const real =
    await importOriginal<
      typeof import('@liveworkspace/workbench/components/canvas/PageTitleBar')
    >();
  const Counted = (props: ComponentProps<typeof real.PageTitleBar>) => {
    renders.bump();
    return <real.PageTitleBar {...props} />;
  };
  return { ...real, PageTitleBar: Counted };
});

afterEach(() => cleanup());

const PAGES = 12;
const pages = layOutPages(Array.from({ length: PAGES }, (_, i) => newSlidePage(`s${i}`, 'slide')));
const themeBackgrounds: PagesModeView['themeBackgrounds'] = [];
const elements: NonNullable<PagesModeView['elements']> = [];

// What the editor builds on every render: a fresh view, fresh edits and fresh closures over the same pages.
function view(): PagesModeView {
  const edit = new Proxy(
    { contentCount: () => 1, applyToAllReach: () => 0, canTidy: () => false },
    { get: (target, key) => (key in target ? target[key as keyof typeof target] : vi.fn()) },
  );
  return {
    pages,
    elements,
    focusPage: vi.fn(),
    setLayoutPreview: vi.fn(),
    layoutPreview: null,
    themeBackgrounds,
    themeAccent: '#2563eb',
    edit,
  } as unknown as PagesModeView;
}

describe('a render of the pages', () => {
  it('re-renders no page whose props held, however new the view', () => {
    const { rerender } = render(<CanvasPages view={view()} zoom={1} />);
    expect(renders.counts.titleBars).toBe(PAGES);
    renders.counts.titleBars = 0;
    for (let i = 0; i < 5; i++) rerender(<CanvasPages view={view()} zoom={1} />);
    expect(renders.counts.titleBars).toBe(0);
  });

  it("re-renders the one page that changed: its cog's panel opened", () => {
    render(<CanvasPages view={view()} zoom={1} />);
    renders.counts.titleBars = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Page 3 settings' }));
    expect(renders.counts.titleBars).toBe(1);
  });

  it('re-renders every page for what every page shows (a zoom)', () => {
    const { rerender } = render(<CanvasPages view={view()} zoom={1} />);
    renders.counts.titleBars = 0;
    rerender(<CanvasPages view={view()} zoom={0.5} />);
    expect(renders.counts.titleBars).toBe(PAGES);
  });
});
