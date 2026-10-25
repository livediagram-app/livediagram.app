import { describe, expect, it, vi } from 'vitest';
import { bindRow, isBindableRow, type BindableRow } from './bind';

type Prefs = { on?: boolean; size?: string; opacity?: number; a?: boolean };

const ctx = (settings: Prefs) => {
  const calls: string[] = [];
  return {
    calls,
    settings,
    onChange: vi.fn((next: Prefs) => calls.push(`write ${JSON.stringify(next)}`)),
    track: vi.fn((category: string, action: string, type: string) =>
      calls.push(`track ${category} ${action} ${type}`),
    ),
  };
};

describe('bindRow', () => {
  it('reads a switch and tracks its flip before writing it', () => {
    const row: BindableRow<Prefs> = {
      kind: 'toggle',
      key: 'on',
      label: 'On',
      description: '',
      read: (p) => p.on === true,
      write: (p, on) => ({ ...p, on }),
      event: { category: 'UI', on: 'OnOn', off: 'OnOff' },
    };
    const c = ctx({ on: false });
    const bound = bindRow(row, c, true);
    expect(bound).toMatchObject({ kind: 'toggle', value: false, allApps: true });
    if (bound.kind === 'toggle') bound.onChange(true);
    expect(c.calls).toEqual(['track UI Toggled OnOn', 'write {"on":true}']);
  });

  it('names a choice’s option in its event', () => {
    const row: BindableRow<Prefs> = {
      kind: 'choice',
      key: 'size',
      label: 'Size',
      description: '',
      options: [
        { id: 'small', label: 'Small' },
        { id: 'large', label: 'Large' },
      ],
      read: (p) => p.size ?? 'small',
      write: (p, size) => ({ ...p, size }),
      event: { category: 'UI', changed: 'MapSize' },
    };
    const c = ctx({});
    const bound = bindRow(row, c);
    expect(bound).toMatchObject({ value: 'small' });
    expect('allApps' in bound).toBe(false);
    if (bound.kind === 'choice') bound.onChange('large');
    expect(c.calls[0]).toBe('track UI Changed MapSizeLarge');
  });

  it('commits a slider and keeps its preview', () => {
    const preview = vi.fn();
    const row: BindableRow<Prefs> = {
      kind: 'slider',
      key: 'opacity',
      label: 'Opacity',
      description: '',
      min: 0,
      max: 1,
      step: 0.1,
      format: String,
      read: (p) => p.opacity ?? 1,
      write: (p, opacity) => ({ ...p, opacity }),
      preview,
      event: { category: 'UI', changed: 'PanelOpacity' },
    };
    const c = ctx({});
    const bound = bindRow(row, c);
    if (bound.kind !== 'slider') throw new Error('slider');
    expect(bound.preview).toBe(preview);
    bound.onCommit(0.5);
    expect(c.calls).toEqual(['track UI Changed PanelOpacity', 'write {"opacity":0.5}']);
  });

  it('binds each switch of a group to its own preference', () => {
    const row: BindableRow<Prefs> = {
      kind: 'toggleGroup',
      key: 'tours',
      label: 'Tours',
      description: '',
      toggles: [
        {
          key: 'a',
          label: 'A',
          read: (p) => p.a === true,
          write: (p, a) => ({ ...p, a }),
          event: { category: 'Tour', on: 'AOn', off: 'AOff' },
        },
      ],
    };
    const c = ctx({ a: true });
    const bound = bindRow(row, c);
    if (bound.kind !== 'toggleGroup') throw new Error('group');
    expect(bound.toggles[0]!.value).toBe(true);
    bound.toggles[0]!.onChange(false);
    expect(c.calls).toEqual(['track Tour Toggled AOff', 'write {"a":false}']);
  });

  it('leaves an app’s own kinds to the app', () => {
    expect(isBindableRow({ kind: 'toggle' })).toBe(true);
    expect(isBindableRow({ kind: 'note' })).toBe(true);
    expect(isBindableRow({ kind: 'tokens' })).toBe(false);
    expect(isBindableRow({ kind: 'appearance' })).toBe(false);
  });
});
