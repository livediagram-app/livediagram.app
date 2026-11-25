// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://www.liveworkspace.app/explorer/recent"}
// The Explorer on production: links to an app keep the app's live address (Work Tracker 1446).
import { describe, expect, it } from 'vitest';
import type { Item } from '@liveworkspace/index-client';
import { appOrigin } from './page-app';
import { itemHref, shareUrl } from './host';

const item = { app: 'liveplanner', id: 'p1' } as Item;

describe('the Explorer on production', () => {
  it("keeps every link on the app's live address", () => {
    expect(appOrigin('liveplanner')).toBe('https://www.liveplanner.app');
    expect(itemHref(item)).toBe('https://www.liveplanner.app/project/p1');
    expect(shareUrl({ code: 'xyz' } as never, item)).toMatch(/^https:\/\/www\.liveplanner\.app\//);
  });
});
