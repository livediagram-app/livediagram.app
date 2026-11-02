import { describe, expect, expectTypeOf, it } from 'vitest';
import { COMMUNITY_APPS } from './apps';
import {
  COMMUNITY_APP_CATEGORIES,
  communityCategories,
  communityCategoryLabel,
  communityCategoryType,
  communityCategoryTypes,
  isCommunityCategory,
  isCommunityCategoryOf,
  type CommunityAppCategoryId,
  type CommunityCategory,
  type CommunityCategoryDef,
} from './categories';

const all = (): CommunityCategoryDef[] =>
  COMMUNITY_APPS.flatMap((app) => [
    ...(communityCategories(app) as readonly CommunityCategoryDef[]),
  ]);

describe("each app's categories", () => {
  it('every app has its own set, ending in Something Else', () => {
    expect(Object.keys(COMMUNITY_APP_CATEGORIES).sort()).toEqual([...COMMUNITY_APPS].sort());
    for (const app of COMMUNITY_APPS) {
      const list = communityCategories(app) as readonly CommunityCategoryDef[];
      expect(list.length, app).toBeGreaterThanOrEqual(5);
      expect(list.at(-1)!.id, app).toBe('other');
      const ids = list.map((c) => c.id);
      expect(new Set(ids).size, app).toBe(ids.length);
    }
  });

  it('has lowercase ids, PascalCase types and a description each', () => {
    for (const c of all()) {
      expect(c.id).toMatch(/^[a-z]+$/);
      expect(c.type).toMatch(/^[A-Z][A-Za-z]+$/);
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.blurb.length).toBeGreaterThan(0);
    }
  });

  it('gives an id two apps share one label and one type', () => {
    const seen = new Map<string, CommunityCategoryDef>();
    for (const c of all()) {
      const first = seen.get(c.id);
      if (first) {
        expect(c.label, c.id).toBe(first.label);
        expect(c.type, c.id).toBe(first.type);
      } else seen.set(c.id, c);
    }
    // And no two ids share a telemetry type.
    const types = [...seen.values()].map((c) => c.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it("tells any app's category from one app's own", () => {
    expect(isCommunityCategory('architecture')).toBe(true);
    expect(isCommunityCategory('logos')).toBe(true);
    expect(isCommunityCategory('nope')).toBe(false);
    expect(isCommunityCategory(3)).toBe(false);
    expect(isCommunityCategoryOf('livedesign.app', 'logos')).toBe(true);
    expect(isCommunityCategoryOf('livediagram.app', 'logos')).toBe(false);
    expect(isCommunityCategoryOf('liveplanner.app', null)).toBe(false);
  });

  it('labels and types a category by its id', () => {
    expect(communityCategoryLabel('decks')).toBe('Slide Decks');
    expect(communityCategoryType('flows')).toBe('Flows');
    expect(communityCategoryTypes('livedocuments.app')).toEqual([
      'Articles',
      'Decks',
      'Infographics',
      'Guides',
      'Proposals',
      'Newsletters',
      'Learning',
      'Other',
    ]);
  });
});

describe('CommunityCategory', () => {
  it('names exactly the ids the apps’ lists hold', () => {
    expectTypeOf<CommunityCategory>().toEqualTypeOf<CommunityAppCategoryId>();
  });
});
