import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useNow } from './time';

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
