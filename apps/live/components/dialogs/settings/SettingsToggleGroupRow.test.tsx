// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Settings > Editor > Illustrate > Guides Shown (docs/specs/007-editor/user-preferences.md "Toggle
// groups"): one label and description over a chip per logo guide, each its own preference.

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track }));

import { SETTINGS_CATEGORIES, type SettingsToggleGroupRowSpec } from './settings-catalogue';
import { SettingsToggleGroupRow } from './SettingsToggleGroupRow';

const row = SETTINGS_CATEGORIES.find((c) => c.id === 'illustrate')!.rows.find(
  (r) => r.key === 'logoGuideParts',
) as SettingsToggleGroupRowSpec;

afterEach(cleanup);

describe('SettingsToggleGroupRow', () => {
  it('draws one group with a chip per guide, each showing its own state', () => {
    render(
      <SettingsToggleGroupRow
        row={row}
        checked={(key) => key === 'logoGuide-diagonals'}
        onChange={() => {}}
      />,
    );
    const group = screen.getByRole('group', { name: 'Guides Shown' });
    const switches = within(group).getAllByRole('switch');
    expect(switches.map((s) => s.textContent)).toEqual([
      'Centre Lines',
      'Diagonals',
      'Safe Area',
      'Circles',
      'Square',
      'Grid',
    ]);
    expect(switches.map((s) => s.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
      'false',
      'false',
      'false',
    ]);
    expect(group.getAttribute('aria-describedby')).toBe('logoGuideParts-description');
  });

  it('flips the one switch pressed', () => {
    const onChange = vi.fn();
    render(<SettingsToggleGroupRow row={row} checked={() => false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Safe Area' }));
    expect(onChange).toHaveBeenCalledWith('logoGuide-safe', true);
  });

  it('takes no presses while disabled', () => {
    const onChange = vi.fn();
    render(<SettingsToggleGroupRow row={row} checked={() => true} onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole('switch', { name: 'Grid' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
