// @vitest-environment jsdom
// Desktop-only choice options on a phone (docs/specs/007-editor/toolbar-layout.md): Floating is shown but
// can't be picked, and a note says why. Toolbar works on a phone too. The
// drawing under a choice row picks an option when clicked, the same rules.
// A pick is tracked with the option in the type (docs/specs/017-telemetry/telemetry.md).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
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

const EDITOR = SETTINGS_CATEGORIES.find((c) => c.id === 'editor')!;

// A whole desktop-only row (Middle-Mouse Pan, docs/specs/007-editor/user-preferences.md): a phone has no middle
// button, so the row is greyed and inert there, with a note, rather than flipping to no visible effect.
describe('SettingsCategoryPane desktop-only rows', () => {
  const panSwitch = () => screen.getByRole('switch', { name: /Middle-Mouse Pan/ });

  it('greys out Middle-Mouse Pan on a phone, says why, and ignores a tap', () => {
    mobile.value = true;
    const onChange = show(vi.fn(), EDITOR);
    expect((panSwitch() as HTMLButtonElement).disabled).toBe(true);
    expect(panSwitch().getAttribute('aria-checked')).toBe('true');
    expect(
      screen.getAllByRole('note').some((n) => /A mouse setting/.test(n.textContent ?? '')),
    ).toBe(true);
    fireEvent.click(panSwitch());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves Middle-Mouse Pan working on desktop', () => {
    const onChange = show(vi.fn(), EDITOR);
    expect((panSwitch() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(panSwitch());
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ middleMousePan: false }));
  });
});

describe('SettingsCategoryPane telemetry', () => {
  // A choice row names the option picked (docs/specs/017-telemetry/telemetry.md).
  it('tracks which option was picked, not just that it changed', () => {
    show(vi.fn(), EDITOR);
    const keep = screen
      .getByRole('radiogroup', { name: 'When I Delete an Unused Image' })
      .querySelector('[role="radio"]:nth-child(3)') as HTMLButtonElement;
    fireEvent.click(keep);
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'UnusedImagesKeep');
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
        focusSectionId="danger-zone"
      />,
    );
    await new Promise((r) => requestAnimationFrame(r));
    const heading = screen.getByRole('heading', { name: 'Danger Zone' });
    expect(heading.id).toBe('settings-section-danger-zone');
    expect(document.activeElement).toBe(heading);
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }));
    expect(heading.closest('[data-settings-section]')!.getAttribute('data-settings-section')).toBe(
      'danger-zone',
    );
  });
});

// Tours (docs/specs/007-editor/user-preferences.md "Getting Started"): each switch writes its own preference,
// inverted, and sends its own token.
describe('SettingsCategoryPane tours', () => {
  const TOURS = SETTINGS_CATEGORIES.find((c) => c.id === 'tours')!;

  it("turns the Receptionist's welcome back on, the one guide to a Space", () => {
    const onChange = vi.fn();
    render(
      <SettingsCategoryPane
        category={TOURS}
        settings={{ avatarTourSeen: true }}
        onChange={onChange}
      />,
    );
    const avatar = screen.getByRole('switch', { name: "Receptionist's Welcome" });
    expect(avatar.getAttribute('aria-checked')).toBe('false');
    // No Workshop tour (docs/specs/012-collaboration/workshop-mode.md "Help").
    expect(screen.queryByRole('switch', { name: /Workshop/ })).toBeNull();
    // The shared explanation sits once, under the section heading.
    expect(screen.getByRole('heading', { name: 'Offer Again' })).toBeTruthy();
    expect(screen.getAllByText(/Start a tour from the Start Tour button/)).toHaveLength(1);
    fireEvent.click(avatar);
    expect(track).toHaveBeenCalledWith('UI', 'Toggled', 'AvatarTourSeenOff');
    expect(onChange).toHaveBeenCalledWith({ avatarTourSeen: false });
  });
});
