// @vitest-environment jsdom

// The scaffold's open flyout path (docs/specs/008-canvas/canvas-and-palette.md "A flyout can hold a flyout"): a
// flyout inside an open flyout opens without closing it (Tools > Mind Map), flyouts at one level replace each
// other, and closing a flyout closes what it holds.

import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MenuAccordionSection } from '../primitives/PortalMenu';
import { MenuFlyoutSection } from '../primitives/MenuFlyoutSection';
import { useFlyoutPath } from './useContextMenuScaffold';

const GLYPH = <svg aria-hidden />;

// Two sections, so no flyout is promoted inline (a lone section takes its flyout's place).
// An array rather than a fragment: the promotion counts a fragment as one child.
const sections = (name: string) =>
  ['A', 'B'].map((k) => (
    <MenuAccordionSection
      key={k}
      title={`${name} ${k}`}
      icon={GLYPH}
      open={false}
      onToggle={() => {}}
    >
      <p>
        {name} {k} body
      </p>
    </MenuAccordionSection>
  ));

function Menu() {
  const flyoutProps = useFlyoutPath();
  return (
    <div data-context-menu="">
      <MenuFlyoutSection title="Style" icon={GLYPH} {...flyoutProps('style')}>
        {sections('Style')}
      </MenuFlyoutSection>
      <MenuFlyoutSection title="Tools" icon={GLYPH} {...flyoutProps('tools')}>
        {sections('Tools')}
        <MenuFlyoutSection title="Mind Map" icon={GLYPH} {...flyoutProps('mind-map')}>
          {sections('Outline')}
        </MenuFlyoutSection>
        <MenuFlyoutSection title="Sankey" icon={GLYPH} {...flyoutProps('sankey')}>
          {sections('Flows')}
        </MenuFlyoutSection>
      </MenuFlyoutSection>
    </div>
  );
}

const row = (title: string) =>
  document.querySelector<HTMLElement>(`[data-menu-section="${title}"]`);
const isOpen = (title: string) => row(title)?.getAttribute('aria-expanded') === 'true';
const click = (title: string) => fireEvent.click(row(title)!);

describe('useFlyoutPath', () => {
  // jsdom has no ResizeObserver; an open flyout watches its panel with one.
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('opens a flyout inside an open flyout without closing it', () => {
    render(<Menu />);
    click('Tools');
    click('Mind Map');
    expect(isOpen('Tools')).toBe(true);
    expect(isOpen('Mind Map')).toBe(true);
    expect(row('Outline A')).toBeTruthy();
    expect(row('Outline B')).toBeTruthy();
  });

  it('swaps flyouts at one level, inside and outside a flyout', () => {
    render(<Menu />);
    click('Tools');
    click('Mind Map');
    click('Sankey');
    expect(isOpen('Tools')).toBe(true);
    expect(row('Mind Map')?.getAttribute('aria-expanded')).toBe('false');
    expect(isOpen('Sankey')).toBe(true);
    // Style replaces Tools, and Tools takes its open child with it.
    click('Style');
    expect(isOpen('Style')).toBe(true);
    expect(row('Tools')?.getAttribute('aria-expanded')).toBe('false');
    expect(row('Sankey')).toBeNull();
  });

  it('closes the flyouts inside a flyout when it closes, so they stay shut when it opens again', () => {
    render(<Menu />);
    click('Tools');
    click('Mind Map');
    click('Tools');
    expect(row('Mind Map')).toBeNull();
    click('Tools');
    expect(isOpen('Tools')).toBe(true);
    expect(row('Mind Map')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes only the nested flyout when it is toggled shut', () => {
    render(<Menu />);
    click('Tools');
    click('Mind Map');
    click('Mind Map');
    expect(isOpen('Tools')).toBe(true);
    expect(row('Mind Map')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('treats a toggle with no depth as the top level', () => {
    const { result } = renderHook(() => useFlyoutPath());
    act(() => result.current('tools').onToggle());
    expect(result.current('tools').open).toBe(true);
    act(() => result.current('style').onToggle());
    expect(result.current('tools').open).toBe(false);
    expect(result.current('style').open).toBe(true);
    expect(result.current('style').flush).toBe(true);
  });
});
