// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PRESENTATION_CONFIG } from '@/lib/presentation-config';
import { PresentationSettings } from './PresentationSettings';

// docs/specs/012-collaboration/presentation-mode.md "Settings": the cog in a running presentation keeps Transition,
// Speed and the two clocks; the rest lives in Settings > Presenting.

afterEach(cleanup);

describe('PresentationSettings', () => {
  it('offers only what is changed in front of the room', () => {
    render(<PresentationSettings config={DEFAULT_PRESENTATION_CONFIG} onChange={vi.fn()} />);
    for (const name of ['Show Elapsed Time', 'Show Slide Budget'])
      expect(screen.getByText(name)).toBeTruthy();
    for (const gone of [
      'Click to Advance',
      'Loop the Deck',
      'Keep Controls Visible',
      'Hide the Pointer',
    ])
      expect(screen.queryByText(gone)).toBeNull();
    expect(screen.queryByText('Fill Screen')).toBeNull();
    expect(screen.getByText(/in Settings, under Presenting/)).toBeTruthy();
  });

  it('changes the transition', () => {
    const onChange = vi.fn();
    render(<PresentationSettings config={DEFAULT_PRESENTATION_CONFIG} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fade' }));
    expect(onChange).toHaveBeenCalledWith({ transition: 'fade' });
  });
});
