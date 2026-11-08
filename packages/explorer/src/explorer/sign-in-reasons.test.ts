import { describe, expect, it } from 'vitest';
import { signInReasons } from './sign-in-reasons';

// liveworkspace/docs/specs/010-site/site.md "Guests": Learn More's agents row is the app's own.
describe('signInReasons', () => {
  const words = { lowerMany: 'spaces' };

  it('offers AI assistants over MCP in an app that has an MCP server', () => {
    for (const app of ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'] as const) {
      const titles = signInReasons(app, words).map((r) => r.title);
      expect(titles).toContain('Connect AI tools');
      expect(titles).not.toContain('Use the API');
    }
  });

  it('offers the API, and never MCP, in livehuddle', () => {
    const reasons = signInReasons('livehuddle', words);
    expect(reasons.map((r) => r.title)).toEqual([
      'Keep your spaces safe',
      'Open them anywhere',
      'Work as a team',
      'Use the API',
      'Use your real name',
    ]);
    expect(reasons.some((r) => /MCP|AI assistants/.test(r.body))).toBe(false);
    expect(reasons[3]!.body).toBe(
      'Make API tokens, so your own scripts can read and build your spaces.',
    );
  });
});
