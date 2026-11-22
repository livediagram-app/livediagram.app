import { describe, expect, it } from 'vitest';
import { agentCoverOf, parseAgentCover } from './cover';
import { parsePagesRequest } from './parse';

// docs/specs/030-knowledgebase/page-surface.md "The cover"; docs/specs/024-agents/knowledgebase-for-agents.md.
describe('an agent’s cover', () => {
  it('takes a picture, a theme gradient by preset, an animated background, or null', () => {
    expect(parseAgentCover({ kind: 'image', imageId: 'img_a' })).toEqual({
      cover: { imageId: 'img_a' },
    });
    expect(parseAgentCover({ kind: 'image', imageId: 'img_a', focus: 0 })).toEqual({
      cover: { imageId: 'img_a', focus: 0 },
    });
    expect(parseAgentCover({ kind: 'image', imageId: 'img_a', focus: 50 })).toEqual({
      cover: { imageId: 'img_a' },
    });
    expect(parseAgentCover({ kind: 'gradient', preset: 'theme-dusk' })).toEqual({
      cover: { gradient: 'theme-dusk' },
    });
    expect(parseAgentCover({ kind: 'animated', preset: 'aurora' })).toEqual({
      cover: { motion: 'aurora', colouring: 'deep' },
    });
    expect(
      parseAgentCover({ kind: 'animated', preset: 'waves', colouring: 'soft', speed: 0.5 }),
    ).toEqual({
      cover: { motion: 'waves', colouring: 'soft', speed: 0.5 },
    });
    expect(parseAgentCover({ kind: 'animated', preset: 'waves', speed: 1 })).toEqual({
      cover: { motion: 'waves', colouring: 'deep' },
    });
    expect(parseAgentCover(null)).toEqual({ cover: null });
  });

  it.each([
    [[], 'Send cover as'],
    [{}, 'Send cover as'],
    [{ imageId: 'img_a' }, 'Send cover as'],
    [{ kind: 'gradient', preset: 'Sunrise' }, 'cover.preset is one of theme-dawn'],
    [{ kind: 'gradient', preset: 'theme-ink', focus: 1 }, 'takes no "focus"'],
    [{ kind: 'animated', preset: 'twirl' }, 'cover.preset is one of flow'],
    [{ kind: 'animated', preset: 'aurora', colouring: 'plaid' }, 'cover.colouring is one of deep'],
    [{ kind: 'animated', preset: 'aurora', speed: 9 }, 'cover.speed is from 0.25 to 3'],
    [{ kind: 'animated', preset: 'aurora', from: '#fff' }, 'takes no "from"'],
    [{ kind: 'image', imageId: 4 }, 'cover.imageId'],
    [{ kind: 'image', imageId: 'img a' }, 'cover.imageId'],
    [{ kind: 'image', imageId: 'data:image/png;base64,AA' }, 'cover.imageId'],
    [{ kind: 'image', imageId: 'img_a', focus: -1 }, 'cover.focus'],
    [{ kind: 'image', imageId: 'img_a', focus: 3.5 }, 'cover.focus'],
    [{ kind: 'image', imageId: 'img_a', credit: 'me' }, 'takes no "credit"'],
  ])('refuses %j, saying what was wrong', (raw, says) => {
    const read = parseAgentCover(raw);
    expect('refusal' in read && read.refusal.code).toBe('invalid_cover');
    expect('refusal' in read && read.refusal.message).toContain(says);
  });

  it('reads a stored cover back as an agent names it, with its kind', () => {
    expect(agentCoverOf(undefined)).toBeUndefined();
    expect(agentCoverOf({ imageId: 'img_a', focus: 10, credit: 'c' })).toEqual({
      kind: 'image',
      imageId: 'img_a',
      focus: 10,
    });
    expect(agentCoverOf({ imageId: 'img_a' })).toEqual({ kind: 'image', imageId: 'img_a' });
    expect(agentCoverOf({ gradient: 'theme-dawn' })).toEqual({
      kind: 'gradient',
      preset: 'theme-dawn',
    });
    expect(agentCoverOf({ motion: 'aurora', colouring: 'mist', speed: 2 })).toEqual({
      kind: 'animated',
      preset: 'aurora',
      colouring: 'mist',
      speed: 2,
    });
    expect(agentCoverOf({ motion: 'aurora', colouring: 'mist' })).toEqual({
      kind: 'animated',
      preset: 'aurora',
      colouring: 'mist',
    });
  });
});

describe('a Pages request with a cover', () => {
  it('takes a cover alone, or beside an article write', () => {
    expect(parsePagesRequest({ cover: null })).toEqual({ cover: null });
    expect(
      parsePagesRequest({
        article: { markdown: 'Hi' },
        cover: { kind: 'image', imageId: 'img_a' },
      }),
    ).toEqual({ article: { markdown: 'Hi' }, cover: { imageId: 'img_a' } });
  });

  it('refuses a bad cover by name, and a cover beside anything else', () => {
    expect(parsePagesRequest({ cover: { kind: 'gradient', preset: 'Plaid' } })).toMatchObject({
      refusal: { code: 'invalid_cover' },
    });
    expect(parsePagesRequest({ cover: null, extra: 1 })).toMatchObject({
      refusal: { code: 'invalid_value' },
    });
  });
});
