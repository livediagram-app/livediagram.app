// @vitest-environment jsdom

// One line of text edited in place on an element's face. Inert, it must not be focusable: the
// element around it is one `img`, and a focusable line inside it (even at tabindex -1) is a control
// nested in another (axe nested-interactive).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { InlineTextLine } from './InlineTextLine';

afterEach(cleanup);

const line = (editable: boolean) =>
  render(
    <div role="img" aria-label="Card">
      <InlineTextLine
        value="Payments"
        placeholder="Title"
        editable={editable}
        onCommit={() => {}}
        zoom={1}
        maxLength={80}
        ariaLabel="Card title"
      />
    </div>,
  );

describe('InlineTextLine', () => {
  it('is out of the focus order entirely while inert', () => {
    line(false);
    const field = screen.getByRole('textbox', { name: 'Card title' });
    expect(field.hasAttribute('tabindex')).toBe(false);
    expect(field.getAttribute('contenteditable')).toBe('false');
    expect(field.textContent).toBe('Payments');
  });

  it('takes the Tab stop once it can be edited', () => {
    line(true);
    expect(screen.getByRole('textbox', { name: 'Card title' }).getAttribute('tabindex')).toBe('0');
  });
});
