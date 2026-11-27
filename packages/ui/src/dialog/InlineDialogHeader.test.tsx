// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { InlineDialogHeader } from './InlineDialogHeader';

// liveworkspace/docs/specs/004-index/footer-tools-menu.md "Opening a tool inside Tools": Tools' band is the tool's one
// heading, so the dialog's own title only labels it (Work Tracker 1476).
describe('a dialog header drawn inside Tools', () => {
  function region(actions?: ReactNode) {
    return render(
      <div role="region" aria-labelledby="t">
        <InlineDialogHeader
          titleId="t"
          title="History"
          subtitle="Who changed what"
          actions={actions}
        />
      </div>,
    );
  }

  it('adds no second heading, the dialog keeping its name', () => {
    region();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByRole('region', { name: 'History' })).toBeTruthy();
  });

  it('keeps its actions with the label beside them', () => {
    region(<button type="button">Clear</button>);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByRole('region', { name: 'History' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy();
  });

  it('draws nothing without an id to label', () => {
    const { container } = render(<InlineDialogHeader title="History" />);
    expect(container.textContent).toBe('');
  });
});
