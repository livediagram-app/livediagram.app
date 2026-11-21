// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fadeOf,
  ScreenTabs,
  screenPanelId,
  screenTabId,
  screenTabKey,
  type ScreenTab,
} from './ScreenTabs';

// liveplanner/docs/specs/026-plan/automations.md "The Automations screen": the tabs are one Tab stop, the arrows, Home and End
// open the next tab, the open tab names the panel, and the Runs today meter stands beside the tab list, not in it.

afterEach(cleanup);

function Screen({ phone = false }: { phone?: boolean }) {
  const [tab, setTab] = useState<ScreenTab>('rules');
  return (
    <>
      <ScreenTabs
        idPrefix="s"
        current={tab}
        rules={2}
        phone={phone}
        meter={<div role="meter" aria-label="Runs today" aria-valuenow={1} />}
        onTab={setTab}
      />
      <div role="tabpanel" id={screenPanelId('s')} aria-labelledby={screenTabId('s', tab)} />
    </>
  );
}

const tabs = () => screen.getAllByRole('tab');

describe('Automations screen tabs', () => {
  it('holds only tabs in the tab list, the meter beside it', () => {
    render(<Screen />);
    const list = screen.getByRole('tablist', { name: 'Automations' });
    expect(Array.from(list.children).every((c) => c.getAttribute('role') === 'tab')).toBe(true);
    expect(list.contains(screen.getByRole('meter', { name: 'Runs today' }))).toBe(false);
  });

  it('is one Tab stop, the open tab, which names the panel it controls', () => {
    render(<Screen />);
    expect(tabs().map((t) => t.tabIndex)).toEqual([0, -1, -1, -1]);
    const open = screen.getByRole('tab', { name: 'Rules · 2' });
    expect(open.getAttribute('aria-controls')).toBe(screenPanelId('s'));
    expect(screen.getByRole('tabpanel', { name: 'Rules · 2' })).toBeTruthy();
  });

  it('opens the next tab with the arrows, wrapping, and moves focus with it', () => {
    render(<Screen />);
    tabs()[0]!.focus();
    fireEvent.keyDown(tabs()[0]!, { key: 'ArrowRight' });
    const runs = screen.getByRole('tab', { name: 'Audit Trail' });
    expect(runs.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(runs);
    expect(screen.getByRole('tabpanel', { name: 'Audit Trail' })).toBeTruthy();
    fireEvent.keyDown(runs, { key: 'End' });
    // Connections is the last of the four every app has.
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Connections' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Rules · 2' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Connections' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Rules · 2' }));
  });

  it('leaves other keys alone', () => {
    render(<Screen />);
    fireEvent.keyDown(tabs()[0]!, { key: 'ArrowDown' });
    expect(tabs()[0]!.getAttribute('aria-selected')).toBe('true');
    expect(screenTabKey('ArrowDown', 'rules')).toBeNull();
    expect(screenTabKey('Enter', 'runs')).toBeNull();
  });

  it('keeps the meter out of the bar on a phone, where the dialog draws it', () => {
    render(<Screen phone />);
    expect(screen.queryByRole('meter')).toBeNull();
    expect(tabs()).toHaveLength(4);
  });

  it('lists the four tabs every app has, then an app’s own', () => {
    render(
      <ScreenTabs
        idPrefix="s"
        current="view:hub"
        rules={null}
        phone={false}
        meter={null}
        extra={[{ tab: 'view:hub', label: 'Hub' }]}
        onTab={() => {}}
      />,
    );
    expect(tabs().map((t) => t.textContent)).toEqual([
      'Rules',
      'Audit Trail',
      'Templates',
      'Connections',
      'Hub',
    ]);
    expect(screen.getByRole('tab', { name: 'Hub' }).getAttribute('aria-selected')).toBe('true');
    expect(screenTabKey('End', 'rules', ['rules', 'runs', 'view:hub'])).toBe('view:hub');
  });
});

describe('the phone bar’s fade', () => {
  it('fades whichever edge has more tabs past it', () => {
    expect(fadeOf({ scrollLeft: 0, clientWidth: 300, scrollWidth: 300 })).toBe('none');
    expect(fadeOf({ scrollLeft: 0, clientWidth: 300, scrollWidth: 420 })).toBe('end');
    expect(fadeOf({ scrollLeft: 60, clientWidth: 300, scrollWidth: 420 })).toBe('both');
    expect(fadeOf({ scrollLeft: 120, clientWidth: 300, scrollWidth: 420 })).toBe('start');
  });

  it('reads the bar as it scrolls, on a phone only', () => {
    const { unmount } = render(<Screen phone />);
    const list = screen.getByRole('tablist', { name: 'Automations' });
    expect(list.dataset.fade).toBe('none');
    Object.defineProperties(list, {
      clientWidth: { value: 300, configurable: true },
      scrollWidth: { value: 420, configurable: true },
    });
    fireEvent.scroll(list);
    expect(list.dataset.fade).toBe('end');
    expect(list.className).toContain('mask-image');
    unmount();
    render(<Screen />);
    expect(screen.getByRole('tablist', { name: 'Automations' }).dataset.fade).toBeUndefined();
  });

  it('measures again as the bar resizes, and lets go as it goes', () => {
    let heard: (() => void) | null = null;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          heard = cb;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const { unmount } = render(<Screen phone />);
    const list = screen.getByRole('tablist', { name: 'Automations' });
    Object.defineProperties(list, {
      clientWidth: { value: 300, configurable: true },
      scrollWidth: { value: 420, configurable: true },
    });
    act(() => heard!());
    expect(list.dataset.fade).toBe('end');
    unmount();
    expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
