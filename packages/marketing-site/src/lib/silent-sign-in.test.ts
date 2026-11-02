import { describe, expect, it } from 'vitest';
import { marketingSilentSignInScript } from './silent-sign-in';

describe('marketingSilentSignInScript', () => {
  it("is the shared bounce on the product's own cookies, through its API, after the page paints", () => {
    const script = marketingSilentSignInScript('ld_signed_in');
    expect(script).toContain("has('ld_signed_in','1')");
    expect(script).toContain("has('ld_signed_out','2')");
    expect(script).toContain("has('ld_silent')");
    expect(script).toContain('"/api"+\'/auth/silent?return=\'');
    // Waits for the page to load and go idle, and never stops it.
    expect(script).toContain('requestIdleCallback');
    expect(script).not.toContain('w.stop()');
  });

  it('refuses a cookie that is not a signed-in hint', () => {
    expect(() => marketingSilentSignInScript('session')).toThrow();
  });
});
