import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SHARE_LINK_EXPIRY_MS } from '@liveworkspace/index-client';
import { DAY_MS, timeLeftCompact, useNow } from './time';

const seen: number[] = [];

function Clock() {
  const now = useNow();
  seen.push(now);
  return <p data-testid="now">{now}</p>;
}

afterEach(() => vi.useRealTimers());

it('serves the current clock on the first render, not the one taken when the module loaded', () => {
  // The module was imported under the real clock; the fake one is set afterwards.
  const at = new Date(2026, 9, 28, 12, 0).getTime();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at);
  seen.length = 0;
  render(<Clock />);
  // Every render, the first included (it runs before subscribe), sees the fake clock.
  expect(seen[0]).toBe(at);
  expect(screen.getByTestId('now').textContent).toBe(String(at));
});

it('reads a pass just made as its own length, a few ms or a clock tick over the whole days included', () => {
  expect(timeLeftCompact(SHARE_LINK_EXPIRY_MS.week + 3)).toBe('7d left');
  expect(timeLeftCompact(SHARE_LINK_EXPIRY_MS.week + 30_000)).toBe('7d left');
  expect(timeLeftCompact(SHARE_LINK_EXPIRY_MS.month + 3)).toBe('30d left');
  expect(timeLeftCompact(SHARE_LINK_EXPIRY_MS.sixMonths + 3)).toBe('183d left');
  // Well past the whole day, it is the next one; just under, still that one.
  expect(timeLeftCompact(7 * DAY_MS + 60 * 60_000)).toBe('8d left');
  expect(timeLeftCompact(7 * DAY_MS - 1)).toBe('7d left');
});

it('counts the last day in hours and the last hour in minutes', () => {
  expect(timeLeftCompact(DAY_MS + 3)).toBe('1d left');
  expect(timeLeftCompact(DAY_MS - 1)).toBe('1d left');
  expect(timeLeftCompact(23 * 60 * 60_000)).toBe('23h left');
  expect(timeLeftCompact(90 * 60_000)).toBe('2h left');
  expect(timeLeftCompact(59 * 60_000)).toBe('59m left');
  expect(timeLeftCompact(1)).toBe('1m left');
  expect(timeLeftCompact(0)).toBe('expired');
});
