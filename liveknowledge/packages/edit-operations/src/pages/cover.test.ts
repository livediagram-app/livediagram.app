import { describe, expect, it } from 'vitest';
import { agentCoverOf, parseAgentCover } from './cover';
import { parsePagesRequest } from './parse';

// docs/specs/030-knowledgebase/page-surface.md "The cover"; docs/specs/024-agents/knowledgebase-for-agents.md.
describe('an agent’s cover', () => {
  it('takes a picture with or without its focus, a gradient by name, or null', () => {
    expect(parseAgentCover({ imageId: 'img_a' })).toEqual({ cover: { imageId: 'img_a' } });
    expect(parseAgentCover({ imageId: 'img_a', focus: 0 })).toEqual({
      cover: { imageId: 'img_a', focus: 0 },
    });
    expect(parseAgentCover({ imageId: 'img_a', focus: 50 })).toEqual({
      cover: { imageId: 'img_a' },
    });
    expect(parseAgentCover({ gradient: 'Night' })).toMatchObject({
      cover: { fill: { kind: 'gradient', from: '#0f172a', to: '#1e3a8a' } },
    });
    expect(parseAgentCover(null)).toEqual({ cover: null });
  });

  it.each([
    [[], 'Send cover as'],
    [{}, 'Send cover as'],
    [{ gradient: 7 }, 'cover.gradient is one of Sunrise'],
    [{ gradient: 'Ocean', focus: 1 }, 'alone'],
    [{ imageId: 4 }, 'cover.imageId'],
    [{ imageId: 'img a' }, 'cover.imageId'],
    [{ imageId: 'img_a', focus: -1 }, 'cover.focus'],
    [{ imageId: 'img_a', focus: 3.5 }, 'cover.focus'],
    [{ imageId: 'img_a', credit: 'me' }, 'takes no "credit"'],
  ])('refuses %j, saying what was wrong', (raw, says) => {
    const read = parseAgentCover(raw);
    expect('refusal' in read && read.refusal.code).toBe('invalid_cover');
    expect('refusal' in read && read.refusal.message).toContain(says);
  });

  it('reads a stored cover back as an agent names it', () => {
    expect(agentCoverOf(undefined)).toBeUndefined();
    expect(agentCoverOf({ imageId: 'img_a', focus: 10, credit: 'c' })).toEqual({
      imageId: 'img_a',
      focus: 10,
    });
    expect(agentCoverOf({ imageId: 'img_a' })).toEqual({ imageId: 'img_a' });
    expect(
      agentCoverOf({ fill: { kind: 'gradient', from: '#fde68a', to: '#fca5a5', angle: 160 } }),
    ).toEqual({
      gradient: 'Sunrise',
    });
    expect(agentCoverOf({ fill: { kind: 'solid', color: '#ffffff' } })).toBeUndefined();
  });
});

describe('a Pages request with a cover', () => {
  it('takes a cover alone, or beside an article write', () => {
    expect(parsePagesRequest({ cover: null })).toEqual({ cover: null });
    expect(parsePagesRequest({ article: { markdown: 'Hi' }, cover: { imageId: 'img_a' } })).toEqual(
      {
        article: { markdown: 'Hi' },
        cover: { imageId: 'img_a' },
      },
    );
  });

  it('refuses a bad cover by name, and a cover beside anything else', () => {
    expect(parsePagesRequest({ cover: { gradient: 'Plaid' } })).toMatchObject({
      refusal: { code: 'invalid_cover' },
    });
    expect(parsePagesRequest({ cover: null, extra: 1 })).toMatchObject({
      refusal: { code: 'invalid_value' },
    });
  });
});
