import { describe, expect, it } from 'vitest';
import {
  APP_DEFAULT_LINK_LEVEL,
  APP_KINDS,
  APP_LINK_LEVELS,
  APPS,
  isApp,
  KINDS,
} from './constants';

// livehuddle, registered before its launch (liveworkspace/docs/specs/002-architecture/integrating-an-app.md).
describe('livehuddle in the index', () => {
  it('is an app, making Spaces, after the four it joins', () => {
    expect(APPS.slice(0, 5)).toEqual([
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
    ]);
    expect(isApp('livehuddle')).toBe(true);
    expect(APP_KINDS.livehuddle).toBe('space');
    expect(KINDS).toContain('space');
  });

  it('leaves the other apps their own kinds', () => {
    expect(APP_KINDS).toMatchObject({
      livediagram: 'canvas',
      liveplanner: 'plan',
      livedocuments: 'document',
      livedesign: 'design',
    });
    expect(isApp('livenope')).toBe(false);
  });
});

// liveknowledge (liveknowledge/docs/specs/016-platform/platform-registration.md).
describe('liveknowledge in the index', () => {
  it('is the sixth app, making Knowledgebases, with every link level', () => {
    expect(APPS.at(-1)).toBe('liveknowledge');
    expect(isApp('liveknowledge')).toBe(true);
    expect(APP_KINDS.liveknowledge).toBe('knowledgebase');
    expect(KINDS.at(-1)).toBe('knowledgebase');
    expect(APP_LINK_LEVELS.liveknowledge).toEqual(['edit', 'participate', 'view']);
    expect(APP_DEFAULT_LINK_LEVEL.liveknowledge).toBe('edit');
  });
});
