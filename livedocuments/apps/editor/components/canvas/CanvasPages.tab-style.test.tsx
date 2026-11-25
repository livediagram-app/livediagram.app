// @vitest-environment jsdom

// Tab Style left the pages' title bars for the Style button by the zoom (docs/specs/011-theme/canvas-and-theme-dialog.md
// "Opening it"); a phone's Appearance sheet still opens it on Design, through the door an Editor's editor registers.
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, newSlidePage } from '@livedocuments/document';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { openTabStyleFrom, registerTabStyleOpen, tabStyleOpener } from '@/lib/tab-style-opener';
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

describe("a page's title bar", () => {
  it('holds no Style: it is by the zoom (ThemeStrip), opened from there for the whole tab', () => {
    undo = registerTabStyleOpen(vi.fn());
    render(<CanvasPages view={view(true)} zoom={1} />);
    expect(styles()).toEqual([]);
  });

  it('opens Tab Style on its Design from the headless opener, for an Editor alone', () => {
    const open = vi.fn();
    undo = registerTabStyleOpen(open);
    openTabStyleFrom(null, 'design');
    expect(open).toHaveBeenCalledWith('design');
    expect(tabStyleOpener()).toBeNull();
    act(() => undo());
    undo = registerTabStyleOpen(null);
    openTabStyleFrom(null, 'design');
    expect(open).toHaveBeenCalledTimes(1);
  });
});
