// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { flowViewOn, toggleFlowView } from '@/lib/flow-view-store';
import { FlowClusterSegment } from './FlowClusterSegment';

// docs/specs/007-editor/wireframe-pages.md "Flow view": the cluster switch, pressed while the view is on. It takes no
// role: CanvasChrome draws it for an Editor, a Participant and a Viewer alike.
afterEach(() => {
  cleanup();
  if (flowViewOn()) act(() => toggleFlowView());
});

describe('the Flow View switch', () => {
  it('turns the Flow view on and off and says whether it is on', () => {
    render(<FlowClusterSegment />);
    const button = screen.getByRole('button', { name: 'Flow View' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button);
    expect(flowViewOn()).toBe(true);
    expect(screen.getByRole('button', { name: 'Flow View' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Flow View' }));
    expect(flowViewOn()).toBe(false);
  });
});
