import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TEMPLATE_CATEGORIES, TEMPLATES } from '@livediagram/templates';

// The Templates article lists the catalogue by category. A list of forty-odd
// names is exactly the kind of prose that rots: adding a template is a change
// in packages/templates, and nothing about that change makes anyone open the
// help centre. So the catalogue is pinned to the article here.
//
// It asserts PRESENCE, not order or wording: a template's title has to appear
// somewhere on the page, and a category's label with it. How the page arranges
// them is editorial.
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const ARTICLE = `${ROOT}/apps/help/app/canvas/templates/page.mdx`;

describe('the Templates article lists the real catalogue', () => {
  const page = readFileSync(ARTICLE, 'utf8');

  it('reads a real catalogue (guard against this test going blind)', () => {
    expect(TEMPLATES.length).toBeGreaterThan(30);
    expect(TEMPLATE_CATEGORIES.length).toBeGreaterThan(5);
  });

  it('names every template', () => {
    const missing = TEMPLATES.filter((t) => !page.includes(t.title)).map((t) => t.title);
    expect(missing).toEqual([]);
  });

  it('names every category', () => {
    const missing = TEMPLATE_CATEGORIES.filter((c) => !page.includes(c.label)).map((c) => c.label);
    expect(missing).toEqual([]);
  });
});
