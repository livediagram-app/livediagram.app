import { describe, expect, it } from 'vitest';
import { embedUrlFor } from './embed';

describe('embedUrlFor', () => {
  it('builds the query-form embed URL on the given origin', () => {
    expect(embedUrlFor('https://livediagram.app', 'abc123')).toBe(
      'https://livediagram.app/embed?s=abc123',
    );
  });

  it('works for any origin (docs/specs/013-workspace/embeds.md)', () => {
    expect(embedUrlFor('https://diagrams.internal.example', 'abc123')).toBe(
      'https://diagrams.internal.example/embed?s=abc123',
    );
  });

  it('URL-encodes the share code', () => {
    expect(embedUrlFor('https://livediagram.app', 'a/b?c')).toBe(
      'https://livediagram.app/embed?s=a%2Fb%3Fc',
    );
  });
});
