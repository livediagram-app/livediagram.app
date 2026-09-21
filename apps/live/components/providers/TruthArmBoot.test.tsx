// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TRUTH_ARMED_KEY } from '@/lib/photo-truth';
import { TruthArmBoot } from './TruthArmBoot';

// Arming the ground-truth export (docs/vision/sticky-detection.md). It has to
// happen at APP LOAD, on whatever page the parameter was typed on: the editor
// is reached from /new, and by the time a photo has been imported and the
// review has boxes on it the URL is /diagram/<id>/ with no parameter on it at
// all. Arming from the review surface therefore never fired, which is exactly
// how this shipped broken the first time.
describe('TruthArmBoot', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('arms from the parameter on the page it was typed on', () => {
    window.history.replaceState({}, '', '/new/?truth=1');
    render(<TruthArmBoot />);
    expect(localStorage.getItem(TRUTH_ARMED_KEY)).toBe('1');
  });

  it('disarms on ?truth=0', () => {
    localStorage.setItem(TRUTH_ARMED_KEY, '1');
    window.history.replaceState({}, '', '/diagram/abc/?truth=0');
    render(<TruthArmBoot />);
    expect(localStorage.getItem(TRUTH_ARMED_KEY)).toBeNull();
  });

  it('leaves an armed browser armed on every other page', () => {
    localStorage.setItem(TRUTH_ARMED_KEY, '1');
    window.history.replaceState({}, '', '/explorer/');
    render(<TruthArmBoot />);
    expect(localStorage.getItem(TRUTH_ARMED_KEY)).toBe('1');
  });

  it('renders nothing at all', () => {
    const { container } = render(<TruthArmBoot />);
    expect(container.innerHTML).toBe('');
  });
});
