import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '@livepages/templates';
import { LANDING_SECTION_IDS } from '@/lib/landing-content';
import {
  SECTION_TEMPLATE_KINDS,
  SECTION_TEMPLATES_MAX,
  sectionTemplates,
} from '@/lib/section-templates';

const LISTED = new Set(TEMPLATES.filter((t) => !t.hidden).map((t) => t.kind));

describe('each category page’s templates', () => {
  it('has a list for every category and none for a category that does not exist', () => {
    expect(Object.keys(SECTION_TEMPLATE_KINDS).sort()).toEqual([...LANDING_SECTION_IDS].sort());
  });

  it.each(LANDING_SECTION_IDS)('%s lists up to nine listed templates, each once', (id) => {
    const kinds = SECTION_TEMPLATE_KINDS[id] ?? [];
    expect(kinds.length).toBeGreaterThan(0);
    expect(kinds.length).toBeLessThanOrEqual(SECTION_TEMPLATES_MAX);
    expect(new Set(kinds).size).toBe(kinds.length);
    // A renamed, removed or hidden template fails here rather than quietly dropping off the page.
    expect(kinds.filter((k) => !LISTED.has(k))).toEqual([]);
    expect(sectionTemplates(id).map((t) => t.kind)).toEqual(kinds);
  });

  it('has nothing for an unknown category', () => {
    expect(sectionTemplates('nope')).toEqual([]);
  });
});
