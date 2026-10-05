// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Settings > Documents > Where New Documents Go > Skip the Location Step
// (docs/specs/013-workspace/default-folders.md "Settings"): where new documents go while it is on,
// with Turn Off; a plain line while it is off.

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track }));

import { SETTINGS_CATEGORIES, type SettingsSkipLocationRowSpec } from './settings-catalogue';
import { SettingsSkipLocationRow } from './SettingsSkipLocationRow';

const row = SETTINGS_CATEGORIES.find((c) => c.id === 'documents')!.rows.find(
  (r) => r.kind === 'skipLocationStep',
) as SettingsSkipLocationRowSpec;

afterEach(cleanup);

describe('SettingsSkipLocationRow', () => {
  it('leads Where New Documents Go', () => {
    const rows = SETTINGS_CATEGORIES.find((c) => c.id === 'documents')!.rows;
    expect(rows[0]).toBe(row);
    expect(row.label).toBe('Skip the Location Step');
    expect(row.section).toBe('Where New Documents Go');
  });

  it('says it is off, with no button', () => {
    render(<SettingsSkipLocationRow row={row} settings={{}} onChange={vi.fn()} />);
    expect(
      screen.getByText('Off: the New Document wizard asks where each document goes.'),
    ).toBeTruthy();
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
    expect(screen.getByText('Sprints · Design team').parentElement!.textContent).toBe(
      'New documents are saved in Sprints · Design team',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Turn Off' }));
    expect(track).toHaveBeenCalledWith('UI', 'Toggled', 'SkipLocationStepOff');
    expect(onChange).toHaveBeenCalledWith({ reduceMotion: true, skipLocationStep: null });
    expect(track.mock.invocationCallOrder[0]!).toBeLessThan(onChange.mock.invocationCallOrder[0]!);
  });
});
