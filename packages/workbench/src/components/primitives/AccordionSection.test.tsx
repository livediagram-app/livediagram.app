// @vitest-environment jsdom

// A closed AccordionSection squeezes its body to no height, but its controls are still in the page: the body must be
// inert so Tab never lands on a hidden option (the tool options panel's radio buttons).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { AccordionSection } from './AccordionSection';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <AccordionSection title="Stroke" open={open} onToggle={() => setOpen((o) => !o)}>
      <button type="button">Thin</button>
    </AccordionSection>
  );
}

afterEach(cleanup);

describe('AccordionSection', () => {
  it('keeps a closed body out of the focus order and the accessibility tree', () => {
    render(<Harness />);
    const option = screen.getByText('Thin');
    const body = option.closest('[inert]');
    expect(body).toBeTruthy();
    expect(body?.getAttribute('aria-hidden')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Stroke' }));
    expect(option.closest('[inert]')).toBeNull();
    expect(option.closest('[aria-hidden]')).toBeNull();
  });
});
