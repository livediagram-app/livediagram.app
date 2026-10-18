// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApplyBackgroundToAll } from './page-background-apply-all';

// docs/specs/007-editor/pages-mode.md "Copying a background": the Background tab's Apply to All.

afterEach(cleanup);

describe('ApplyBackgroundToAll', () => {
  it('names the kind it reaches and applies on a press', () => {
    const onApply = vi.fn();
    render(<ApplyBackgroundToAll page={{ kind: 'slide' }} reach={35} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply to All Slides' }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Gives the other 35 this background and pattern/)).toBeTruthy();
  });

  it('says Infographic Pages on an infographic page', () => {
    render(<ApplyBackgroundToAll page={{}} reach={2} onApply={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Apply to All Infographic Pages' })).toBeTruthy();
  });

  it('is absent with no other page of the kind', () => {
    const { container } = render(
      <ApplyBackgroundToAll page={{ kind: 'slide' }} reach={0} onApply={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });
});
