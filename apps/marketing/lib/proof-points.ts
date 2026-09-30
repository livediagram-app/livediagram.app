// The hero's proof points (docs/specs/019-marketing/marketing-site.md's golden rule: each true
// today): no paid tier, the canvas works signed out, edits land live, and the repo is MIT. They sit
// on the hero stage's launch window (components/hero-launch.tsx); Hero renders them for screen
// readers too, since the stage is decorative.
export const PROOF_POINTS = [
  'Free for everyone',
  'No sign-up',
  'Real-time collaboration',
  'Open source (MIT)',
] as const;

export type ProofPoint = (typeof PROOF_POINTS)[number];
