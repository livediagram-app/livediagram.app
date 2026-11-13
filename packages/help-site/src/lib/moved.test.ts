import { describe, expect, it } from 'vitest';
import { addToPlanMoved, powerUserModeMoved, privacyPolicyMoved, termsMoved } from './moved';

// The help centre's moved policy stubs (docs/specs/018-help/help-pages.md) say what the marketing site's stubs say
// (@liveworkspace/marketing-site's legal-moved.ts), in a sentence that reads: "the terms ... are", never "is".
describe('moved policy stubs', () => {
  it('words the terms stub as the marketing site does', () => {
    const help = termsMoved('livedesign');
    expect(help.metadata.description).toBe(
      "The terms of use for livedesign are liveworkspace's, on liveworkspace.app.",
    );
    expect(help.label).toBe('terms of use');
    expect(help.href).toBe('https://www.liveworkspace.app/terms');
  });

  it('keeps the privacy policy singular', () => {
    expect(privacyPolicyMoved('livedesign').metadata.description).toBe(
      "The privacy policy for livedesign is liveworkspace's, on liveworkspace.app.",
    );
  });
});

describe('moved Power User Mode stub', () => {
  it('sends the retired article to Settings, noindex', () => {
    expect(powerUserModeMoved.href).toBe('/help/user-interface/settings/');
    expect(powerUserModeMoved.metadata.robots).toEqual({ index: false, follow: true });
  });
});

describe('moved Add to Plan stub', () => {
  it('sends the retired article to Using Tabs, noindex', () => {
    expect(addToPlanMoved.href).toBe('/help/tabs/using-tabs/#tabs-in-more-than-one-plan');
    expect(addToPlanMoved.metadata.robots).toEqual({ index: false, follow: true });
  });
});
