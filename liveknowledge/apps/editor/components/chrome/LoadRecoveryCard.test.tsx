// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { LoadRecoveryCard } from './LoadRecoveryCard';

// docs/specs/007-editor/load-recovery.md "The recovery card".
describe('LoadRecoveryCard', () => {
  it('offers diagnostics, a repair and the troubleshooting article', () => {
    render(<LoadRecoveryCard ownerId={null} />);
    expect(screen.getByRole('button', { name: /copy diagnostics/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /repair this browser/i })).toBeTruthy();
    const link = screen.getByRole('link', { name: /troubleshooting steps/i });
    expect(link.getAttribute('href')).toContain('/help/troubleshooting/document-not-loading/');
  });
});
