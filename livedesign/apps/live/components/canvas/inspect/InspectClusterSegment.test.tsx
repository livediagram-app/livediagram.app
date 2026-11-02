// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InspectClusterSegment } from './InspectClusterSegment';

// docs/specs/007-editor/wireframe-pages.md "Inspect": the cluster button turns Inspect on and off.
afterEach(cleanup);

describe('the Inspect button', () => {
  it('toggles Inspect and shows whether it is on', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<InspectClusterSegment active={false} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Inspect' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
    rerender(<InspectClusterSegment active onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: 'Inspect' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
  });
});
