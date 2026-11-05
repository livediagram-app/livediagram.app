import { describe, expect, it } from 'vitest';
import {
  APP_DEFAULT_LINK_LEVEL,
  APP_LINK_LEVELS,
  APPS,
  linkLevelOffered,
  placementDefaultKeysFor,
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
