// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMask, maskBounds } from '@livedesign/photo-engine';
import { photoView } from './photo-view-test-utils';
import { SelectAndMaskDialog } from './SelectAndMaskDialog';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/031-photo/photo-tools.md "Smart selections" Refining: the Select and Mask dialog.
afterEach(cleanup);

describe('the Select and Mask dialog', () => {
  it('works the selection by its settings and keeps it on OK', async () => {
    const { view, s } = photoView();
    s.selection = createMask({ x: 4, y: 4, width: 6, height: 4 }, 255);
    const onClose = vi.fn();
    render(<SelectAndMaskDialog photo={view} onClose={onClose} />);
    expect(screen.getByRole('img', { name: 'The selection' })).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Refine Edge Brush' }));
    expect(
      screen.getByRole('img', { name: 'The selection: paint over an edge to refine it' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(s.selection && maskBounds(s.selection)).toEqual({ x: 4, y: 4, width: 6, height: 4 });
  });
});
