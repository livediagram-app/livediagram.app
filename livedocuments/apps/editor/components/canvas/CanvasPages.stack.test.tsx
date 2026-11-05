// @vitest-environment jsdom

// A stacked infographic tab (docs/specs/007-editor/pages-mode.md "Stacked infographics"): the page in front
// alone, the pages after it fanned behind, and its Previous and Next under it, for every role; zen shows the page
// alone.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutPages } from '@livedocuments/document';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { cardStageOf, flashcardStage } from '@/lib/flashcard-stack';
import { CanvasPages } from './CanvasPages';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(() => cleanup());

const row = layOutPages(
  ['a', 'b', 'c', 'd'].map((id) => ({
    id,
    orientation: 'portrait' as const,
    kind: 'infographic' as const,
  })),
);

function staged(front: string, focusPage = vi.fn()) {
  return flashcardStage({
    pages: row,
    cardStage: cardStageOf(row, front)!,
    focusPage,
    setLayoutPreview: vi.fn(),
    themeBackgrounds: [],
    elements: [],
  } as unknown as PagesModeView);
}

describe('an infographic stack on the canvas', () => {
  it('draws the page in front alone, with the pages after it fanned behind', () => {
    render(<CanvasPages view={staged('b')} zoom={1} />);
    expect(
      [...document.querySelectorAll('[data-page-id]')].map((el) => el.getAttribute('data-page-id')),
    ).toEqual(['b']);
    expect(document.querySelectorAll('[data-flashcard-behind]')).toHaveLength(2);
  });

  it("turns from its own Previous and Next, a Viewer's too (no edit on the view)", () => {
    const focusPage = vi.fn();
    render(<CanvasPages view={staged('b', focusPage)} zoom={1} />);
    expect(screen.getByRole('group', { name: 'Page 2 of 4' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(focusPage.mock.calls).toEqual([['c'], ['a']]);
  });

  it("offers no kind choice on a later unchosen page in front: it is not the tab's only page", () => {
    const unchosen = layOutPages(
      ['a', 'b'].map((id) => ({ id, orientation: 'portrait' as const })),
    );
    const view = flashcardStage({
      pages: unchosen,
      cardStage: cardStageOf(unchosen, 'b')!,
      focusPage: vi.fn(),
      setLayoutPreview: vi.fn(),
      themeBackgrounds: [],
      elements: [],
      edit: new Proxy(
        { contentCount: () => 0, applyToAllReach: () => 0, canTidy: () => false },
        { get: (target, key) => (key in target ? target[key as keyof typeof target] : vi.fn()) },
      ),
    } as unknown as PagesModeView);
    render(<CanvasPages view={view} zoom={1} />);
    expect(document.querySelector('[data-first-page-choice]')).toBeNull();
  });

  it('shows no Previous and Next in zen', () => {
    render(<CanvasPages view={staged('a')} zoom={1} bare />);
    expect(document.querySelector('[data-page-stack-nav]')).toBeNull();
  });
});
