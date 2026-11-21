// @vitest-environment jsdom
// docs/specs/013-workspace/automations.md "The screen": Someone Arrived takes a room (Any Tab or one) and Only When
// It Was Empty, on unless the rule says off; Everyone Left takes how long, as a duration, a minute to twelve hours,
// and a room.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ItemUiOutline } from '@liveworkspace/automations-ui/item';
import {
  EVERYONE_LEFT_PRESETS,
  EveryoneLeftPanel,
  SomeoneArrivedPanel,
  leftMinutes,
} from './visit-panels';

afterEach(cleanup);

const outline = {
  item: {
    tabs: [
      { id: 't1', name: 'Lobby' },
      { id: 't2', name: 'Meeting Room' },
    ],
  },
} as unknown as ItemUiOutline;
const common = { outline, timeZone: 'Europe/London', conditions: 0 };

describe('SomeoneArrivedPanel', () => {
  it('reads any room by default, and keeps to the first one in', () => {
    const onChange = vi.fn();
    render(
      <SomeoneArrivedPanel
        {...common}
        trigger={{ kind: 'someone_arrived', empty: true }}
        onChange={onChange}
      />,
    );
    expect(screen.getByLabelText<HTMLSelectElement>('In').value).toBe('');
    const toggle = screen.getByRole('switch', { name: /Only When It Was Empty/ });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(toggle.textContent).toMatch(/first person into an empty room/);
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'someone_arrived', empty: false });
    fireEvent.change(screen.getByLabelText('In'), { target: { value: 't2' } });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'someone_arrived', empty: true, tab: 't2' });
  });

  it('says everyone starts it when it is off, and puts a picked room back to any', () => {
    const onChange = vi.fn();
    render(
      <SomeoneArrivedPanel
        {...common}
        trigger={{ kind: 'someone_arrived', empty: false, tab: 't1' }}
        onChange={onChange}
      />,
    );
    const toggle = screen.getByRole('switch', { name: /Only When It Was Empty/ });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(toggle.textContent).toMatch(/everyone who comes in/);
    fireEvent.change(screen.getByLabelText('In'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'someone_arrived', empty: false });
  });
});

describe('EveryoneLeftPanel', () => {
  it('offers a minute to twelve hours as durations, and saves the minutes', () => {
    const onChange = vi.fn();
    render(
      <EveryoneLeftPanel
        {...common}
        trigger={{ kind: 'everyone_left', minutes: 10 }}
        onChange={onChange}
      />,
    );
    const after = screen.getByLabelText<HTMLSelectElement>('After');
    expect(after.value).toBe('10');
    const labels = [...after.options].map((o) => o.textContent);
    expect(labels[0]).toBe('1 minute');
    expect(labels).toContain('10 minutes');
    expect(labels.at(-1)).toBe('12 hours');
    expect(after.options).toHaveLength(EVERYONE_LEFT_PRESETS.length);
    fireEvent.change(after, { target: { value: '60' } });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'everyone_left', minutes: 60 });
    fireEvent.change(screen.getByLabelText('In'), { target: { value: 't1' } });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'everyone_left', minutes: 10, tab: 't1' });
  });

  it('keeps a figure off the list as its own choice', () => {
    render(
      <EveryoneLeftPanel
        {...common}
        trigger={{ kind: 'everyone_left', minutes: 45, tab: 't2' }}
        onChange={() => {}}
      />,
    );
    const after = screen.getByLabelText<HTMLSelectElement>('After');
    expect(after.value).toBe('45');
    expect([...after.options].map((o) => o.value)).toContain('45');
    expect(screen.getByLabelText<HTMLSelectElement>('In').value).toBe('t2');
  });
});

describe('leftMinutes', () => {
  it('keeps a figure inside a minute to twelve hours, and 10 for none', () => {
    expect(leftMinutes(0)).toBe(1);
    expect(leftMinutes(5000)).toBe(720);
    expect(leftMinutes(7.8)).toBe(7);
    expect(leftMinutes('')).toBe(10);
    expect(leftMinutes(undefined)).toBe(10);
    expect(leftMinutes('x')).toBe(10);
  });
});
