import { describe, expect, it } from 'vitest';
import { PRESET_STATUS_NAMES, presetStatusName } from './preset-status-names';
import { PLAN_BOARD_PRESETS } from './presets';
import { statusLabel } from './board-lanes';

// A status no board names any more keeps the name its preset gave it (Won’t Fix, never Wont Fix).
describe('presetStatusName', () => {
  it('names a preset status, or one made from it', () => {
    expect(presetStatusName('wont-fix')).toBe('Won’t Fix');
    expect(presetStatusName('wont-fix~ab12')).toBe('Won’t Fix');
    expect(presetStatusName('wont-do~ab12')).toBe('Won’t Do');
  });

  it('knows no name for a status no preset spells', () => {
    expect(presetStatusName('custom-one~ab12')).toBeUndefined();
  });

  it('is the name the Bug Triage preset’s column has', () => {
    const column = PLAN_BOARD_PRESETS['bug-triage'].setup.columns.find(
      (c) => c.status === 'wont-fix',
    );
    expect(column?.name).toBe(PRESET_STATUS_NAMES['wont-fix']);
  });

  it('reads in statusLabel when no board names the status, and a board’s own name wins', () => {
    expect(statusLabel('wont-fix~ab12')).toBe('Won’t Fix');
    expect(statusLabel('wont-fix~ab12', new Map([['wont-fix~ab12', 'Declined']]))).toBe('Declined');
    expect(statusLabel('in-review~ab12')).toBe('In Review');
  });
});
