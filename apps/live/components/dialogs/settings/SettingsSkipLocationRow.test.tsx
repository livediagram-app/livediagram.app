// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Settings > Documents > New Documents > Always Save in One Place
// (docs/specs/013-workspace/default-folders.md "Settings"): an On / Off pill, where new documents go
// while it is on with Turn Off, and how to turn it on while it is off.

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track }));

import { SETTINGS_CATEGORIES, type SettingsSkipLocationRowSpec } from './settings-catalogue';
import { SettingsSkipLocationRow } from './SettingsSkipLocationRow';

const row = SETTINGS_CATEGORIES.find((c) => c.id === 'documents')!.rows.find(
  (r) => r.kind === 'skipLocationStep',
) as SettingsSkipLocationRowSpec;

afterEach(cleanup);

describe('SettingsSkipLocationRow', () => {
  it('leads Documents, in its own New Documents section', () => {
    const rows = SETTINGS_CATEGORIES.find((c) => c.id === 'documents')!.rows;
    expect(rows[0]).toBe(row);
    expect(row.label).toBe('Always Save in One Place');
    expect(row.section).toBe('New Documents');
  });

  it('says it is off and how to turn it on, with no button', () => {
    render(<SettingsSkipLocationRow row={row} settings={{}} onChange={vi.fn()} />);
    expect(document.querySelector('[data-skip-location-status]')!.textContent).toBe('Off');
    expect(document.getElementById('skipLocationStep-description')!.textContent).toMatch(
      /tick “Always save new documents in…” on its Location step/,
    );
    expect(screen.queryByRole('button', { name: 'Turn Off' })).toBeNull();
  });

  it('names the place, and Turn Off clears it with telemetry first', () => {
    const onChange = vi.fn();
    const settings = {
      reduceMotion: true,
      skipLocationStep: {
        saveLocation: 'livediagram' as const,
        placement: 'team:t:folder:s',
        placeName: 'Sprints · Design team',
      },
    };
    render(<SettingsSkipLocationRow row={row} settings={settings} onChange={onChange} />);
    expect(document.querySelector('[data-skip-location-status]')!.textContent).toBe('On');
    expect(screen.getByText('Sprints · Design team').parentElement!.textContent).toMatch(
      /^New documents go straight to Sprints · Design team, without the wizard asking where\./,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Turn Off' }));
    expect(track).toHaveBeenCalledWith('UI', 'Toggled', 'SkipLocationStepOff');
    expect(onChange).toHaveBeenCalledWith({ reduceMotion: true, skipLocationStep: null });
    expect(track.mock.invocationCallOrder[0]!).toBeLessThan(onChange.mock.invocationCallOrder[0]!);
  });
});
