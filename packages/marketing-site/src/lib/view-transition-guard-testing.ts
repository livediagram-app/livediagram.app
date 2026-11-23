import { describe, expect, it, vi } from 'vitest';
import { runInlineScript } from '@liveworkspace/vitest-config/inline-script';
import { viewTransitionGuardScript } from './view-transition-guard';

// Every product's marketing test of the view transition guard, bound to the product's other apps as its layout
// binds it (its api-schema's NON_MARKETING_SEGMENTS), run by its lib/view-transition-guard.test.ts.
export function describeViewTransitionGuard(f: {
  /** The product's NON_MARKETING_SEGMENTS. */
  segments: Parameters<typeof viewTransitionGuardScript>[0];
  /** The product's name: its site is `https://www.<product>.app`. */
  product: string;
  /** One of its feature pages, and one of its editor's item pages. */
  featurePath: string;
  itemPath: string;
}): void {
  const script = viewTransitionGuardScript(f.segments);
  const ORIGIN = `https://www.${f.product}.app`;

  // Runs the inline script against a stub window and swaps the page to `url`.
  function swapTo(url: string, withTransition = true) {
    let listener: ((e: unknown) => void) | undefined;
    const addEventListener = (type: string, fn: (e: unknown) => void) => {
      if (type === 'pageswap') listener = fn;
    };
    const debug = vi.fn();
    runInlineScript(script, {
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
      expect(swapTo(`${ORIGIN}${f.featurePath}`).skipTransition).not.toHaveBeenCalled();
      expect(swapTo(`${ORIGIN}/`).skipTransition).not.toHaveBeenCalled();
    });

    it('skips it into the editor, the help centre and the dashboard, and says so', () => {
      for (const path of [
        '/new?via=Home.Hero',
        f.itemPath,
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
}
