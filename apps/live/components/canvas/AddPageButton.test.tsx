// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddPageButton } from './AddPageButton';

afterEach(cleanup);

// docs/specs/007-editor/illustrate-pages.md "Adding a page": the + sits beside the last page, level with its middle,
// whether or not the page sits on the row's axis (a page sized to its content need not).
describe('AddPageButton', () => {
  it('sits level with the last page’s middle', () => {
    render(<AddPageButton lastRight={800} lastMiddle={420} zoom={1} onAdd={vi.fn()} />);
    const holder = screen
      .getByRole('button', { name: 'Add Page' })
      .closest('div[style]') as HTMLElement;
    expect(holder.style.top).toBe('420px');
  });
});
