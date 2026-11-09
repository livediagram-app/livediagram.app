// Every template's preview renders without React's missing-key warning: the Website Wireframe's article screen drew
// its lines from a list with no keys, and the Start Making Pages search raised the warning (and the dev overlay)
// as its tile appeared.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TEMPLATES } from '@livedesign/templates';
import { TemplatePreview } from './template-preview';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('template previews', () => {
  it('give every listed child a key', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const t of TEMPLATES)
      renderToStaticMarkup(createElement(TemplatePreview, { kind: t.kind }));
    const keyWarnings = error.mock.calls.filter((c) => String(c[0]).includes('unique "key"'));
    expect(keyWarnings.map((c) => c.slice(1).join(' '))).toEqual([]);
  });
});
