// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ToolbarDropdown } from './ToolbarDropdown';

afterEach(cleanup);

function mount() {
  render(
    <ToolbarDropdown label="Block type" description="Paragraph or heading" trigger="Aa">
      <button type="button" role="option" aria-selected={false}>
        Heading
      </button>
    </ToolbarDropdown>,
  );
  return screen.getByRole('button', { name: 'Block type' });
}

describe('ToolbarDropdown', () => {
  it('opens from its trigger and closes after an option click', () => {
    fireEvent.click(mount());
    fireEvent.click(screen.getByRole('option', { name: 'Heading' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('stays open on a press inside and closes on a press outside', () => {
    fireEvent.click(mount());
    fireEvent.pointerDown(screen.getByRole('listbox'));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
