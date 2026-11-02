// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LockBadge } from './element-parts';
import { SuppressElementIndicators } from './ElementIndicatorStyleContext';

// docs/specs/008-canvas/element-indicators.md "Unchanged": a presented slide (and an embed) draws no editor
// chrome on its elements, the lock badge included.

afterEach(cleanup);

describe('LockBadge', () => {
  it('shows on a locked element in the editor', () => {
    const { container } = render(<LockBadge />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('hides while the surface suppresses indicators (presenting, an embed)', () => {
    const { container } = render(
      <SuppressElementIndicators when>
        <LockBadge />
      </SuppressElementIndicators>,
    );
    expect(container.innerHTML).toBe('');
  });
});
