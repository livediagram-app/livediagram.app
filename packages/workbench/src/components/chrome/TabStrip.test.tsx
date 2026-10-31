// @vitest-environment jsdom

// The footer's tab strip (docs/specs/007-editor/editor-app.md "Tab bar"; docs/specs/006-document/tab-folders.md "Tab
// bar rendering"): a tablist of tabs and folder chips, folders opening in place this visit only, the arrow keys
// moving between what is showing, and the open tab kept in view.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLLAPSE_WIDTH_MS } from '../primitives/CollapseWidth';
import { TabFrame } from './TabFrame';
import { TabStrip, type TabRun, type TabStripProps } from './TabStrip';

type T = { id: string; name: string };
const t = (id: string, name = id): T => ({ id, name });
const RUNS: TabRun<T>[] = [
  { kind: 'loose', tab: t('o', 'Overview') },
  { kind: 'folder', name: 'Planning', tabs: [t('r', 'Roadmap'), t('q', 'Q1 Goals')] },
  { kind: 'loose', tab: t('b', 'Backlog') },
];

let scrollTo: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
  );
  scrollTo = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { value: scrollTo, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function strip(over: Partial<TabStripProps<T>> = {}) {
  const props: TabStripProps<T> = {
    runs: RUNS,
    activeId: 'o',
    readOnly: false,
    renderTab: (tab) => (
      <TabFrame
        key={tab.id}
        id={tab.id}
        name={tab.name}
        active={tab.id === (over.activeId ?? 'o')}
        readOnly={false}
        onSelect={() => props.onReorder('select', tab.id)}
      />
    ),
    onAdd: vi.fn(),
    onReorder: vi.fn(),
    onRenameFolder: vi.fn(),
    renderRenameField: ({ initial, onCommit }) => (
      <input
        aria-label="Folder name"
        defaultValue={initial}
        onKeyDown={(e) => e.key === 'Enter' && onCommit(e.currentTarget.value)}
      />
    ),
    ...over,
  };
  return { props, ...render(<TabStrip {...props} />) };
}

const chip = () => screen.getByRole('tab', { name: /^Planning,/ });
const tabNamed = (name: string) => screen.getByRole('tab', { name });
const visibleTabs = () =>
  screen
    .getAllByRole('tab', { hidden: true })
    .filter((el) => !el.closest('[inert]'))
    .map((el) => el.getAttribute('aria-label') ?? el.textContent);

describe('TabStrip', () => {
  it('is a tablist of tabs and folder chips, with Add tab after it', () => {
    strip();
    const list = screen.getByRole('tablist', { name: 'Tabs' });
    expect(list.getAttribute('aria-orientation')).toBe('horizontal');
    expect(visibleTabs()).toEqual(['Overview', 'Planning, 2 tabs', 'Backlog']);
    expect(screen.getByRole('button', { name: 'Add tab' })).toBeTruthy();
  });

  it('lays the open tab’s sliding card first in the tablist, hidden from assistive technology', () => {
    strip();
    const list = screen.getByRole('tablist', { name: 'Tabs' });
    const card = list.firstElementChild as HTMLElement;
    expect(card.hasAttribute('data-tab-slider')).toBe(true);
    expect(card.getAttribute('aria-hidden')).toBe('true');
    // Shown and placed (jsdom measures nothing, so at the origin), each tab's own card stands down.
    expect(card.style.opacity).toBe('1');
    expect(list.hasAttribute('data-tab-slide')).toBe(true);
  });

  it('has no Add tab for a Viewer', () => {
    strip({ readOnly: true });
    expect(screen.queryByRole('button', { name: 'Add tab' })).toBeNull();
  });

  it('opens a folder in place on a click of its chip, and shuts it again', () => {
    strip();
    fireEvent.click(chip());
    expect(chip().getAttribute('aria-expanded')).toBe('true');
    expect(visibleTabs()).toEqual([
      'Overview',
      'Planning, 2 tabs',
      'Roadmap',
      'Q1 Goals',
      'Backlog',
    ]);
    fireEvent.click(chip());
    expect(chip().getAttribute('aria-expanded')).toBe('false');
    expect(visibleTabs()).toEqual(['Overview', 'Planning, 2 tabs', 'Backlog']);
  });

  it('keeps a folder open across a change of tab, and open under its new name', () => {
    const { props, rerender } = strip();
    fireEvent.click(chip());
    rerender(<TabStrip {...props} activeId="b" />);
    expect(chip().getAttribute('aria-expanded')).toBe('true');
    fireEvent.doubleClick(chip());
    const field = screen.getByRole('textbox', { name: 'Folder name' }) as HTMLInputElement;
    field.value = 'Plans';
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(props.onRenameFolder).toHaveBeenCalledWith('Planning', 'Plans');
    rerender(
      <TabStrip
        {...props}
        activeId="b"
        runs={[
          RUNS[0]!,
          { kind: 'folder', name: 'Plans', tabs: [t('r', 'Roadmap'), t('q', 'Q1 Goals')] },
          RUNS[2]!,
        ]}
      />,
    );
    expect(screen.getByRole('tab', { name: /^Plans,/ }).getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps a shut folder shut under its new name', () => {
    const { props, rerender } = strip();
    fireEvent.doubleClick(chip());
    const field = screen.getByRole('textbox', { name: 'Folder name' }) as HTMLInputElement;
    field.value = 'Plans';
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(props.onRenameFolder).toHaveBeenCalledWith('Planning', 'Plans');
    rerender(
      <TabStrip
        {...props}
        runs={[
          RUNS[0]!,
          { kind: 'folder', name: 'Plans', tabs: [t('r', 'Roadmap'), t('q', 'Q1 Goals')] },
          RUNS[2]!,
        ]}
      />,
    );
    expect(screen.getByRole('tab', { name: /^Plans,/ }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('moves focus with the arrows across tabs and chips, skipping tucked-away tabs, and Home and End', () => {
    strip();
    const overview = tabNamed('Overview');
    overview.focus();
    fireEvent.keyDown(overview, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(chip());
    fireEvent.keyDown(chip(), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabNamed('Backlog'));
    fireEvent.keyDown(tabNamed('Backlog'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabNamed('Backlog'));
    fireEvent.keyDown(tabNamed('Backlog'), { key: 'Home' });
    expect(document.activeElement).toBe(overview);
    fireEvent.keyDown(overview, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(overview);
    fireEvent.keyDown(overview, { key: 'End' });
    expect(document.activeElement).toBe(tabNamed('Backlog'));
    // Opened, the folder's tabs join the order.
    fireEvent.click(chip());
    chip().focus();
    fireEvent.keyDown(chip(), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabNamed('Roadmap'));
  });

  it('leaves other keys, and keys from elsewhere in a tab, alone', () => {
    strip();
    const overview = tabNamed('Overview');
    overview.focus();
    fireEvent.keyDown(overview, { key: 'a' });
    expect(document.activeElement).toBe(overview);
    const list = screen.getByRole('tablist');
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(overview);
  });

  it('brings the open tab into view, and a tap on it brings it in again', () => {
    const { container } = strip();
    expect(scrollTo).not.toHaveBeenCalled();
    const scroller = screen.getByRole('tablist').parentElement as HTMLElement;
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 100,
      width: 100,
    } as DOMRect);
    const open = container.querySelector('[data-tab][data-active]') as HTMLElement;
    vi.spyOn(open, 'getBoundingClientRect').mockReturnValue({ left: 60, right: 140 } as DOMRect);
    fireEvent.click(tabNamed('Overview'));
    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ left: 68, behavior: 'smooth' }),
    );
    // A tap elsewhere does not.
    scrollTo.mockClear();
    fireEvent.click(chip());
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('brings Add tab into view with the last tab', () => {
    const { container, props, rerender } = strip();
    const scroller = screen.getByRole('tablist').parentElement as HTMLElement;
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 200,
      width: 200,
    } as DOMRect);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this === scroller) return { left: 0, right: 200, width: 200 } as DOMRect;
      if (this.dataset.tourId === 'add-tab') return { left: 190, right: 230 } as DOMRect;
      return { left: 150, right: 190 } as DOMRect;
    });
    const last: TabStripProps<T> = {
      ...props,
      activeId: 'b',
      renderTab: (tab) => (
        <TabFrame
          key={tab.id}
          id={tab.id}
          name={tab.name}
          active={tab.id === 'b'}
          readOnly={false}
          onSelect={vi.fn()}
        />
      ),
    };
    rerender(<TabStrip {...last} />);
    expect(container).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 58 }));
  });

  it('jumps rather than glides under reduced motion', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    const { container } = strip();
    const scroller = screen.getByRole('tablist').parentElement as HTMLElement;
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 100,
      width: 100,
    } as DOMRect);
    vi.spyOn(
      container.querySelector('[data-tab][data-active]') as HTMLElement,
      'getBoundingClientRect',
    ).mockReturnValue({
      left: 60,
      right: 140,
    } as DOMRect);
    fireEvent.click(tabNamed('Overview'));
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
  });

  it('brings an opened folder into view, chip first when it is wider than the strip', () => {
    const { container } = strip();
    const scroller = screen.getByRole('tablist').parentElement as HTMLElement;
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 300,
      width: 300,
    } as DOMRect);
    const group = container.querySelector('[data-tab-folder]') as HTMLElement;
    vi.spyOn(group, 'getBoundingClientRect').mockReturnValue({ left: 250, right: 900 } as DOMRect);
    fireEvent.click(chip());
    act(() => {
      vi.advanceTimersByTime(COLLAPSE_WIDTH_MS + 20);
    });
    // Shows from the chip: 250 to 250 + (300 - 56), past the right edge's pad.
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 222 }));
  });

  it('joins a tab dropped on a chip at the head of the folder', () => {
    const { props } = strip();
    fireEvent.drop(chip(), { dataTransfer: { getData: () => 'b' } });
    expect(props.onReorder).toHaveBeenCalledWith('b', 'r');
  });

  it('calls Add tab', () => {
    const { props } = strip();
    fireEvent.click(screen.getByRole('button', { name: 'Add tab' }));
    expect(props.onAdd).toHaveBeenCalledOnce();
  });
});
