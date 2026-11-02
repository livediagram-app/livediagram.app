// @vitest-environment jsdom
// The Tab Style home's last row (docs/specs/011-theme/canvas-and-theme-dialog.md "Apply to All Tabs").
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApplyToAllTabsRow } from './ApplyToAllTabsRow';

const row = () => screen.getByRole<HTMLButtonElement>('button', { name: /Apply to All Tabs/ });

describe('ApplyToAllTabsRow', () => {
  it('applies on a press, saying how many other tabs it reaches', () => {
    const onApply = vi.fn();
    render(<ApplyToAllTabsRow tabCount={4} applying={false} onApply={onApply} noun="document" />);
    expect(row().textContent).toContain('Give the other 3 tabs this tab');
    expect(row().className).toContain('cursor-pointer');
    fireEvent.click(row());
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('names a single other tab in the singular', () => {
    render(<ApplyToAllTabsRow tabCount={2} applying={false} onApply={vi.fn()} noun="plan" />);
    expect(row().textContent).toContain('Give the other tab this tab');
  });

  it('is greyed, and says why, when the document has one tab', () => {
    const onApply = vi.fn();
    render(<ApplyToAllTabsRow tabCount={1} applying={false} onApply={onApply} noun="design" />);
    expect(row().disabled).toBe(true);
    expect(row().textContent).toContain('This design has one tab.');
    fireEvent.click(row());
    expect(onApply).not.toHaveBeenCalled();
  });

  it('shows it is busy and takes no second press while applying', () => {
    render(<ApplyToAllTabsRow tabCount={3} applying onApply={vi.fn()} noun="document" />);
    expect(row().disabled).toBe(true);
    expect(row().getAttribute('aria-busy')).toBe('true');
    expect(row().textContent).toContain('Applying…');
  });

  it('notes that locked tabs keep their style and undo restores every tab', () => {
    render(<ApplyToAllTabsRow tabCount={3} applying={false} onApply={vi.fn()} noun="document" />);
    expect(
      screen.getByText('Locked tabs keep their own style. Undo puts every tab back.'),
    ).toBeTruthy();
  });
});
