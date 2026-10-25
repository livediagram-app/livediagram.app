import { describe, expect, it } from 'vitest';
import { embedUrlFor } from './embed';

describe('embedUrlFor', () => {
  it('builds the query-form embed URL on the given origin', () => {
    expect(embedUrlFor('https://live.test', 'abc123')).toBe('https://live.test/embed?s=abc123');
  });

  it('works for any origin (docs/specs/013-workspace/embeds.md)', () => {
    expect(embedUrlFor('https://editor.internal.example', 'abc123')).toBe(
      'https://editor.internal.example/embed?s=abc123',
    );
  });

  it('URL-encodes the share code', () => {
    expect(embedUrlFor('https://live.test', 'a/b?c')).toBe('https://live.test/embed?s=a%2Fb%3Fc');
  });
});
