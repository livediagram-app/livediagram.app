import { describe, expect, it } from 'vitest';
import { privacyPolicyMoved, termsMoved } from './moved';

// The help centre's moved policy stubs (docs/specs/018-help/help-pages.md) say what the marketing site's stubs say
// (@liveworkspace/marketing-site's legal-moved.ts), in a sentence that reads: "the terms ... are", never "is".
describe('moved policy stubs', () => {
  it('words the terms stub as the marketing site does', () => {
    const help = termsMoved('livedesign');
    expect(help.metadata.description).toBe(
      "The terms of use for livedesign are liveworkspace's, on liveworkspace.app.",
    );
    expect(help.label).toBe('terms of use');
    expect(help.href).toBe('https://liveworkspace.app/terms');
  });

  it('keeps the privacy policy singular', () => {
    expect(privacyPolicyMoved('livedesign').metadata.description).toBe(
      "The privacy policy for livedesign is liveworkspace's, on liveworkspace.app.",
    );
  });
});
