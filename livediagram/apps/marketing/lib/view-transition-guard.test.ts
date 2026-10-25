import { describe, expect, it, vi } from 'vitest';
import { runInlineScript } from '@liveworkspace/vitest-config/inline-script';

import { NON_MARKETING_SEGMENTS } from '@livediagram/api-schema';
import { viewTransitionGuardScript } from '@liveworkspace/marketing-site/lib/view-transition-guard';

// The shared guard, bound to this product's other apps as its layout binds it.
const VIEW_TRANSITION_GUARD_SCRIPT = viewTransitionGuardScript(NON_MARKETING_SEGMENTS);

const ORIGIN = 'https://livediagram-router.liveworkspace-easing509.workers.dev';

// Runs the inline script against a stub window and swaps the page to `url`.
function swapTo(url: string, withTransition = true) {
  let listener: ((e: unknown) => void) | undefined;
  const addEventListener = (type: string, fn: (e: unknown) => void) => {
    if (type === 'pageswap') listener = fn;
  };
  const debug = vi.fn();
  runInlineScript(VIEW_TRANSITION_GUARD_SCRIPT, {
    addEventListener,
    location: { origin: ORIGIN },
    URL,
    console: { debug },
  });
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
