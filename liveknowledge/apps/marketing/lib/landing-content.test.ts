import { describe, expect, it } from 'vitest';
import { getLandingSection, LANDING_SECTION_IDS, LANDING_SECTIONS } from './landing-content';

// docs/specs/019-marketing/marketing-site.md "Feature sections".
describe('the landing sections', () => {
  it('tell the story in order: pages, trust, Ask, agents, import, the workspace', () => {
    expect(LANDING_SECTION_IDS).toEqual(['pages', 'trust', 'ask', 'agents', 'import', 'workspace']);
    expect(LANDING_SECTIONS.map((s) => s.title)).toEqual([
      'Pages That Stay Organised',
      'Trust Built Into Every Page',
      'Ask, With Sources',
      'The Knowledgebase Your Agents Read',
      'Bring Everything With You',
      'Part of liveworkspace',
    ]);
  });

  it('give every section its own art, two or three sentences and three points', () => {
    for (const s of LANDING_SECTIONS) {
      expect(s.art, s.id).toBeTruthy();
      const sentences = s.description.split(/(?<=[.?!])\s+/).filter(Boolean);
      expect(sentences.length, s.id).toBeGreaterThanOrEqual(2);
      expect(sentences.length, s.id).toBeLessThanOrEqual(3);
      expect(s.points, s.id).toHaveLength(3);
      expect(new Set(s.points).size).toBe(3);
    }
  });

  it('never use an em dash', () => {
    for (const s of LANDING_SECTIONS) {
      for (const text of [s.label, s.title, s.description, ...s.points]) {
        expect(text, s.id).not.toMatch(/—/);
      }
    }
  });

  it('say who pays for Ask wherever Ask is sold', () => {
    expect(getLandingSection('ask')!.description).toMatch(/own Claude or OpenAI key/);
    expect(getLandingSection('ask')!.description).toMatch(/does not guess/);
  });

  it('find a section by id, else undefined', () => {
    expect(getLandingSection('trust')?.label).toBe('Verification');
    expect(getLandingSection('slides')).toBeUndefined();
  });
});

// docs/specs/019-marketing/marketing-site.md "Feature pages".
describe('the feature pages', () => {
  it('give each section six illustrated cards, each with a help link', () => {
    for (const s of LANDING_SECTIONS) {
      expect(s.items, s.id).toHaveLength(6);
      for (const item of s.items) {
        expect(item.art, item.title).toBeTruthy();
        expect(item.href, item.title).toMatch(/^\/help\/[a-z-]+\/[a-z0-9-]+\/$/);
      }
    }
  });

  it('give each page a meta description a search result shows whole', () => {
    for (const s of LANDING_SECTIONS) {
      expect(s.metaDescription.length, s.id).toBeGreaterThanOrEqual(50);
      expect(s.metaDescription.length, s.id).toBeLessThanOrEqual(160);
    }
  });

  it('keep every card title unique on its page, so its anchor is', () => {
    for (const s of LANDING_SECTIONS) {
      const titles = s.items.map((i) => i.title);
      expect(new Set(titles).size, s.id).toBe(titles.length);
    }
  });

  it('carry the cards the hero’s Notion and Confluence marks link to', () => {
    const titles = getLandingSection('import')!.items.map((i) => i.title);
    expect(titles).toContain('From Notion');
    expect(titles).toContain('From Confluence');
  });
});
