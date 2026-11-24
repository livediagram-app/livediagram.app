import { describe, expect, it, vi } from 'vitest';
import type { SettingsCategory } from './model';
import { ownToggleSetter } from './own-toggle';

// An editor's Account section writes a switch through the editor's own row for it, and anything else (a switch it has
// no row for, Calls Open In's Space or its Default) straight to its preferences.
describe('ownToggleSetter', () => {
  const onChange = vi.fn();
  const own: SettingsCategory[] = [
    {
      id: 'privacy',
      label: 'Privacy',
      rows: [
        {
          kind: 'toggle',
          key: 'telemetryEnabled',
          label: 'Events',
          description: 'Usage events.',
          value: true,
          onChange,
        },
      ],
    },
  ];

  it('flips a switch through its own row, else the fallback', () => {
    const fallback = vi.fn();
    const set = ownToggleSetter(own, fallback);
    set('telemetryEnabled', false);
    expect(onChange).toHaveBeenCalledWith(false);
    expect(fallback).not.toHaveBeenCalled();
    set('reduceMotion', true);
    expect(fallback).toHaveBeenCalledWith('reduceMotion', true);
  });

  it('writes a value no switch holds through the fallback, null included', () => {
    const fallback = vi.fn();
    const set = ownToggleSetter(own, fallback);
    set('callSpace', 'lh_room');
    set('callSpace', null);
    expect(fallback.mock.calls).toEqual([
      ['callSpace', 'lh_room'],
      ['callSpace', null],
    ]);
  });
});
