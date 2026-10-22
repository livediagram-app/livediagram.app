import { describe, expect, it } from 'vitest';
import { codeSpan, fenceFor, markdownText } from './markdown';

// Names and outlines made safe in Markdown (docs/specs/027-repositories/blueprints/repository-link.md "INDEX.md",
// RL32).

describe('markdownText', () => {
  it('escapes every character Markdown reads, and a leading list marker', () => {
    expect(markdownText('a\\b `c` *d* _e_ [f] <g> #h |i| ~j')).toBe(
      'a\\\\b \\`c\\` \\*d\\* \\_e\\_ \\[f\\] \\<g\\> \\#h \\|i\\| \\~j',
    );
    expect(markdownText('- item')).toBe('\\- item');
    expect(markdownText('+ item')).toBe('\\+ item');
    expect(markdownText('12. Steps')).toBe('12\\. Steps');
    expect(markdownText('Home screen 2.0')).toBe('Home screen 2.0');
  });
});

describe('codeSpan', () => {
  it('wraps in a backtick run one longer than the longest inside, padded beside a backtick', () => {
    expect(codeSpan('tab a "Flow" · 3 elements')).toBe('`tab a "Flow" · 3 elements`');
    expect(codeSpan('a `b` c')).toBe('``a `b` c``');
    expect(codeSpan('`x``')).toBe('``` `x`` ```');
  });
});

describe('fenceFor', () => {
  it('is three backticks, or one more than the longest run in the text', () => {
    expect(fenceFor('no ticks')).toBe('```');
    expect(fenceFor('a ``` b')).toBe('````');
    expect(fenceFor('a ````` b')).toBe('``````');
  });
});
