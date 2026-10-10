// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Settings > Accessibility > Show Tours (docs/specs/007-editor/user-preferences.md "Show Tours"): one
// heading and description over a grid of the three tour switches, each its own preference.

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track }));

import { SETTINGS_CATEGORIES, type SettingsToggleGroupRowSpec } from './settings-catalogue';
import { SettingsToggleGroupRow } from './SettingsToggleGroupRow';

const row = SETTINGS_CATEGORIES.find((c) => c.id === 'accessibility')!.rows.find(
  (r) => r.key === 'tours',
) as SettingsToggleGroupRowSpec;

afterEach(cleanup);

describe('SettingsToggleGroupRow', () => {
  it('draws one group with a switch per tour, each showing its own state', () => {
    render(
      <SettingsToggleGroupRow
        row={row}
        checked={(key) => key === 'planTourSeen'}
        onChange={() => {}}
      />,
    );
    const group = screen.getByRole('group', { name: 'Show Tours' });
    const switches = within(group).getAllByRole('switch');
    expect(switches.map((s) => s.textContent)).toEqual(['Welcome', 'Plan', 'Facilitate']);
    expect(switches.map((s) => s.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    // One shared description, with a Learn more link per tour.
    const footnote = document.getElementById('tours-description')!;
    expect(
      within(footnote)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Welcome', 'Plan', 'Facilitate']);
  });

  it('flips the one switch pressed', () => {
    const onChange = vi.fn();
    render(<SettingsToggleGroupRow row={row} checked={() => false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Facilitate' }));
    expect(onChange).toHaveBeenCalledWith('facilitateTourSeen', true);
  });
});
