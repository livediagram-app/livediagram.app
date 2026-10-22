// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetricPicker } from './MetricPicker';
import type { Metric } from './metrics';

// Search narrows to every token, and choosing a row calls the CURRENT onSelect: the rows are memoised,
// so a callback captured when they were built would go stale when the parent passes a new one.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const metric = (category: string, action: string, total30: number): Metric => ({
  key: `${category}|${action}|`,
  category,
  action,
  type: null,
  label: `${category} · ${action}`,
  total30,
});
const METRICS = [metric('Element', 'Added', 10), metric('Tab', 'Loaded', 5)];

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

function render(onSelect: (m: Metric | null) => void) {
  act(() => root!.render(<MetricPicker metrics={METRICS} onSelect={onSelect} />));
}

async function typeQuery(text: string) {
  const input = document.querySelector('input')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    input.focus();
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const options = () => [...document.querySelectorAll('[role="option"]')];

describe('MetricPicker', () => {
  it('narrows the search to rows matching every token', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
    render(vi.fn());
    await typeQuery('tab load');
    expect(options().map((o) => o.textContent)).toEqual([expect.stringContaining('Loaded')]);
  });

  it('calls the current onSelect after the parent passes a new one', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
    const first = vi.fn();
    const second = vi.fn();
    render(first);
    await typeQuery('element');
    render(second);
    await act(async () => {
      options()[0]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });
    expect(second).toHaveBeenCalledWith(METRICS[0]);
    expect(first).not.toHaveBeenCalledWith(METRICS[0]);
  });
});
