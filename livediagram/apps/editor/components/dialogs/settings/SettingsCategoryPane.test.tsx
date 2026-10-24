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
import { SettingsCategoryPane } from './test-pane';

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
    const accessibility = SETTINGS_CATEGORIES.find((c) => c.id === 'accessibility')!;
    const onOpenCategory = vi.fn();
    render(
      <SettingsCategoryPane
        category={{ ...accessibility, rows: accessibility.rows.filter((r) => r.kind === 'link') }}
        settings={{}}
        onChange={vi.fn()}
        onOpenCategory={onOpenCategory}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open Appearance' }));
    expect(onOpenCategory).toHaveBeenCalledWith('appearance');
  });
});

// Tours (docs/specs/007-editor/user-preferences.md "Tours"): each switch writes its own preference,
// inverted, and sends its own token.
describe('SettingsCategoryPane tours', () => {
  const TOURS = SETTINGS_CATEGORIES.find((c) => c.id === 'tours')!;

  it('turns the Workshop tour back on alone, leaving the Diagram tour answered', () => {
    const onChange = vi.fn();
    render(
      <SettingsCategoryPane
        category={TOURS}
        settings={{ tourSeen: true, workshopTourSeen: true }}
        onChange={onChange}
      />,
    );
    const workshop = screen.getByRole('switch', { name: 'Workshop Tour' });
    expect(screen.getByRole('switch', { name: 'Diagram Tour' }).getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(workshop.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('switch', { name: 'Draw Tour' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    // The shared explanation sits once, under the section heading.
    expect(screen.getByRole('heading', { name: 'Offer Again' })).toBeTruthy();
    expect(screen.getAllByText(/Each tour offers itself once/)).toHaveLength(1);
    fireEvent.click(workshop);
    expect(track).toHaveBeenCalledWith('UI', 'Toggled', 'WorkshopTourSeenOff');
    expect(onChange).toHaveBeenCalledWith({ tourSeen: true, workshopTourSeen: false });
  });
});
