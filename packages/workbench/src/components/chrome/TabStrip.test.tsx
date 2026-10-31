// @vitest-environment jsdom

// The footer's tab strip (docs/specs/007-editor/editor-app.md "Tab bar"; docs/specs/006-document/tab-folders.md "Tab
// bar rendering"): a toolbar of tabs and folder chips (never a tablist: a tab holds its avatars and menu button), folders
// opening in place this visit only, one Tab stop and the arrow keys moving through every control showing, and the open
// tab kept in view.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createPortal } from 'react-dom';
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

const chip = () => screen.getByRole('button', { name: /^Planning,/ });
const tabNamed = (name: string) => screen.getByRole('button', { name });
const visibleTabs = () =>
  Array.from(document.querySelectorAll('[data-tab-key]'))
    .filter((el) => !el.closest('[inert]'))
    .map((el) => el.getAttribute('aria-label') ?? el.textContent);

describe('TabStrip', () => {
  it('is a toolbar of tabs and folder chips, with Add tab after it', () => {
    strip();
    const list = screen.getByRole('toolbar', { name: 'Tabs' });
    expect(list.getAttribute('aria-orientation')).toBe('horizontal');
    expect(visibleTabs()).toEqual(['Overview', 'Planning, 2 tabs', 'Backlog']);
    expect(screen.getByRole('button', { name: 'Add tab' })).toBeTruthy();
  });

  it('lays the open tab’s sliding card first in the toolbar, hidden from assistive technology', () => {
    strip();
    const list = screen.getByRole('toolbar', { name: 'Tabs' });
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
    expect(screen.getByRole('button', { name: /^Plans,/ }).getAttribute('aria-expanded')).toBe(
      'true',
    );
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
    expect(screen.getByRole('button', { name: /^Plans,/ }).getAttribute('aria-expanded')).toBe(
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
    const list = screen.getByRole('toolbar');
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(overview);
  });

  // axe's aria-required-children (critical) fired on every editor: a tablist may own only tabs, and each tab holds its
  // avatars and the open one its menu button. The strip is a toolbar of buttons, one Tab stop, the arrows reaching
  // every control (docs/specs/006-document/tab-folders.md "Tab bar rendering").
  describe('as a toolbar, with a tab menu and avatars', () => {
    const avatar = (who: string) => (
      <button type="button" aria-label={`Collaborators, showing ${who}`}>
        {who[0]}
      </button>
    );
    const rich = (
      activeId = 'o',
      presence: Record<string, string> = { o: 'Ada', b: 'Ben' },
      portal?: HTMLElement,
    ): Partial<TabStripProps<T>> => ({
      activeId,
      renderTab: (tab) => (
        <TabFrame
          key={tab.id}
          id={tab.id}
          name={tab.name}
          active={tab.id === activeId}
          readOnly={false}
          onSelect={() => {}}
          presence={presence[tab.id] ? avatar(presence[tab.id]!) : undefined}
          menu={
            tab.id === activeId ? (
              <div>
                <button type="button" aria-label="Tab menu">
                  …
                </button>
                {portal ? createPortal(<button type="button">Rename</button>, portal) : null}
              </div>
            ) : null
          }
        />
      ),
    });
    const tabStops = (list: HTMLElement) =>
      Array.from(list.querySelectorAll<HTMLElement>('button')).filter((b) => b.tabIndex >= 0);

    it('owns no tab roles, marks the open tab current, and is one Tab stop', () => {
      const { container } = strip(rich());
      const list = screen.getByRole('toolbar', { name: 'Tabs' });
      expect(
        container.querySelectorAll('[role="tab"], [role="tablist"], [aria-selected]'),
      ).toHaveLength(0);
      expect(tabNamed('Overview').getAttribute('aria-current')).toBe('page');
      expect(tabNamed('Backlog').hasAttribute('aria-current')).toBe(false);
      // The menu button and avatars are in the toolbar, reachable, but not Tab stops of their own.
      for (const name of ['Tab menu', 'Collaborators, showing Ada', 'Collaborators, showing Ben'])
        expect(list.contains(screen.getByRole('button', { name }))).toBe(true);
      expect(tabStops(list)).toEqual([tabNamed('Overview')]);
    });

    it('moves the arrows through every control in order: names, avatars, the menu button, chips', () => {
      strip(rich());
      const order = [
        'Overview',
        'Collaborators, showing Ada',
        'Tab menu',
        'Planning, 2 tabs',
        'Backlog',
        'Collaborators, showing Ben',
      ];
      const at = (name: string) =>
        name === 'Overview' || name === 'Backlog'
          ? tabNamed(name)
          : screen.getByRole('button', { name: name.startsWith('Planning') ? /^Planning,/ : name });
      at(order[0]!).focus();
      for (const next of order.slice(1)) {
        fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
        expect(document.activeElement).toBe(at(next));
      }
      for (const prev of order.slice(0, -1).reverse()) {
        fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
        expect(document.activeElement).toBe(at(prev));
      }
      fireEvent.keyDown(document.activeElement!, { key: 'End' });
      expect(document.activeElement).toBe(at('Collaborators, showing Ben'));
      fireEvent.keyDown(document.activeElement!, { key: 'Home' });
      expect(document.activeElement).toBe(tabNamed('Overview'));
    });

    it('takes an avatar that arrives later out of the Tab order too', async () => {
      const { props, rerender } = strip(rich());
      rerender(<TabStrip {...props} {...rich('o', { o: 'Ada', b: 'Ben', r: 'Cy' })} />);
      fireEvent.click(chip());
      await act(async () => {});
      const cy = screen.getByRole('button', { name: 'Collaborators, showing Cy' });
      expect(cy.tabIndex).toBe(-1);
      expect(tabStops(screen.getByRole('toolbar'))).toEqual([tabNamed('Overview')]);
    });

    it('leaves the arrows alone in a menu portalled out of the tab', () => {
      const portal = document.body.appendChild(document.createElement('div'));
      strip(rich('o', {}, portal));
      const rename = screen.getByRole('button', { name: 'Rename' });
      rename.focus();
      fireEvent.keyDown(rename, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(rename);
      portal.remove();
    });
  });

  it('brings the open tab into view, and a tap on it brings it in again', () => {
    const { container } = strip();
    expect(scrollTo).not.toHaveBeenCalled();
    const scroller = screen.getByRole('toolbar').parentElement as HTMLElement;
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
    const scroller = screen.getByRole('toolbar').parentElement as HTMLElement;
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

  // The open tab's menu button eases open (TabFrame's slots, over the sliding card's time), so the first measure is
  // short of where the tab and Add tab end up: on a phone the last tab stood half under the edge fade with Add tab out
  // of sight. Once those widths land, the strip measures once more.
  it('measures again once the open tab’s slots finish easing', async () => {
    const { props, rerender } = strip();
    const scroller = screen.getByRole('toolbar').parentElement as HTMLElement;
    let grown = false;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this === scroller) return { left: 0, right: 200, width: 200 } as DOMRect;
      const shift = grown ? 30 : 0;
      if (this.dataset.tourId === 'add-tab')
        return { left: 140 + shift, right: 170 + shift } as DOMRect;
      return { left: 100, right: 140 + shift } as DOMRect;
    });
    let land: () => void = () => {};
    const finished = new Promise<void>((resolve) => (land = resolve));
    const box = document.createElement('div');
    box.dataset.collapseWidth = 'open';
    Object.defineProperty(scroller, 'getAnimations', {
      configurable: true,
      value: () => [{ effect: { target: box }, finished }],
    });
    rerender(<TabStrip {...props} activeId="b" />);
    expect(scrollTo).not.toHaveBeenCalled();
    grown = true;
    await act(async () => {
      land();
      await finished;
    });
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 28 }));
  });

  // Closing a phone's Start panel hands a footer control back its room: the strip lost 42px and the open last tab,
  // with Add tab, stood past its edge until something else moved it.
  it('brings the open tab back when the strip narrows, and leaves a widening alone', () => {
    let resized: () => void = () => {};
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          resized = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    let width = 252;
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => width,
    });
    strip();
    const scroller = screen.getByRole('toolbar').parentElement as HTMLElement;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this === scroller) return { left: 0, right: width, width } as DOMRect;
      return { left: 150, right: 240 } as DOMRect;
    });
    scrollTo.mockClear();
    width = 300;
    resized();
    expect(scrollTo).not.toHaveBeenCalled();
    width = 210;
    resized();
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 58 }));
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  });

  it('jumps rather than glides under reduced motion', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    const { container } = strip();
    const scroller = screen.getByRole('toolbar').parentElement as HTMLElement;
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
    const scroller = screen.getByRole('toolbar').parentElement as HTMLElement;
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
