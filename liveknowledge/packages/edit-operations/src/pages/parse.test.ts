import { describe, expect, it } from 'vitest';
import { ARTICLE_MARKDOWN_MAX } from '@liveknowledge/document';
import { parsePagesRequest } from './parse';

// docs/specs/024-agents/blueprints/pages-for-agents.md "Interfaces and contracts".

const refusal = (raw: unknown) => {
  const out = parsePagesRequest(raw);
  if (!('refusal' in out)) throw new Error('expected a refusal');
  return out.refusal;
};

describe('the body', () => {
  it('takes exactly one of pages or article', () => {
    expect(refusal(null).code).toBe('invalid_body');
    expect(refusal([]).code).toBe('invalid_body');
    expect(refusal({}).code).toBe('invalid_body');
    expect(refusal({ pages: [], article: { markdown: '' } }).code).toBe('invalid_body');
    expect(refusal({ pages: [{ op: 'delete', page: 1 }], extra: 1 }).message).toContain('"extra"');
  });

  // docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The continuous page".
  it('refuses page changes whole: a page is one page of writing', () => {
    for (const pages of [[{ op: 'add', kind: 'slide' }], [{ op: 'delete', page: 1 }], [], 'x']) {
      const out = refusal({ pages });
      expect(out.code).toBe('kind_not_offered');
      expect(out.message).toContain('write_article');
    }
  });

  it('rethrows what is not a refusal', () => {
    const hostile = {
      get article() {
        throw new TypeError('boom');
      },
    };
    expect(() => parsePagesRequest(hostile)).toThrow('boom');
  });
});

describe('an article write', () => {
  it('reads every field', () => {
    expect(
      parsePagesRequest({
        article: {
          markdown: '# Hi',
          article: 'Brief',
          mode: 'append',
          look: 'report',
          accent: '#ff0066',
        },
      }),
    ).toEqual({
      article: {
        markdown: '# Hi',
        article: 'Brief',
        mode: 'append',
        look: 'report',
        accent: '#ff0066',
      },
    });
    expect(parsePagesRequest({ article: { markdown: '' } })).toEqual({ article: { markdown: '' } });
  });

  it('refuses a malformed write', () => {
    const at = (article: unknown) => refusal({ article });
    expect(at('text').message).toContain('object');
    expect(at({}).message).toContain('"markdown"');
    expect(at({ markdown: 'x', mode: 'merge' }).message).toContain('"mode"');
    expect(at({ markdown: 'x', article: 7 }).message).toContain('is text');
    expect(at({ markdown: 'x', article: 'a'.repeat(201) }).message).toContain('at most 200');
    // A page holds one article on the continuous page: no new article, paper size, turn or page numbers.
    for (const field of ['new', 'size', 'orientation', 'pageNumbers'])
      expect(at({ markdown: 'x', [field]: true }).message).toContain(`takes no "${field}"`);
    expect(at({ markdown: 'x', accent: 'pink' }).message).toContain('hex');
    expect(at({ markdown: 'x', look: 'fancy' }).message).toContain('"look"');
    expect(at({ markdown: 'x', title: 'T' }).message).toContain('takes no "title"');
  });

  it('refuses Markdown past the cap as too large, pointing at append', () => {
    const out = at({ markdown: 'x'.repeat(ARTICLE_MARKDOWN_MAX + 1) });
    expect(out.code).toBe('article_too_large');
    expect(out.message).toContain('append');
  });
});

function at(article: unknown) {
  return refusal({ article });
}
