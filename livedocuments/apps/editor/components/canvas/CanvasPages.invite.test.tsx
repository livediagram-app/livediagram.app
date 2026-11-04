// @vitest-environment jsdom

// An empty page's Use a Layout invite (docs/specs/007-editor/pages-mode.md "An empty page offers a layout,
// quietly"): an Editor's empty slide shows it, a press opens the page's title-bar Layouts popover; a page with
// something on it, or a session that may not edit (a Participant or Viewer, whose view has no edit), shows none.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, newSlidePage, type Element } from '@livedocuments/document';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { track } from '@/lib/telemetry';
import { CanvasPages } from './CanvasPages';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(() => cleanup());

const pages = layOutPages([newSlidePage('s1', 'slide'), newSlidePage('s2', 'slide')]);
const onSecond = {
  id: 'box',
  type: 'shape',
  shape: 'rectangle',
  x: pages[1]!.rect.x + 100,
  y: pages[1]!.rect.y + 100,
  width: 200,
  height: 100,
} as unknown as Element;

const edit = new Proxy(
  { contentCount: () => 0, applyToAllReach: () => 0, canTidy: () => false },
  { get: (target, key) => (key in target ? target[key as keyof typeof target] : vi.fn()) },
);

function view(editable: boolean): PagesModeView {
  return {
    pages,
    elements: [onSecond],
    focusPage: vi.fn(),
    setLayoutPreview: vi.fn(),
    themeBackgrounds: [],
    ...(editable ? { edit } : {}),
  } as unknown as PagesModeView;
}

const invites = () => [...document.querySelectorAll('[data-empty-page-invite]')];

describe('the Use a Layout invite', () => {
  it("shows on an Editor's empty page alone, and opens its Layouts popover", () => {
    render(<CanvasPages view={view(true)} zoom={1} />);
    expect(invites().map((el) => el.getAttribute('data-empty-page-invite'))).toEqual(['s1']);
    fireEvent.click(screen.getByRole('button', { name: 'Use a Layout' }));
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'EmptyPageInvite');
    expect(document.querySelector('[data-page-layouts-popover]')).not.toBeNull();
    // The gallery is in hand: the invite steps aside until it closes.
    expect(invites()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(invites().map((el) => el.getAttribute('data-empty-page-invite'))).toEqual(['s1']);
  });

  it('steps aside while a palette tool is armed, and in zen', () => {
    render(<CanvasPages view={view(true)} zoom={1} placing />);
    expect(invites()).toEqual([]);
    cleanup();
    render(<CanvasPages view={view(true)} zoom={1} bare />);
    expect(invites()).toEqual([]);
  });

  it('is never shown to a Participant or Viewer (no edit on their view)', () => {
    render(<CanvasPages view={view(false)} zoom={1} />);
    expect(invites()).toEqual([]);
  });
});
