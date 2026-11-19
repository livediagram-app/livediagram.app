// @vitest-environment jsdom
// The menu box's form (menu-card-form.ts): what a mode switch reads to shorten itself. TabNameInBox's tests once
// covered it; it left with Work Tracker 1289, so these hold the context's two readings.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MenuCardFormContext, useMenuCardForm } from './menu-card-form';

afterEach(cleanup);

function Reader() {
  return <span data-testid="form">{useMenuCardForm()}</span>;
}

describe('useMenuCardForm', () => {
  it('reads full outside a menu box', () => {
    render(<Reader />);
    expect(screen.getByTestId('form').textContent).toBe('full');
  });

  it('reads the form the menu box hands down', () => {
    render(
      <MenuCardFormContext.Provider value="bare">
        <Reader />
      </MenuCardFormContext.Provider>,
    );
    expect(screen.getByTestId('form').textContent).toBe('bare');
  });
});
