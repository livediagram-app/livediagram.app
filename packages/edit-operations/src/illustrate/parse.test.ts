import { describe, expect, it } from 'vitest';
import { ARTICLE_MARKDOWN_MAX } from '@livediagram/document';
import { parseIllustrateRequest } from './parse';

// docs/specs/024-agents/blueprints/illustrate-for-agents.md "Interfaces and contracts".

const refusal = (raw: unknown) => {
  const out = parseIllustrateRequest(raw);
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

  it('takes 1 to 50 page changes', () => {
    expect(refusal({ pages: [] }).code).toBe('invalid_body');
    expect(refusal({ pages: Array(51).fill({ op: 'delete', page: 1 }) }).code).toBe('invalid_body');
    expect(refusal({ pages: 'x' }).code).toBe('invalid_body');
  });

  it('rethrows what is not a refusal', () => {
    const hostile = {
      get pages() {
        throw new TypeError('boom');
      },
    };
    expect(() => parseIllustrateRequest(hostile)).toThrow('boom');
  });
});

describe('page changes', () => {
  it('reads every change with its fields', () => {
    const out = parseIllustrateRequest({
      pages: [
        {
          op: 'add',
          kind: 'slide',
          size: 'slide',
          orientation: 'landscape',
          name: 'Cover',
          background: { gradient: ['#000000', '#ffffff'], angle: -90, pattern: 'none' },
          layout: 'title',
          at: 1,
        },
        { op: 'set', page: 'Cover', locked: false, background: { paper: true } },
        { op: 'set', page: 2, background: { color: '#abc', pattern: 'dots' } },
        { op: 'layout', page: 'page-1', layout: 'quote' },
        { op: 'move', page: 1, to: 3 },
        { op: 'duplicate', page: '2' },
        { op: 'delete', page: 3 },
      ],
    });
    expect(out).toEqual({
      pages: [
        {
          op: 'add',
          kind: 'slide',
          size: 'slide',
          orientation: 'landscape',
          name: 'Cover',
          background: { gradient: ['#000000', '#ffffff'], angle: 270, pattern: 'none' },
          layout: 'title',
          at: 1,
        },
        { op: 'set', page: 'Cover', locked: false, background: { paper: true } },
        { op: 'set', page: 2, background: { color: '#abc', pattern: 'dots' } },
        { op: 'layout', page: 'page-1', layout: 'quote' },
        { op: 'move', page: 1, to: 3 },
        { op: 'duplicate', page: '2' },
        { op: 'delete', page: 3 },
      ],
    });
  });

  it('refuses each malformed field by name, at its change', () => {
    const at = (change: unknown) => refusal({ pages: [{ op: 'delete', page: 1 }, change] });
    expect(at('x')).toMatchObject({ code: 'invalid_value', change: 1 });
    expect(at({ op: 'fly' }).message).toContain('"op" is one of');
    expect(at({ op: 'add', kind: 'poster' }).message).toContain('"kind"');
    expect(at({ op: 'add', kind: 'slide', size: 'huge' }).message).toContain('"size"');
    expect(at({ op: 'add', kind: 'slide', orientation: 'up' }).message).toContain('"orientation"');
    expect(at({ op: 'add', kind: 'slide', name: 3 }).message).toContain('"name" is text');
    expect(at({ op: 'add', kind: 'slide', name: 'x'.repeat(61) }).message).toContain('at most 60');
    expect(at({ op: 'add', kind: 'slide', at: 0 }).message).toContain('"at"');
    expect(at({ op: 'add', kind: 'slide', colour: 'x' }).message).toContain('takes no "colour"');
    expect(at({ op: 'set', page: 0, name: 'x' }).message).toContain('page place');
    expect(at({ op: 'set', page: '', name: 'x' }).message).toContain('"page" names a page');
    expect(at({ op: 'set', page: 1 }).message).toContain('at least one');
    expect(at({ op: 'set', page: 1, locked: 'yes' }).message).toContain('"locked"');
    expect(at({ op: 'layout', page: 1 }).message).toContain('"layout" is text');
    expect(at({ op: 'move', page: 1, to: 1.5 }).message).toContain('"to"');
  });

  it('refuses a malformed background', () => {
    const bg = (background: unknown) =>
      refusal({ pages: [{ op: 'set', page: 1, background }] }).message;
    expect(bg('red')).toContain('object');
    expect(bg({})).toContain('sets a color');
    expect(bg({ color: 'red' })).toContain('hex colour');
    expect(bg({ color: '#000', paper: true })).toContain('one of color, gradient or paper');
    expect(bg({ gradient: ['#000'] })).toContain('two hex colours');
    expect(bg({ gradient: ['#000', 'x'] })).toContain('hex colour');
    expect(bg({ angle: 10 })).toContain('beside a gradient');
    expect(bg({ pattern: 'stars' })).toContain('"background.pattern"');
    expect(bg({ paper: false })).toContain('"background.paper"');
    expect(bg({ shade: 1 })).toContain('takes no "shade"');
  });
});

describe('an add without a place', () => {
  it('leaves it at the end', () => {
    expect(parseIllustrateRequest({ pages: [{ op: 'add', kind: 'logo' }] })).toEqual({
      pages: [{ op: 'add', kind: 'logo' }],
    });
  });
});

describe('an article write', () => {
  it('reads every field', () => {
    expect(
      parseIllustrateRequest({
        article: {
          markdown: '# Hi',
          article: 'Brief',
          mode: 'append',
          size: 'letter',
          orientation: 'portrait',
          look: 'report',
          accent: '#ff0066',
          pageNumbers: true,
        },
      }),
    ).toEqual({
      article: {
        markdown: '# Hi',
        article: 'Brief',
        mode: 'append',
        size: 'letter',
        orientation: 'portrait',
        look: 'report',
        accent: '#ff0066',
        pageNumbers: true,
      },
    });
    expect(parseIllustrateRequest({ article: { markdown: '', new: true } })).toEqual({
      article: { markdown: '', new: true },
    });
  });

  it('refuses a malformed write', () => {
    const at = (article: unknown) => refusal({ article });
    expect(at('text').message).toContain('object');
    expect(at({}).message).toContain('"markdown"');
    expect(at({ markdown: 'x', mode: 'merge' }).message).toContain('"mode"');
    expect(at({ markdown: 'x', new: 'yes' }).message).toContain('"new"');
    expect(at({ markdown: 'x', pageNumbers: 1 }).message).toContain('"pageNumbers"');
    expect(at({ markdown: 'x', new: true, article: 'a' }).message).toContain('not both');
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
