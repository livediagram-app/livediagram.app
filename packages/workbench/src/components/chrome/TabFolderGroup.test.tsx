// @vitest-environment jsdom

// One tab folder in the strip (docs/specs/006-document/tab-folders.md "Tab bar rendering"): the chip opens and shuts
// its tabs in place, the open tab never tucks away, a drop on the chip joins the folder, a resting drag springs it
// open, a double-click renames it, and nothing is a popover.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLLAPSE_WIDTH_MS } from '../primitives/CollapseWidth';
import { SPRING_OPEN_MS, TabFolderGroup, type TabFolderGroupProps } from './TabFolderGroup';

type T = { id: string; name: string };
const TABS: T[] = [
  { id: 'a', name: 'Roadmap' },
  { id: 'b', name: 'Q1 Goals' },
  { id: 'c', name: 'Q2 Goals' },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const props = (over: Partial<TabFolderGroupProps<T>> = {}): TabFolderGroupProps<T> => ({
  name: 'Planning',
  tabs: TABS,
  activeId: 'z',
  expanded: false,
  readOnly: false,
  onToggle: vi.fn(),
  renderTab: (t) => (
    <button type="button" role="tab" data-tab-key="">
      {t.name}
    </button>
  ),
  onJoin: vi.fn(),
  onRename: vi.fn(),
  renderRenameField: ({ initial, onCommit, onCancel }) => (
    <input
      aria-label="Folder name"
      defaultValue={initial}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(e.currentTarget.value);
        if (e.key === 'Escape') onCancel();
      }}
    />
  ),
  ...over,
});

const chip = () => screen.getByRole('tab', { name: /^Planning,/ });
const shown = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('[data-tab-folder] > [data-collapse-width="open"]')).map(
    (el) => el.textContent,
  );
const count = () => chip().querySelector('[data-folder-count]') as HTMLElement;

