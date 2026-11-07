import { describe, expect, expectTypeOf, it } from 'vitest';
import { COMMUNITY_APPS } from './apps';
import {
  COMMUNITY_APP_CATEGORIES,
  communityCategories,
  communityCategoryOf,
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

  it("lists each app's categories as its template picker does: by label, then Something Else", () => {
    for (const app of COMMUNITY_APPS) {
      const labels = (communityCategories(app) as readonly CommunityCategoryDef[])
        .slice(0, -1)
        .map((c) => c.label);
      const sorted = [...labels].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
      expect(labels, app).toEqual(sorted);
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

  it("gives each app's ids their own label and type, and an app's types are distinct", () => {
    // The same id can mean different things in two apps: livediagram's Meetings & Workshops, liveplanner's Meetings.
    expect(communityCategoryLabel('livediagram.app', 'meetings')).toBe('Meetings & Workshops');
    expect(communityCategoryLabel('liveplanner.app', 'meetings')).toBe('Meetings');
    expect(communityCategoryLabel('liveplanner.app', 'planning')).toBe('Projects and Teams');
    for (const app of COMMUNITY_APPS) {
      const types = communityCategoryTypes(app);
      expect(new Set(types).size, app).toBe(types.length);
    }
  });

  it("tells any app's category from one app's own", () => {
    expect(isCommunityCategory('software')).toBe(true);
    expect(isCommunityCategory('branding')).toBe(true);
    expect(isCommunityCategory('nope')).toBe(false);
    expect(isCommunityCategory(3)).toBe(false);
    expect(isCommunityCategoryOf('livedesign.app', 'branding')).toBe(true);
    expect(isCommunityCategoryOf('livediagram.app', 'branding')).toBe(false);
    expect(isCommunityCategoryOf('liveplanner.app', null)).toBe(false);
    // Retired ids (the sets before they became the template categories) are no app's.
    expect(isCommunityCategoryOf('livediagram.app', 'architecture')).toBe(false);
    expect(isCommunityCategoryOf('livehuddle.app', 'workshops')).toBe(false);
    expect(isCommunityCategoryOf('livehuddle.app', 'recreation')).toBe(true);
  });

  it('labels and types a category by app and id, an unknown one as Something Else', () => {
    expect(communityCategoryOf('livedocuments.app', 'speeches').label).toBe('Talks');
    expect(communityCategoryLabel('livedocuments.app', 'pitches')).toBe('Pitches');
    expect(communityCategoryType('livediagram.app', 'processes')).toBe('Processes');
    expect(communityCategoryLabel('livedesign.app', 'meetings')).toBe('Something Else');
    expect(communityCategoryType('livehuddle.app', 'workshops')).toBe('Other');
    expect(communityCategoryTypes('livehuddle.app')).toEqual([
      'Campus',
      'Events',
      'Office',
      'Outdoor',
      'Recreation',
      'Other',
    ]);
  });
});

describe('CommunityCategory', () => {
  it('names exactly the ids the apps’ lists hold', () => {
    expectTypeOf<CommunityCategory>().toEqualTypeOf<CommunityAppCategoryId>();
  });
});
