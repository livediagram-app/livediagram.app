// @vitest-environment jsdom

// The lone-section promotion (docs/specs/008-canvas/canvas-and-palette.md). A flyout category holding exactly one
// section is not a category: the section takes its place in the host menu.
//
// Rendered rather than tested as a pure helper because the rule is about what
// the DOM ends up holding — a trigger row and a portalled panel, or neither.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MenuAccordionSection } from './PortalMenu';
import { MenuFlyoutSection } from './MenuFlyoutSection';

const GLYPH = <svg aria-hidden />;

function section(title: string, open = false, onToggle: () => void = () => {}) {
  return (
    <MenuAccordionSection title={title} icon={GLYPH} open={open} onToggle={onToggle}>
      <p>{title} body</p>
    </MenuAccordionSection>
  );
}

// The flyout trigger and an accordion header both render their title, so the
// two are told apart by what the row DOES: a flyout row claims a menu popup.
function flyoutTrigger(title: string): HTMLElement | null {
  return screen.queryByRole('button', { name: title, expanded: false });
}

describe('MenuFlyoutSection', () => {
  afterEach(cleanup);

  it('promotes a lone section into the host menu, dropping the category row', () => {
    render(
      <MenuFlyoutSection title="Tools" icon={GLYPH}>
        {false}
        {section('Fields')}
        {null}
      </MenuFlyoutSection>,
    );
    // No TOOLS row at all: the thing inside it is the thing you wanted.
    expect(screen.queryByText('Tools')).toBeNull();
    expect(screen.getByText('Fields')).toBeTruthy();
  });

  it('keeps a panel flyout as a flyout even with one child', () => {
    // A panel (the Session Studio) is one bespoke surface, not a lone
    // section: promoting it inline would pour a tall panel into the menu.
    render(
      <MenuFlyoutSection title="Collaborate" icon={GLYPH} panel>
        <p>Studio</p>
      </MenuFlyoutSection>,
    );
    expect(flyoutTrigger('Collaborate')).toBeTruthy();
    expect(screen.queryByText('Studio')).toBeNull();
  });

  it('leaves the promoted section collapsible rather than forcing it open', () => {
    // Inside a panel with nothing else in it, an accordion was a second click
    // for no choice. In the host menu it is an ordinary row, and a row that
    // could never be closed would be worse than the flyout it replaced.
    const onToggle = vi.fn();
    render(
      <MenuFlyoutSection title="Tools" icon={GLYPH}>
        {section('Fields', false, onToggle)}
      </MenuFlyoutSection>,
    );
    // The accordion collapses by grid-rows rather than by unmounting, so the
    // header's own state is what says it is shut.
    const header = screen.getByRole('button', { name: 'Fields' });
    expect(header.getAttribute('aria-expanded')).toBe('false');
    header.click();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('keeps the category row when there is more than one section', () => {
    render(
      <MenuFlyoutSection title="Style" icon={GLYPH}>
        {section('Presets')}
        {section('Colours')}
      </MenuFlyoutSection>,
    );
    expect(flyoutTrigger('Style')).toBeTruthy();
    // Contents stay behind it, in the panel, until it is opened.
    expect(screen.queryByText('Presets')).toBeNull();
  });

  it('promotes a lone section that a component renders, not just a bare one', () => {
    // The regression that shipped first: inspecting the child's own props for
    // `open` / `onToggle` promoted an entity's inline Fields but not a session
    // button's Session, which is a wrapper component taking the same scaffold
    // state as `sectionProps`. Same thing, different prop shape, half a fix.
    function SessionMenuSection({
      sectionProps,
    }: {
      sectionProps: { open: boolean; onToggle: () => void };
    }) {
      return (
        <MenuAccordionSection title="Session" icon={GLYPH} {...sectionProps}>
          <p>Session body</p>
        </MenuAccordionSection>
      );
    }
    render(
      <MenuFlyoutSection title="Tools" icon={GLYPH}>
        <SessionMenuSection sectionProps={{ open: false, onToggle: () => {} }} />
      </MenuFlyoutSection>,
    );
    expect(screen.queryByText('Tools')).toBeNull();
    expect(screen.getByRole('button', { name: 'Session' })).toBeTruthy();
  });

  it('keeps the category row when every section is conditioned away', () => {
    // Zero is not one. An empty category is the caller's to hide (they gate
    // the whole row), not this component's to silently swallow.
    render(
      <MenuFlyoutSection title="Tools" icon={GLYPH}>
        {false}
        {null}
      </MenuFlyoutSection>,
    );
    expect(flyoutTrigger('Tools')).toBeTruthy();
  });
});

// Which side a nested flyout opens on (docs/specs/008-canvas/canvas-and-palette.md "A flyout can hold a
// flyout"). jsdom has no layout, so boxes are stubbed: the host menu sits where the test puts it, each panel
// is 224px wide at the left its own style sets, and a row spans the menu or panel it sits in.
describe('MenuFlyoutSection nested side', () => {
  const PANEL_WIDTH = 224;
  let host = { left: 0, right: 0 };

  function box(left: number, right: number, top: number, height: number): DOMRect {
    const r = {
      left,
      right,
      top,
      bottom: top + height,
      width: right - left,
      height,
      x: left,
      y: top,
    };
    return { ...r, toJSON: () => r };
  }

  function rectOf(el: Element): DOMRect {
    const panel = el.closest<HTMLElement>('[data-menu-flyout]');
    const left = panel ? parseFloat(panel.style.left) || 0 : host.left;
    const right = panel ? left + PANEL_WIDTH : host.right;
    if (el === panel) return box(left, right, parseFloat(panel.style.top) || 0, 200);
    if (!panel && el.hasAttribute('data-menu-surface')) return box(left, right, 100, 300);
    return box(left, right, 120, 32);
  }

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const frame = () =>
    act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });

  async function openNested(hostSpan: { left: number; right: number }, viewportWidth: number) {
    host = hostSpan;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(viewportWidth);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      return rectOf(this);
    });
    render(
      <div data-menu-surface="">
        <MenuFlyoutSection title="Tools" icon={GLYPH}>
          <MenuFlyoutSection title="Mind Map" icon={GLYPH}>
            {section('Layout')}
            {section('Branches')}
          </MenuFlyoutSection>
          {section('Chart')}
        </MenuFlyoutSection>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tools' }));
    await frame();
    fireEvent.click(screen.getByRole('button', { name: 'Mind Map' }));
    await frame();
    const [tools, mindMap] = Array.from(
      document.querySelectorAll<HTMLElement>('[data-menu-flyout]'),
    );
    return { tools: parseFloat(tools!.style.left), mindMap: parseFloat(mindMap!.style.left) };
  }

  it('opens to the left of a parent that flipped left, never over the host menu', async () => {
    // The host menu hugs the right edge, so Tools flips left (474 to 698). The third panel used to open to
    // the right of its row, at 700: straight over the host menu.
    const { tools, mindMap } = await openNested({ left: 700, right: 920 }, 1024);
    expect(tools).toBe(700 - 2 - PANEL_WIDTH);
    expect(mindMap).toBe(tools - 2 - PANEL_WIDTH);
  });

  it('keeps opening right beside a parent that opened right', async () => {
    const { tools, mindMap } = await openNested({ left: 100, right: 320 }, 1024);
    expect(tools).toBe(322);
    expect(mindMap).toBe(tools + PANEL_WIDTH + 2);
  });

  it('crosses past the host menu and its parent when its own side has no room', async () => {
    // Tools fits right (522 to 746); the third panel does not, so it opens left of the HOST menu rather
    // than left of its own row, which would cover the host menu.
    const { tools, mindMap } = await openNested({ left: 300, right: 520 }, 900);
    expect(tools).toBe(522);
    expect(mindMap).toBe(300 - 2 - PANEL_WIDTH);
  });
});
