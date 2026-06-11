import { describe, expect, it } from 'vitest';
import { buildEmbedSnippet, embedUrlFor } from './embed';

describe('embedUrlFor', () => {
  it('builds the query-form embed URL on the given origin', () => {
    expect(embedUrlFor('https://livediagram.app', 'abc123')).toBe(
      'https://livediagram.app/embed?s=abc123',
    );
  });

  it('works for self-hosted origins (spec/33 self-hosting)', () => {
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

describe('buildEmbedSnippet', () => {
  it('emits an iframe pointing at the embed URL with the default size', () => {
    const snippet = buildEmbedSnippet('https://livediagram.app', 'abc123');
    expect(snippet).toContain('src="https://livediagram.app/embed?s=abc123"');
    expect(snippet).toContain('width="800"');
    expect(snippet).toContain('height="500"');
    expect(snippet).toContain('allowfullscreen');
    expect(snippet.startsWith('<iframe ')).toBe(true);
    expect(snippet.endsWith('</iframe>')).toBe(true);
  });
});
