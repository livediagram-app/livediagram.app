// @vitest-environment jsdom

// Tab Style on every page's title bar (docs/specs/007-editor/pages-mode.md "Beside the cog";
// docs/specs/011-theme/canvas-and-theme-dialog.md "Opening it"): an Editor's pages each show Style, which opens the
// tab's Style dialog; a Participant or Viewer (no edit on their view, no door registered) sees none.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, newSlidePage } from '@livedocuments/document';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { track } from '@/lib/telemetry';
import { registerTabStyleOpen, tabStyleOpener } from '@/lib/tab-style-opener';
import { CanvasPages } from './CanvasPages';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

let undo = () => {};
afterEach(() => {
  act(() => undo());
  cleanup();
});

const pages = layOutPages([newSlidePage('s1', 'slide'), newSlidePage('s2', 'slide')]);

const edit = new Proxy(
  { contentCount: () => 0, applyToAllReach: () => 0, canTidy: () => false },
  { get: (target, key) => (key in target ? target[key as keyof typeof target] : vi.fn()) },
);

function view(editable: boolean): PagesModeView {
  return {
    pages,
    elements: [],
    focusPage: vi.fn(),
    setLayoutPreview: vi.fn(),
    themeBackgrounds: [],
    ...(editable ? { edit } : {}),
  } as unknown as PagesModeView;
}

const styles = () => screen.queryAllByRole('button', { name: 'Style' });

describe("a page's Style button", () => {
  it("shows on each of an Editor's pages and opens Tab Style from itself", () => {
    const open = vi.fn();
    undo = registerTabStyleOpen(open);
    render(<CanvasPages view={view(true)} zoom={1} />);
    expect(styles()).toHaveLength(2);
    fireEvent.click(styles()[1]!);
    expect(open).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'ThemePicker');
    expect(tabStyleOpener()).toBe(styles()[1]);
  });

  it('is never shown to a Participant or Viewer', () => {
    // Their editor registers no door, and their view has no edit.
    undo = registerTabStyleOpen(null);
    render(<CanvasPages view={view(false)} zoom={1} />);
    expect(styles()).toEqual([]);
    cleanup();
    // Even with a door somehow there, a view without edit shows no title-bar controls.
    act(() => undo());
    undo = registerTabStyleOpen(vi.fn());
    render(<CanvasPages view={view(false)} zoom={1} />);
    expect(styles()).toEqual([]);
  });

  it('is not shown where Tab Style is not offered (an embed)', () => {
    undo = registerTabStyleOpen(null);
    render(<CanvasPages view={view(true)} zoom={1} />);
    expect(styles()).toEqual([]);
  });

  it('comes and goes as the door does', () => {
    render(<CanvasPages view={view(true)} zoom={1} />);
    expect(styles()).toEqual([]);
    act(() => {
      undo = registerTabStyleOpen(vi.fn());
    });
    expect(styles()).toHaveLength(2);
  });
});
