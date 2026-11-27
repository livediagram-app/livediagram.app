// @vitest-environment jsdom

// Layouts are cut from the fork (docs/specs/002-project-scope/not-in-liveknowledge.md "Cut from the fork",
// "Unreachable, to delete"; Work Tracker 1507): the slide or infographic page a JSON import of a livedocuments tab
// still carries offers no Layout button, so no hover can draw a layout that a press would not place (the press was
// already closed, placing nothing).
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, newSlidePage } from '@liveknowledge/document';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { CanvasPages } from './CanvasPages';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(cleanup);

const edit = new Proxy(
  { contentCount: () => 0, applyToAllReach: () => 0, canTidy: () => false },
  { get: (target, key) => (key in target ? target[key as keyof typeof target] : vi.fn()) },
);

function view(pages: PagesModeView['pages']): PagesModeView {
  return {
    pages,
    elements: [],
    focusPage: vi.fn(),
    setLayoutPreview: vi.fn(),
    themeBackgrounds: [],
    edit,
  } as unknown as PagesModeView;
}

describe('an imported page of a cut kind', () => {
  it('offers an Editor no Layout button on a slide or an infographic page, while its Background stays', () => {
    const pages = layOutPages([
      newSlidePage('s1', 'slide'),
      { ...newSlidePage('i1', 'slide'), kind: 'infographic' },
    ]);
    render(<CanvasPages view={view(pages)} zoom={1} />);
    expect(screen.queryAllByRole('button', { name: 'Background' }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('button', { name: 'Layout' })).toEqual([]);
    expect(document.querySelector('[data-page-layouts-popover]')).toBeNull();
  });
});
