import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  EXPLORER_ARTICLES,
  explorerArticlePath,
  explorerViewArticlePath,
  SIGN_IN_ARTICLE_PATH,
} from '@/lib/help/platform-help';
import { EXPLORER_CONTENT } from './explorer-articles';

// liveworkspace.app's Explorer articles (liveworkspace/docs/specs/010-site/site.md "Help"): every one has its text and its
// page, and every address the Explorer's Help button, banner and Search use, and every link the text makes to another
// article, lands on a real article or section.

const APP_DIR = fileURLToPath(new URL('../../app', import.meta.url));
const html = (slug: string) =>
  EXPLORER_CONTENT[slug]!.sections.map((s) => renderToStaticMarkup(<>{s.body}</>)).join('\n');

describe('the Explorer’s platform articles', () => {
  it('each has text, sections with unique ids, and a page', () => {
    for (const { slug } of EXPLORER_ARTICLES) {
      const content = EXPLORER_CONTENT[slug];
      expect(content, slug).toBeDefined();
      const ids = content!.sections.map((s) => s.id);
      expect(new Set(ids).size, slug).toBe(ids.length);
      const page = slug
        ? `${APP_DIR}/help/explorer/${slug}/page.tsx`
        : `${APP_DIR}/help/explorer/page.tsx`;
      expect(existsSync(page), slug).toBe(true);
    }
    expect(Object.keys(EXPLORER_CONTENT).sort()).toEqual(
      EXPLORER_ARTICLES.map((a) => a.slug).sort(),
    );
  });

  it('covers folders, teams, moving and sharing across apps', () => {
    const slugs = EXPLORER_ARTICLES.map((a) => a.slug);
    expect(slugs).toEqual(expect.arrayContaining(['folders', 'teams', 'moving', 'sharing']));
  });

  it('opens a real article or section from every view, and from the banner', () => {
    const kinds = ['home', 'all', 'recent', 'shared', 'inbox', 'trash', 'search', 'folder', 'team'];
    for (const kind of kinds) {
      const path = explorerViewArticlePath(kind)!;
      const [page, hash] = path.split('#') as [string, string | undefined];
      const article = EXPLORER_ARTICLES.find((a) => explorerArticlePath(a.slug) === page);
      expect(article, kind).toBeDefined();
      if (hash) {
        expect(
          EXPLORER_CONTENT[article!.slug]!.sections.map((s) => s.id),
          kind,
        ).toContain(hash);
      }
    }
    expect(explorerViewArticlePath('invites')).toBeUndefined();
    expect(EXPLORER_ARTICLES.map((a) => explorerArticlePath(a.slug))).toContain(
      SIGN_IN_ARTICLE_PATH,
    );
  });

  it('links only to articles that exist', () => {
    const paths = new Set(EXPLORER_ARTICLES.map((a) => explorerArticlePath(a.slug)));
    for (const { slug } of EXPLORER_ARTICLES) {
      for (const [, href] of html(slug).matchAll(/href="(\/help\/[^"#]*)/g)) {
        if (href === '/help/google-drive') continue;
        expect(paths.has(href!), `${slug} links ${href}`).toBe(true);
      }
    }
  });

  it('uses no em dashes', () => {
    for (const { slug } of EXPLORER_ARTICLES) expect(html(slug), slug).not.toContain('—');
  });
});