describe('TabFolderGroup', () => {
  it('names the chip with its count, collapsed, and tucks every tab away', () => {
    const { container } = render(<TabFolderGroup {...props()} />);
    expect(chip().getAttribute('aria-expanded')).toBe('false');
    expect(chip().getAttribute('aria-label')).toBe('Planning, 3 tabs');
    expect(count().textContent).toBe('3');
    // No chevron: the chip is a folder glyph, the name and the count.
    expect(chip().querySelectorAll('svg')).toHaveLength(1);
    expect(shown(container)).toEqual([]);
    expect(container.querySelectorAll('[data-tab-folder] > [inert]')).toHaveLength(3);
    // No popover, ever.
    expect(document.querySelector('[data-tab-folder-fan]')).toBeNull();
  });

  it('counts one tab in the singular', () => {
    render(<TabFolderGroup {...props({ tabs: [TABS[0]!] })} />);
    expect(chip().getAttribute('aria-label')).toBe('Planning, 1 tab');
  });

  it('opens its tabs inline after the chip, in order, keeping its count', () => {
    const { container } = render(<TabFolderGroup {...props({ expanded: true })} />);
    expect(chip().getAttribute('aria-expanded')).toBe('true');
    expect(shown(container)).toEqual(['Roadmap', 'Q1 Goals', 'Q2 Goals']);
    expect(count().textContent).toBe('3');
    expect(container.querySelector('[data-tab-folder]')?.hasAttribute('data-expanded')).toBe(true);
  });

  it('keeps the open tab beside the chip while collapsed, on the shelf', () => {
    const { container } = render(<TabFolderGroup {...props({ activeId: 'b' })} />);
    expect(shown(container)).toEqual(['Q1 Goals']);
  });

  it('stands on its shelf open or shut, holding the open tab or not', () => {
    for (const over of [{}, { activeId: 'b' }, { expanded: true }]) {
      const { container, unmount } = render(<TabFolderGroup {...props(over)} />);
      const group = container.querySelector('[data-tab-folder]') as HTMLElement;
      expect(group.className).toMatch(/before:bg-/);
      expect(group.className).not.toMatch(/before:opacity-0/);
      unmount();
    }
  });

  it('says what a click and a double-click do in its hover card', () => {
    const { rerender } = render(<TabFolderGroup {...props()} />);
    fireEvent.pointerEnter(chip());
    fireEvent.mouseEnter(chip());
    fireEvent.focus(chip());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(document.body.textContent).toMatch(
      /3 tabs\. Click to show them here, double-click to rename\./,
    );
    rerender(<TabFolderGroup {...props({ expanded: true, readOnly: true })} />);
    expect(document.body.textContent).toMatch(/3 tabs\. Click to tuck them away\./);
  });

  it('colours itself from its name', () => {
    const { container } = render(<TabFolderGroup {...props()} />);
    const group = container.querySelector('[data-tab-folder]') as HTMLElement;
    expect(group.style.getPropertyValue('--tf')).toMatch(/^#/);
    expect(group.style.getPropertyValue('--tfd')).toMatch(/^#/);
  });

  it('toggles on a click of the chip', () => {
    const onToggle = vi.fn();
    render(<TabFolderGroup {...props({ onToggle })} />);
    fireEvent.click(chip());
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('shows who is on its tucked-away tabs, and nobody once it is open', () => {
    const hiddenPresence = vi.fn((ids: string[]) => <span data-testid="who">{ids.join(',')}</span>);
    const { rerender } = render(<TabFolderGroup {...props({ activeId: 'b', hiddenPresence })} />);
    expect(screen.getByTestId('who').textContent).toBe('a,c');
    rerender(<TabFolderGroup {...props({ activeId: 'b', expanded: true, hiddenPresence })} />);
    expect(screen.queryByTestId('who')).toBeNull();
  });

  it('brings itself into view once it has opened', () => {
    const onOpened = vi.fn();
    const { rerender } = render(<TabFolderGroup {...props({ onOpened })} />);
    rerender(<TabFolderGroup {...props({ expanded: true, onOpened })} />);
    expect(onOpened).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(COLLAPSE_WIDTH_MS + 20);
    });
    expect(onOpened).toHaveBeenCalledOnce();
    // Closing does not.
    rerender(<TabFolderGroup {...props({ expanded: false, onOpened })} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onOpened).toHaveBeenCalledOnce();
  });

  it('asks the strip to show the open tab once it has shut', () => {
    const onClosed = vi.fn();
    const { rerender } = render(<TabFolderGroup {...props({ expanded: true, onClosed })} />);
    // Mounting open is no closing.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onClosed).not.toHaveBeenCalled();
    rerender(<TabFolderGroup {...props({ expanded: false, onClosed })} />);
    expect(onClosed).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(COLLAPSE_WIDTH_MS + 20);
    });
    expect(onClosed).toHaveBeenCalledOnce();
    // Opening again does not, and neither callback is needed.
    rerender(<TabFolderGroup {...props({ expanded: true, onClosed })} />);
    rerender(<TabFolderGroup {...props({ expanded: false })} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onClosed).toHaveBeenCalledOnce();
  });

  it('joins a tab dropped on the chip at the folder’s head', () => {
    const onJoin = vi.fn();
    render(<TabFolderGroup {...props({ onJoin })} />);
    const data = { getData: () => 'x', dropEffect: '' };
    fireEvent.dragOver(chip(), { dataTransfer: data });
    expect(chip().className).toMatch(/outline-brand-500/);
    fireEvent.drop(chip(), { dataTransfer: data });
    expect(onJoin).toHaveBeenCalledWith('x', 'a');
    // Its own first tab dropped on it is no move.
    fireEvent.drop(chip(), { dataTransfer: { getData: () => 'a' } });
    expect(onJoin).toHaveBeenCalledOnce();
  });

  it('springs open when a dragged tab rests on the collapsed chip, not when it passes over', () => {
    const onToggle = vi.fn();
    render(<TabFolderGroup {...props({ onToggle })} />);
    fireEvent.dragEnter(chip());
    fireEvent.dragLeave(chip());
    act(() => {
      vi.advanceTimersByTime(SPRING_OPEN_MS + 10);
    });
    expect(onToggle).not.toHaveBeenCalled();
    fireEvent.dragEnter(chip());
    fireEvent.dragEnter(chip());
    act(() => {
      vi.advanceTimersByTime(SPRING_OPEN_MS + 10);
    });
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('takes no drops and never renames for a Viewer', () => {
    const onJoin = vi.fn();
    render(<TabFolderGroup {...props({ readOnly: true, onJoin })} />);
    fireEvent.drop(chip(), { dataTransfer: { getData: () => 'x' } });
    fireEvent.doubleClick(chip());
    expect(onJoin).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('renames on a double-click, ignoring an unchanged or empty name', () => {
    const onRename = vi.fn();
    render(<TabFolderGroup {...props({ onRename })} />);
    fireEvent.doubleClick(chip());
    const field = screen.getByRole('textbox', { name: 'Folder name' }) as HTMLInputElement;
    field.value = '  Plans  ';
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('Planning', 'Plans');
    fireEvent.doubleClick(chip());
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    fireEvent.doubleClick(chip());
    screen.getByRole<HTMLInputElement>('textbox').value = ' ';
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    fireEvent.doubleClick(chip());
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(onRename).toHaveBeenCalledOnce();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('keeps clear of the tab or folder beside it: a margin each side, none doubled between two folders', () => {
    const { container } = render(<TabFolderGroup {...props()} />);
    const cls = (container.querySelector('[data-tab-folder]') as HTMLElement).className;
    expect(cls).toContain('mx-1');
    expect(cls).toContain('[[data-tab-folder]+&]:ml-0');
  });
});
