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
