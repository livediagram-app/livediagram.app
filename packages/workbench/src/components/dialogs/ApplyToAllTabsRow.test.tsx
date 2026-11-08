// @vitest-environment jsdom
// The Tab Style home's last row (docs/specs/011-theme/canvas-and-theme-dialog.md "Apply to All Tabs").
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApplyToAllTabsRow } from './ApplyToAllTabsRow';

const row = () => screen.getByRole<HTMLButtonElement>('button', { name: /Apply to All Tabs/ });

describe('ApplyToAllTabsRow', () => {
  it('applies on a press, saying how many other tabs it reaches', () => {
    const onApply = vi.fn();
    render(<ApplyToAllTabsRow tabCount={4} applying={false} onApply={onApply} />);
    expect(row().textContent).toContain('Give the other 3 tabs this tab');
    expect(row().className).toContain('cursor-pointer');
    fireEvent.click(row());
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('names a single other tab in the singular', () => {
    render(<ApplyToAllTabsRow tabCount={2} applying={false} onApply={vi.fn()} />);
    expect(row().textContent).toContain('Give the other tab this tab');
  });

  it('shows nothing when the document has one tab', () => {
    const { container } = render(
      <ApplyToAllTabsRow tabCount={1} applying={false} onApply={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows it is busy and takes no second press while applying', () => {
    render(<ApplyToAllTabsRow tabCount={3} applying onApply={vi.fn()} />);
    expect(row().disabled).toBe(true);
    expect(row().getAttribute('aria-busy')).toBe('true');
    expect(row().textContent).toContain('Applying…');
  });

  it('notes that locked tabs keep their style and undo restores every tab', () => {
    render(<ApplyToAllTabsRow tabCount={3} applying={false} onApply={vi.fn()} />);
    expect(
      screen.getByText('Locked tabs keep their own style. Undo puts every tab back.'),
    ).toBeTruthy();
  });

  // An app with no tab locks (livehuddle) names none.
  it('says nothing of locked tabs in an app that cannot lock them', () => {
    render(<ApplyToAllTabsRow tabCount={3} applying={false} onApply={vi.fn()} tabLocks={false} />);
    expect(screen.getByText('Undo puts every tab back.')).toBeTruthy();
    expect(screen.queryByText(/Locked tabs/)).toBeNull();
  });
});
