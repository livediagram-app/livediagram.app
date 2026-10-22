// @vitest-environment jsdom

// A cell's Add card (docs/specs/026-plan/plan-board.md "Working on a board") on a touch screen
// (docs/specs/004-interface-design/touch-targets.md): a 44px-tall row to tap.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AddCardButton } from './AddCardButton';
import { planPalette } from './plan-palette';

afterEach(cleanup);

describe('AddCardButton on a touch screen', () => {
  it('is at least 44px tall on a coarse pointer', () => {
    render(
      <AddCardButton
        palette={planPalette('light', {})}
        types={[]}
        label="Add your first card"
        onAdd={() => {}}
      />,
    );
    const button = screen.getByRole('button', { name: /Add your first card/ });
    expect(button.className).toMatch(/\bpointer-coarse:min-h-11\b/);
  });
});
