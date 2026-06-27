import { describe, expect, it } from 'vitest';
import {
  getLandingSection,
  groupSectionFeatures,
  LANDING_SECTION_IDS,
  LANDING_SECTIONS,
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
