// @vitest-environment jsdom
// Desktop-only rows on a phone are shown greyed with a note that says why. A choice pick is
// tracked with the option in the type (docs/specs/017-telemetry/telemetry.md).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => mobile.value,
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

import { SETTINGS_CATEGORIES, type SettingsChoiceRowSpec } from './settings-catalogue';
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

// A whole desktop-only row (Button Labels, docs/specs/007-editor/editor-app.md): a phone always
// shows those buttons as icons, so the row is greyed and inert there, with a note, rather than
// flipping to no visible effect.
describe('SettingsCategoryPane desktop-only rows', () => {
  const APPEARANCE = SETTINGS_CATEGORIES.find((c) => c.id === 'appearance')!;
  const labelsSwitch = () => screen.getByRole('switch', { name: /Button Labels/ });

  it('greys out Button Labels on a phone, says why, and ignores a tap', () => {
    mobile.value = true;
    const onChange = show(vi.fn(), APPEARANCE);
    expect((labelsSwitch() as HTMLButtonElement).disabled).toBe(true);
    expect(labelsSwitch().getAttribute('aria-checked')).toBe('true');
    expect(
      screen
        .getAllByRole('note')
        .some((n) => /Phones always show these buttons/.test(n.textContent ?? '')),
    ).toBe(true);
    fireEvent.click(labelsSwitch());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves Button Labels working on desktop', () => {
    const onChange = show(vi.fn(), APPEARANCE);
    expect((labelsSwitch() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(labelsSwitch());
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dockButtonNames: false }));
  });
});

describe('SettingsCategoryPane telemetry', () => {
  // A choice row names the option picked (docs/specs/017-telemetry/telemetry.md).
  it('tracks which option was picked, not just that it changed', () => {
    const choice: SettingsChoiceRowSpec = {
      kind: 'choice',
      key: 'sampleChoice',
      label: 'Sample Size',
      description: 'A choice row, for the test.',
      options: [
        { id: 'short', label: 'Short' },
        { id: 'tall', label: 'Tall' },
      ],
      read: () => 'short',
      write: (p) => p,
      event: { category: 'UI', changed: 'SampleSize' },
    };
    show(vi.fn(), { id: 'panels', label: 'Panels', rows: [choice] });
    const tall = screen
      .getByRole('radiogroup', { name: 'Sample Size' })
      .querySelector('[role="radio"]:nth-child(2)') as HTMLButtonElement;
    fireEvent.click(tall);
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'SampleSizeTall');
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

  it('turns the Boards tour back on alone, leaving the Sheets tour answered', () => {
    const onChange = vi.fn();
    render(
      <SettingsCategoryPane
        category={TOURS}
        settings={{ planTourSeen: true, planTourTracks: ['boards', 'sheets'] }}
        onChange={onChange}
      />,
    );
    const plan = screen.getByRole('switch', { name: 'Boards Tour' });
    expect(screen.getByRole('switch', { name: 'Sheets Tour' }).getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(plan.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('switch', { name: 'Forms Tour' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    // The shared explanation sits once, under the section heading.
    expect(screen.getByRole('heading', { name: 'Offer Again' })).toBeTruthy();
    expect(screen.getAllByText(/Each tour offers itself once/)).toHaveLength(1);
    fireEvent.click(plan);
    expect(track).toHaveBeenCalledWith('UI', 'Toggled', 'BoardsTourSeenOff');
    expect(onChange).toHaveBeenCalledWith({
      planTourSeen: false,
      planTourTracks: ['sheets'],
    });
  });
});
