import { describe, expect, it } from 'vitest';
import {
  getLandingSection,
  groupSectionFeatures,
  LANDING_SECTION_IDS,
  LANDING_SECTIONS,
  sectionHighlights,
  type LandingSection,
} from './landing-content';

const section = (items: { title: string; group?: string }[]): LandingSection =>
  ({ id: 's', title: 'S', description: 'd', items }) as unknown as LandingSection;

describe('LANDING_SECTION_IDS', () => {
  it('is derived from LANDING_SECTIONS with no duplicate ids', () => {
    // Single source: ids drive both generateStaticParams (the built
    // /features/<id> pages) and the landing links, so they can't drift.
    expect(LANDING_SECTION_IDS).toEqual(LANDING_SECTIONS.map((s) => s.id));
    expect(new Set(LANDING_SECTION_IDS).size).toBe(LANDING_SECTION_IDS.length);
  });
});

describe('LANDING_SECTIONS', () => {
  // One beat per core feature of the app (docs/specs/019-marketing/marketing-site.md "Story beats").
  it('tells the story in six core features, in order', () => {
    expect(LANDING_SECTION_IDS).toEqual([
      'collaboration',
      'diagrams',
      'whiteboard',
      'infographics',
      'documents',
      'plan',
    ]);
  });

  it('plays a different hero scene beside each beat', () => {
    const scenes = LANDING_SECTIONS.map((s) => s.scene);
    expect(new Set(scenes).size).toBe(scenes.length);
  });

  it('resolves every highlight to one of its own cards', () => {
    for (const section of LANDING_SECTIONS) {
      expect(section.highlights).toHaveLength(4);
      expect(sectionHighlights(section).map((i) => i.title)).toEqual(section.highlights);
    }
  });

  it('throws on a highlight no card has', () => {
    const broken = { ...LANDING_SECTIONS[0]!, highlights: ['No such feature'] };
    expect(() => sectionHighlights(broken)).toThrow(/unknown feature/);
  });

  // A card with no art renders as a bare caption among illustrated ones.
  it('illustrates every card and keeps titles unique within a category', () => {
    for (const section of LANDING_SECTIONS) {
      for (const item of section.items) expect(item.art, item.title).toBeTruthy();
      const titles = section.items.map((i) => i.title);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });

  it('never uses an em dash in a beat', () => {
    for (const s of LANDING_SECTIONS) {
      for (const text of [s.label, s.title, s.description, s.cta]) expect(text).not.toContain('—');
    }
  });
});

describe('getLandingSection', () => {
  it('finds a section by id, else undefined', () => {
    const first = LANDING_SECTIONS[0]!;
    expect(getLandingSection(first.id)).toBe(first);
    expect(getLandingSection('no-such-section')).toBeUndefined();
  });
});

describe('groupSectionFeatures', () => {
  it('returns null when no feature is group-tagged (renders one flat grid)', () => {
    expect(groupSectionFeatures(section([{ title: 'a' }, { title: 'b' }]))).toBeNull();
  });

  it('groups in first-seen order, keeps item order, and loses nothing', () => {
    const s = section([
      { title: 'a', group: 'G1' },
      { title: 'b', group: 'G2' },
      { title: 'c', group: 'G1' },
    ]);
    const groups = groupSectionFeatures(s);
    expect(groups?.map((g) => g.title)).toEqual(['G1', 'G2']);
    expect(groups?.flatMap((g) => g.items.map((i) => i.title))).toEqual(['a', 'c', 'b']);
    expect(groups?.flatMap((g) => g.items)).toHaveLength(s.items.length);
  });

  it("buckets an untagged item under 'More' when others are tagged", () => {
    const groups = groupSectionFeatures(section([{ title: 'a', group: 'G1' }, { title: 'b' }]));
    expect(groups?.find((g) => g.title === 'More')?.items.map((i) => i.title)).toEqual(['b']);
  });
});

describe('feature card copy', () => {
  // House style: no em dashes anywhere in the copy (the beats are pinned above).
  it('never uses an em dash on a card', () => {
    for (const s of LANDING_SECTIONS) {
      for (const item of s.items) {
        expect(`${item.title} ${item.description}`, item.title).not.toContain('—');
      }
    }
  });
});
