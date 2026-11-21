// @vitest-environment jsdom
// A value in a rule's summary reads as its label, never its braces (value-labels.tsx).
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ChipText, valueLabel, valueText } from './value-labels';

afterEach(cleanup);

describe('valueLabel', () => {
  it('names a value by the app’s label, every app’s, a shifted day, a webhook field, or its words', () => {
    const labels = new Map([['item.name', 'Space Name']]);
    expect(valueLabel('item.name', labels)).toBe('Space Name');
    expect(valueLabel('now.date')).toBe('Today');
    expect(valueLabel('person')).toBe('Who Did It');
    expect(valueLabel('now + 3d')).toBe('Today + 3 Days');
    expect(valueLabel('now - 1d')).toBe('Today − 1 Day');
    expect(valueLabel('now + 0d')).toBe('Today');
    expect(valueLabel('webhook.order.id')).toBe('Webhook order.id');
    expect(valueLabel('poll.question')).toBe('Poll Question');
  });

  it('reads a text with its values as labels', () => {
    expect(valueText('Take Snapshot “{{ now.date }}”')).toBe('Take Snapshot “Today”');
    expect(valueText('No values here')).toBe('No values here');
  });
});

describe('ChipText', () => {
  it('draws each value as a token of its label, and plain words as they are', () => {
    const { container } = render(
      <span>
        <ChipText text="Take Snapshot “{{now.date}}”" />
      </span>,
    );
    expect(container.textContent).toBe('Take Snapshot “Today”');
    expect(container.querySelector('[data-value-token="now.date"]')!.textContent).toBe('Today');
    cleanup();
    const plain = render(
      <span>
        <ChipText text="Take Snapshot" />
      </span>,
    );
    expect(plain.container.querySelector('[data-value-token]')).toBeNull();
  });
});
