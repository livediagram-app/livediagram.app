// @vitest-environment jsdom

// The lone-section promotion (spec/09). A flyout category holding exactly one
// section is not a category: the section takes its place in the host menu.
//
// Rendered rather than tested as a pure helper because the rule is about what
// the DOM ends up holding — a trigger row and a portalled panel, or neither.

import { cleanup, render, screen } from '@testing-library/react';
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
