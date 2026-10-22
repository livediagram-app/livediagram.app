// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImportReport } from './ImportReport';

// What an import could not bring across, once the rest has landed.
afterEach(cleanup);

describe('ImportReport', () => {
  it('lists each thing left out and takes focus on Done', () => {
    const onDone = vi.fn();
    render(
      <ImportReport failures={[{ title: 'Plan Cards', message: 'Too many.' }]} onDone={onDone} />,
    );
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Plan Cards · Too many.');
    const done = screen.getByRole('button', { name: 'Done' });
    expect(document.activeElement).toBe(done);
    done.click();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
