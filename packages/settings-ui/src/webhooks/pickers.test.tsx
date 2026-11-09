// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EventPicker, WhoPicker } from './pickers';

// Two webhooks' Edit Events open at once: each editor's "Who Did It?" radios are a group of their own (arrow keys in
// one never check the other's), and each group heading names only its own group.
afterEach(cleanup);

describe('webhook pickers side by side', () => {
  it('give each Who picker its own radio group', () => {
    const { container } = render(
      <>
        <WhoPicker value="anyone" onChange={() => {}} />
        <WhoPicker value="me" onChange={() => {}} />
      </>,
    );
    const names = new Set(
      Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'), (r) => r.name),
    );
    expect(names.size).toBe(2);
  });

  it('give each Event picker its own heading ids', () => {
    const { container } = render(
      <>
        <EventPicker app="livediagram" value={new Set()} onChange={() => {}} />
        <EventPicker app="livediagram" value={new Set()} onChange={() => {}} />
      </>,
    );
    const ids = Array.from(container.querySelectorAll('[role="group"]'), (g) =>
      g.getAttribute('aria-labelledby'),
    );
    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(container.querySelectorAll(`[id="${id}"]`)).toHaveLength(1);
  });
});
