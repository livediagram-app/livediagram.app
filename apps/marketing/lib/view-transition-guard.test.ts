import { describe, expect, it, vi } from 'vitest';

import { VIEW_TRANSITION_GUARD_SCRIPT } from './view-transition-guard';

const ORIGIN = 'https://livediagram.app';

// Runs the inline script against a stub window and swaps the page to `url`.
function swapTo(url: string, withTransition = true) {
  let listener: ((e: unknown) => void) | undefined;
  const addEventListener = (type: string, fn: (e: unknown) => void) => {
    if (type === 'pageswap') listener = fn;
  };
  const debug = vi.fn();
  new Function('addEventListener', 'location', 'console', VIEW_TRANSITION_GUARD_SCRIPT)(
    addEventListener,
    { origin: ORIGIN },
    { debug },
  );
  const skipTransition = vi.fn();
  listener!({
    viewTransition: withTransition ? { skipTransition } : null,
    activation: { entry: { url } },
  });
  return { skipTransition, debug };
}

describe('the view transition guard', () => {
  it('keeps the crossfade between two marketing pages', () => {
    expect(swapTo(`${ORIGIN}/features/diagrams`).skipTransition).not.toHaveBeenCalled();
    expect(swapTo(`${ORIGIN}/`).skipTransition).not.toHaveBeenCalled();
  });

  it('skips it into the editor, the help centre and the dashboard, and says so', () => {
    for (const path of [
      '/new?via=Home.Hero',
      '/document/abc',
      '/explorer',
      '/help/tabs',
      '/telemetry',
    ]) {
      const { skipTransition, debug } = swapTo(`${ORIGIN}${path}`);
      expect(skipTransition).toHaveBeenCalledTimes(1);
      expect(debug).toHaveBeenCalledWith(
        expect.stringContaining('[motion] view transition skipped'),
      );
    }
  });

  it('does nothing when the browser started no transition', () => {
    expect(() => swapTo(`${ORIGIN}/new`, false)).not.toThrow();
  });
});
