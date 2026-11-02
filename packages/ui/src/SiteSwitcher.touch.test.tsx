// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiteSwitcher } from './SiteSwitcher';

// A tap on the logo opens the card on a touch screen (liveworkspace/docs/specs/010-site/site-switcher.md "How it
// behaves"); a mouse click or Enter still follows the logo.

function renderSwitcher(onLogoClick = vi.fn()) {
  render(
    <>
      <SiteSwitcher app="livediagram" current="livediagram.app">
        <a href="/explorer" onClick={onLogoClick}>
          <span>logo</span>
        </a>
      </SiteSwitcher>
      <p>elsewhere</p>
    </>,
  );
  return onLogoClick;
}

// A click as a browser sends it: `detail` 1 for a press, 0 from the keyboard, and the pointer it came from.
function click(
  target: Element,
  { detail = 1, pointerType }: { detail?: number; pointerType?: string },
) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, detail });
  if (pointerType !== undefined)
    Object.defineProperty(event, 'pointerType', { value: pointerType });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

const menu = () => screen.queryByRole('menu');
const isOpen = () =>
  screen.getByRole('button', { name: 'Switch site' }).getAttribute('aria-expanded') === 'true';
const currentRow = () =>
  screen
    .getAllByRole('menuitem', { hidden: true })
    .find((row) => row.getAttribute('aria-current') === 'page');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('a tap on the logo', () => {
  it('opens the card instead of following the logo', () => {
    const onLogoClick = renderSwitcher();
    const event = click(screen.getByText('logo'), { pointerType: 'touch' });
    expect(event.defaultPrevented).toBe(true);
    expect(onLogoClick).not.toHaveBeenCalled();
    expect(isOpen()).toBe(true);
    expect(menu()).not.toBeNull();
  });

  it("then points the current site's row where the logo goes, and leaves the other rows alone", () => {
    renderSwitcher();
    expect(currentRow()?.getAttribute('href')).toBe('https://www.livediagram.app');
    click(screen.getByText('logo'), { pointerType: 'touch' });
    expect(currentRow()?.getAttribute('href')).toBe('/explorer');
    const others = screen
      .getAllByRole('menuitem')
      .filter((row) => row !== currentRow())
      .map((row) => row.getAttribute('href'));
    expect(others).toEqual([
      'https://www.liveworkspace.app',
      'https://www.liveplanner.app',
      'https://www.livedocuments.app',
      'https://www.livedesign.app',
    ]);
  });

  it('follows the logo when the card is already open', () => {
    const onLogoClick = renderSwitcher();
    click(screen.getByText('logo'), { pointerType: 'touch' });
    const second = click(screen.getByText('logo'), { pointerType: 'touch' });
    expect(second.defaultPrevented).toBe(false);
    expect(onLogoClick).toHaveBeenCalledTimes(1);
  });

  it('counts as touch when the click names no pointer and the main pointer is coarse', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)' }));
    const onLogoClick = renderSwitcher();
    click(screen.getByText('logo'), {});
    expect(onLogoClick).not.toHaveBeenCalled();
    expect(isOpen()).toBe(true);
  });

  it('closes on a tap outside', () => {
    renderSwitcher();
    click(screen.getByText('logo'), { pointerType: 'touch' });
    expect(isOpen()).toBe(true);
    fireEvent.pointerDown(screen.getByText('elsewhere'));
    expect(isOpen()).toBe(false);
  });
});

describe('the logo with a mouse or the keyboard', () => {
  it('follows a mouse click, even on a touch screen', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const onLogoClick = renderSwitcher();
    const event = click(screen.getByText('logo'), { pointerType: 'mouse' });
    expect(event.defaultPrevented).toBe(false);
    expect(onLogoClick).toHaveBeenCalledTimes(1);
    expect(isOpen()).toBe(false);
  });

  it('follows a click that names no pointer on a fine-pointer screen', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const onLogoClick = renderSwitcher();
    click(screen.getByText('logo'), {});
    expect(onLogoClick).toHaveBeenCalledTimes(1);
    expect(isOpen()).toBe(false);
  });

  it('follows Enter (a keyboard click), whatever the pointer', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const onLogoClick = renderSwitcher();
    click(screen.getByText('logo'), { detail: 0, pointerType: 'touch' });
    expect(onLogoClick).toHaveBeenCalledTimes(1);
    expect(isOpen()).toBe(false);
  });

  it('keeps the chevron a menu button: a click opens, the current row still goes to its home', () => {
    renderSwitcher();
    fireEvent.click(screen.getByRole('button', { name: 'Switch site' }));
    expect(isOpen()).toBe(true);
    expect(currentRow()?.getAttribute('href')).toBe('https://www.livediagram.app');
  });

  it('keeps the chevron opening from the keyboard', () => {
    renderSwitcher();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Switch site' }), { key: 'ArrowDown' });
    expect(isOpen()).toBe(true);
  });
});

describe('a tap that lands on no link', () => {
  it('is left alone', () => {
    render(
      <SiteSwitcher app="livediagram" current="livediagram.app">
        <span>mark</span>
      </SiteSwitcher>,
    );
    const event = click(screen.getByText('mark'), { pointerType: 'touch' });
    expect(event.defaultPrevented).toBe(false);
    expect(isOpen()).toBe(false);
  });
});
