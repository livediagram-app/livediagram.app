// @vitest-environment jsdom
// Desktop-only choice options on a phone (docs/specs/007-editor/toolbar-layout.md): Floating is shown but
// can't be picked, and a note says why. Toolbar works on a phone too. The
// drawing under a choice row picks an option when clicked, the same rules.
// A pick is tracked with the option in the type (docs/specs/017-telemetry/telemetry.md).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => mobile.value,
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

import { SETTINGS_CATEGORIES } from './settings-catalogue';
import { SettingsCategoryPane } from './SettingsCategoryPane';

afterEach(() => {
  cleanup();
  mobile.value = false;
  track.mockClear();
});

const PANELS = SETTINGS_CATEGORIES.find((c) => c.id === 'panels')!;

function show(onChange = vi.fn(), category = PANELS) {
  render(<SettingsCategoryPane category={category} settings={{}} onChange={onChange} />);
  return onChange;
}

// A whole desktop-only row (the minimap's, docs/specs/008-canvas/minimap.md):
// a phone never draws the minimap, so its rows are greyed and inert there,
// with a note, rather than flipping to no visible effect.
describe('SettingsCategoryPane desktop-only rows', () => {
  const MAP = SETTINGS_CATEGORIES.find((c) => c.id === 'map')!;
  const mapSwitch = () => screen.getByRole('switch', { name: /Enable Map/ });

  it('greys out Enable Map on a phone, says why, and ignores a tap', () => {
    mobile.value = true;
    const onChange = show(vi.fn(), MAP);
    expect((mapSwitch() as HTMLButtonElement).disabled).toBe(true);
    expect(mapSwitch().getAttribute('aria-checked')).toBe('true');
    expect(
      screen.getAllByRole('note').some((n) => /Map is desktop only/.test(n.textContent ?? '')),
    ).toBe(true);
    fireEvent.click(mapSwitch());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('locks the other Map rows on a phone too', () => {
    mobile.value = true;
    render(<SettingsCategoryPane category={MAP} settings={{}} onChange={vi.fn()} />);
    const dim = screen.getByRole('switch', { name: /Dim Outside the View/ }) as HTMLButtonElement;
    expect(dim.disabled).toBe(true);
    const sizes = screen
      .getByRole('radiogroup', { name: 'Map Size' })
      .querySelectorAll<HTMLButtonElement>('[role="radio"]');
    expect([...sizes].every((b) => b.disabled)).toBe(true);
  });

  it('leaves Enable Map working on desktop, with no note', () => {
    const onChange = show(vi.fn(), MAP);
    expect((mapSwitch() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(mapSwitch());
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ showMinimap: false }));
  });
});

describe('SettingsCategoryPane telemetry', () => {
  // A choice row names the option picked (docs/specs/017-telemetry/telemetry.md).
  it('tracks which option was picked, not just that it changed', () => {
    const category = SETTINGS_CATEGORIES.find((c) =>
      c.rows.some((r) => r.key === 'elementIndicatorStyle'),
    )!;
    show(vi.fn(), category);
    const footer = screen
      .getByRole('radiogroup', { name: 'Element Indicators' })
      .querySelector('[role="radio"]:nth-child(2)') as HTMLButtonElement;
    fireEvent.click(footer);
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'ElementIndicatorsFooter');
  });
});

describe('SettingsCategoryPane: targeting a section', () => {
  it('scrolls a targeted section into view and focuses its heading', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const account = SETTINGS_CATEGORIES.find((c) => c.id === 'account')!;
    render(
      <SettingsCategoryPane
        category={account}
        settings={{}}
        onChange={vi.fn()}
        focusSectionId="your-data"
      />,
    );
    await new Promise((r) => requestAnimationFrame(r));
    const heading = screen.getByRole('heading', { name: 'Your Data' });
    expect(heading.id).toBe('settings-section-your-data');
    expect(document.activeElement).toBe(heading);
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }));
    expect(heading.closest('[data-settings-section]')!.getAttribute('data-settings-section')).toBe(
      'your-data',
    );
  });
});

describe('SettingsCategoryPane link rows', () => {
  it('opens the linked category in place', () => {
    const ai = SETTINGS_CATEGORIES.find((c) => c.id === 'ai')!;
    const onOpenCategory = vi.fn();
    render(
      <SettingsCategoryPane
        category={{ ...ai, rows: ai.rows.filter((r) => r.kind === 'link') }}
        settings={{}}
        onChange={vi.fn()}
        onOpenCategory={onOpenCategory}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Manage API Tokens' }));
    expect(onOpenCategory).toHaveBeenCalledWith('tokens');
  });
});

// Show Tours (docs/specs/007-editor/user-preferences.md "Show Tours"): each switch in the group writes its
// own preference and sends its own token, as its own row used to.
describe('SettingsCategoryPane toggle group', () => {
  const ACCESSIBILITY = SETTINGS_CATEGORIES.find((c) => c.id === 'accessibility')!;

  it('turns the Plan tour back on: planTourSeen false, PlanTourSeenOff', () => {
    const onChange = vi.fn();
    render(
      <SettingsCategoryPane
        category={ACCESSIBILITY}
        settings={{ tourSeen: true, planTourSeen: true }}
        onChange={onChange}
      />,
    );
    const plan = screen.getByRole('switch', { name: 'Plan' });
    expect(plan.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('switch', { name: 'Facilitate' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(plan);
    expect(track).toHaveBeenCalledWith('UI', 'Toggled', 'PlanTourSeenOff');
    expect(onChange).toHaveBeenCalledWith({ tourSeen: true, planTourSeen: false });
  });
});
