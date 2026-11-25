// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://staging.liveworkspace.app/explorer/recent"}
// The Explorer on staging.liveworkspace.app, which has no app of its own: every link to an app (an item, New, a
// template, a share link) goes to that app's staging origin, never production's (Work Tracker 1446).
import { describe, expect, it } from 'vitest';
import type { Item } from '@liveworkspace/index-client';
import { appOrigin, pageApp } from './page-app';
import { appItemHref, itemHref, newItemHref, shareUrl, templateHref } from './host';

const item = { app: 'liveplanner', id: 'p1' } as Item;

describe('the Explorer on staging', () => {
  it('has no app of its own', () => {
    expect(pageApp()).toBeNull();
  });

  it("points every app's origin at its staging address", () => {
    expect(appOrigin('liveplanner')).toBe('https://staging.liveplanner.app');
    expect(appOrigin('livediagram')).toBe('https://staging.livediagram.app');
  });

  it('opens items, New and templates on the staging app', () => {
    expect(itemHref(item)).toBe('https://staging.liveplanner.app/project/p1');
    expect(itemHref({ ...item, sharedVia: 'abc' })).toBe(
      'https://staging.liveplanner.app/project/p1?s=abc',
    );
    expect(appItemHref('livediagram', 'd1')).toMatch(/^https:\/\/staging\.livediagram\.app\//);
    expect(newItemHref('livedesign', null)).toMatch(/^https:\/\/staging\.livedesign\.app\//);
    expect(templateHref('livedesign', 'blank-logo')).toMatch(
      /^https:\/\/staging\.livedesign\.app\/.*template=blank-logo$/,
    );
  });

  it('points a share link at staging too', () => {
    expect(shareUrl({ code: 'xyz' } as never, item)).toMatch(
      /^https:\/\/staging\.liveplanner\.app\/.*xyz$/,
    );
  });
});
