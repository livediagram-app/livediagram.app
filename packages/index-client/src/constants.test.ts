import { describe, expect, it } from 'vitest';
import {
  APP_DEFAULT_LINK_LEVEL,
  APP_LINK_LEVELS,
  APPS,
  RETIRED_PLACEMENT_KEYS,
  TEAM_AUDIT_EVENT_TYPES,
  foldRetiredDefaults,
  linkLevelOffered,
  placementDefaultKeysFor,
  retiredKeysClearedWith,
} from './constants';

describe('placementDefaultKeysFor', () => {
  it('tries the kind, the template, the mode, then the app', () => {
    expect(placementDefaultKeysFor('livediagram', 'workshop:event-storming:retrospective')).toEqual(
      [
        'livediagram:kind:event-storming',
        'livediagram:template:retrospective',
        'livediagram:mode:workshop',
        'livediagram',
      ],
    );
    expect(placementDefaultKeysFor('livediagram', 'draw:diagram')).toEqual([
      'livediagram:kind:diagram',
      'livediagram:mode:draw',
      'livediagram',
    ]);
  });

  it('reads one word as a template family, and no intent as the app alone', () => {
    expect(placementDefaultKeysFor('liveplanner', 'kanban')).toEqual([
      'liveplanner:template:kanban',
      'liveplanner',
    ]);
    expect(placementDefaultKeysFor('liveplanner', null)).toEqual(['liveplanner']);
    // A part that is not a plain word names no key.
    expect(placementDefaultKeysFor('liveplanner', 'plan:bo ard:')).toEqual([
      'liveplanner:mode:plan',
      'liveplanner',
    ]);
  });

  it("tries an app's retired keys after its own, never before", () => {
    expect(placementDefaultKeysFor('livehuddle', 'workshop:diagram:retrospective')).toEqual([
      'livehuddle:kind:diagram',
      'livehuddle',
      'livehuddle:mode:workshop',
      'livehuddle:template:retrospective',
    ]);
    expect(placementDefaultKeysFor('livehuddle', null)).toEqual([
      'livehuddle',
      ...RETIRED_PLACEMENT_KEYS.livehuddle!,
    ]);
  });
});

describe('foldRetiredDefaults', () => {
  const row = (key: string, folderId: string) => ({ key, folderId });

  it("reads the first retired key held as the app's own, keeping every row", () => {
    const map = foldRetiredDefaults([
      row('livehuddle:template:retrospective', 'retros'),
      row('livehuddle:mode:workshop', 'sessions'),
      row('liveplanner', 'plans'),
    ]);
    expect(map.get('livehuddle')).toBe('sessions');
    expect(map.get('livehuddle:template:retrospective')).toBe('retros');
    expect(map.get('liveplanner')).toBe('plans');
    expect(
      foldRetiredDefaults([row('livehuddle:template:retrospective', 'retros')]).get('livehuddle'),
    ).toBe('retros');
  });

  it("leaves the app's own key when it holds one, and an app with none of them alone", () => {
    const map = foldRetiredDefaults([
      row('livehuddle', 'mine'),
      row('livehuddle:template:retrospective', 'retros'),
    ]);
    expect(map.get('livehuddle')).toBe('mine');
    expect(foldRetiredDefaults([]).size).toBe(0);
  });
});

describe('retiredKeysClearedWith', () => {
  it("is an app's retired keys for its own key, and none for any other", () => {
    expect(retiredKeysClearedWith('livehuddle')).toEqual(RETIRED_PLACEMENT_KEYS.livehuddle);
    expect(retiredKeysClearedWith('liveplanner')).toEqual([]);
    expect(retiredKeysClearedWith('livehuddle:mode:workshop')).toEqual([]);
  });
});

describe('the levels each app offers a new link', () => {
  it('livehuddle offers Editor and Participant, starting at Participant', () => {
    expect(APP_LINK_LEVELS.livehuddle).toEqual(['edit', 'participate']);
    expect(APP_DEFAULT_LINK_LEVEL.livehuddle).toBe('participate');
    expect(linkLevelOffered('livehuddle', 'view')).toBe(false);
    expect(linkLevelOffered('livehuddle', 'participate')).toBe(true);
  });

  it('every other app offers all three, starting at Editor', () => {
    for (const app of APPS.filter((a) => a !== 'livehuddle')) {
      expect(APP_LINK_LEVELS[app]).toEqual(['edit', 'participate', 'view']);
      expect(APP_DEFAULT_LINK_LEVEL[app]).toBe('edit');
      expect(linkLevelOffered(app, 'view')).toBe(true);
    }
  });

  it("every app's default is one it offers", () => {
    for (const app of APPS) expect(linkLevelOffered(app, APP_DEFAULT_LINK_LEVEL[app])).toBe(true);
  });
});

describe('TEAM_AUDIT_EVENT_TYPES', () => {
  it("keeps a team's events and never an API token's or a team's deletion", () => {
    expect(TEAM_AUDIT_EVENT_TYPES.filter((t) => t.startsWith('token_'))).toEqual([]);
    expect(TEAM_AUDIT_EVENT_TYPES).not.toContain('team_deleted');
    expect(new Set(TEAM_AUDIT_EVENT_TYPES).size).toBe(TEAM_AUDIT_EVENT_TYPES.length);
  });
});
