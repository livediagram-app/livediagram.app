import { describe, expect, it } from 'vitest';
import type { Metadata } from 'next';
import { metadata as root } from './layout';
import { metadata as compare } from './compare/page';
import { metadata as help } from './help/google-drive/page';
import { metadata as licences } from './licences/page';
import { metadata as privacy } from './privacy/page';
import { metadata as status } from './status/page';
import { metadata as telemetry } from './telemetry/layout';
import { metadata as terms } from './terms/page';

// Every indexable page but the front door (liveworkspace/docs/specs/010-site/site.md, sitemap.ts) speaks for itself when shared: an
// Open Graph block of its own, whose address is its canonical, never the root layout's `/` and home-page title.
const PAGES: Record<string, Metadata> = {
  '/compare': compare,
  '/help/google-drive': help,
  '/licences': licences,
  '/privacy': privacy,
  '/status': status,
  '/telemetry': telemetry,
  '/terms': terms,
};

describe('indexable pages’ share metadata', () => {
  for (const [path, metadata] of Object.entries(PAGES))
    it(`${path} has its own Open Graph and Twitter title and address`, () => {
      expect(metadata.alternates?.canonical).toBe(path);
      const og = metadata.openGraph as { url?: unknown; title?: unknown } | undefined;
      expect(og?.url).toBe(path);
      expect(og?.title).toBeTruthy();
      expect(og?.title).not.toBe(root.title);
      expect(metadata.twitter?.title).toBeTruthy();
      expect(metadata.twitter?.title).not.toBe(root.title);
    });
});

// A search result and a browser tab name the site as well as the page: `<page> · liveworkspace`, the same in the page's
// <title> and its share cards, so "Status" or "Terms of Use" alone never stands for liveworkspace.
describe('indexable pages’ titles', () => {
  for (const [path, metadata] of Object.entries(PAGES))
    it(`${path} names the page and the site`, () => {
      expect(metadata.title).toMatch(/^\S.* · liveworkspace$/);
      const og = metadata.openGraph as { title?: unknown; siteName?: unknown } | undefined;
      expect(og?.title).toBe(metadata.title);
      expect(og?.siteName).toBe('liveworkspace');
      expect(metadata.twitter?.title).toBe(metadata.title);
    });
});
