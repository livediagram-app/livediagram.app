import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_ORDER, articlePath, isAppId, type AppId } from '@liveworkspace/help-registry';
import { allArticles, articlesFor } from '@liveworkspace/help-registry/catalogue';
import { APP_DIR, articleFile } from '../testing/scoped-articles';

// Every app list in the help centre names every app that it is true of (liveworkspace/docs/specs/017-help/help-centre.md
// "liveknowledge"). liveknowledge launched after most of the articles were written, so a list of "the apps" kept
// stopping one short. This guard makes that a failing test: a list that names the five apps the help centre had
// before liveknowledge, and not liveknowledge, must be in EXEMPT with the reason it is true as written.
//
// Three places keep such a list: an article's `apps` in the catalogue, a note or figure's `app="..."` in an
// article's page, and the apps' own catalogue entries (every app has its About articles).

const BEFORE_LIVEKNOWLEDGE: readonly AppId[] = APP_ORDER.filter((app) => app !== 'liveknowledge');

const names = (apps: readonly string[]) => BEFORE_LIVEKNOWLEDGE.every((app) => apps.includes(app));

type Why = 'not-applicable' | 'follow-up';

/** Articles for every other app that liveknowledge's help leaves out, and why. `not-applicable`: what the article
 *  describes is a canvas or tab surface a Knowledgebase has no counterpart of, so its help says nothing. `follow-up`:
 *  it applies to a Knowledgebase and has no liveknowledge wording yet (a Large card of its own, listed in the
 *  Work Tracker), so liveknowledge's help does not show it rather than show a canvas article's words. */
const FOLLOW_UP =
  "Not written for liveknowledge yet: its wording has to be checked against liveknowledge's editor first.";

const EXEMPT: Record<string, { why: Why; reason: string }> = {
  'user-interface/zoom-controls': {
    why: 'not-applicable',
    reason: 'A page of writing has no zoom; the canvas does.',
  },
  'user-interface/tab-bar': {
    why: 'not-applicable',
    reason: 'A Knowledgebase has pages in a tree, never a bar of tabs.',
  },
  'tabs/using-tabs': {
    why: 'not-applicable',
    reason: 'Pages are a tree (the page tree), not tabs.',
  },
  'tabs/tab-folders': {
    why: 'not-applicable',
    reason: 'Pages are a tree (the page tree), not tabs.',
  },
  'tabs/connected-files': {
    why: 'not-applicable',
    reason: 'A Knowledgebase embeds other apps instead (Embedding From Other Apps).',
  },
  'tabs/side-by-side': { why: 'not-applicable', reason: 'Tabs side by side are a canvas feature.' },
  'tabs/import-tabs': {
    why: 'not-applicable',
    reason: 'Import is a Markdown folder, Notion or Confluence (the Import articles).',
  },
  'tabs/export-tabs': {
    why: 'not-applicable',
    reason: 'Export is a page or a Knowledgebase (Exporting a Knowledgebase).',
  },
  'collaboration/sharing/live-image': {
    why: 'not-applicable',
    reason: 'A live image draws a canvas tab; a page of writing has none.',
  },
  'search-panel/the-search-panel/search-tabs-and-elements': {
    why: 'not-applicable',
    reason: 'Finds a canvas tab or element; Search finds pages instead (Search).',
  },
  'search-panel/the-search-panel/search-create-tab': {
    why: 'not-applicable',
    reason: 'Creates a tab; Create New Page is listed with the commands in The Search Panel.',
  },
  'tips-and-tricks/keyboard-shortcuts': {
    why: 'not-applicable',
    reason:
      'A canvas shortcut list; liveknowledge Settings opens Writing on a Page for its shortcuts.',
  },
  'tips-and-tricks/command-palette': {
    why: 'not-applicable',
    reason: 'The Search Panel article names the commands a Knowledgebase has.',
  },
  'user-interface/panel-layout': { why: 'follow-up', reason: FOLLOW_UP },
  'user-interface/quick-controls': { why: 'follow-up', reason: FOLLOW_UP },
  'user-interface/title-bar': { why: 'follow-up', reason: FOLLOW_UP },
  'getting-started/keyboard-essentials': { why: 'follow-up', reason: FOLLOW_UP },
  'getting-started/accessibility': { why: 'follow-up', reason: FOLLOW_UP },
  'developers/agent-changes': { why: 'follow-up', reason: FOLLOW_UP },
  'developers/agent-comments-presence': { why: 'follow-up', reason: FOLLOW_UP },
  'troubleshooting/missing-changes': { why: 'follow-up', reason: FOLLOW_UP },
  'supported-devices/desktop': { why: 'follow-up', reason: FOLLOW_UP },
  'supported-devices/tablet': { why: 'follow-up', reason: FOLLOW_UP },
  'supported-devices/mobile': { why: 'follow-up', reason: FOLLOW_UP },
  'explorer/explorer-panel': { why: 'follow-up', reason: FOLLOW_UP },
  'search-panel/the-search-panel/search-teams': { why: 'follow-up', reason: FOLLOW_UP },
};

/** Articles whose notes for the five other apps are deliberate, because liveknowledge has its own note beside each. */
const NOTES_EXEMPT: Record<string, string> = {
  'tools/dark-mode':
    "Its theme and tab paragraphs are the five apps' words; liveknowledge has its own notes for them (Knowledgebase Style).",
};

describe('apps lists name liveknowledge', () => {
  it('lists liveknowledge in every article that applies to the five other apps, or says why not', () => {
    const left = allArticles
      .filter((a) => names(a.apps) && !a.apps.includes('liveknowledge'))
      .map(articlePath)
      .filter((path) => !(path in EXEMPT));
    expect(left, 'add liveknowledge to its `apps`, or to EXEMPT with the reason').toEqual([]);
  });

  it('keeps EXEMPT to articles that still leave liveknowledge out', () => {
    const stale = Object.keys(EXEMPT).filter((path) => {
      const article = allArticles.find((a) => articlePath(a) === path);
      return !article || !names(article.apps) || article.apps.includes('liveknowledge');
    });
    expect(stale, 'remove it from EXEMPT').toEqual([]);
  });

  it('gives every exemption a reason', () => {
    for (const [path, { reason }] of Object.entries(EXEMPT)) {
      expect(reason.length, path).toBeGreaterThan(12);
    }
  });

  it('names liveknowledge in every note or figure that names the five other apps, in its articles', () => {
    const left: string[] = [];
    for (const article of allArticles) {
      if (!article.apps.includes('liveknowledge') || article.apps.length === 1) continue;
      if (articlePath(article) in NOTES_EXEMPT) continue;
      const source = readFileSync(`${APP_DIR}/${articleFile(article)}`, 'utf8');
      for (const m of source.matchAll(/<(\w+)[^>]*?\bapp="([^"]*)"/g)) {
        const apps = m[2]!.split(',').map((n) => n.trim());
        if (names(apps) && !apps.includes('liveknowledge')) {
          const line = source.slice(0, m.index).split('\n').length;
          left.push(`${articlePath(article)}:${line} <${m[1]} app="${m[2]}">`);
        }
      }
    }
    expect(left, 'a note true of every other app is true of liveknowledge, or has its own').toEqual(
      [],
    );
  });

  it('names only app ids in a note or figure, in every article', () => {
    const wrong: string[] = [];
    for (const article of allArticles) {
      const source = readFileSync(`${APP_DIR}/${articleFile(article)}`, 'utf8');
      for (const m of source.matchAll(/<(AppNote|Figure)[^>]*?\bapp="([^"]*)"/g)) {
        for (const name of m[2]!.split(',')) {
          if (name.trim() !== 'all' && !isAppId(name.trim()))
            wrong.push(`${articlePath(article)}: ${name}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('gives every app its About articles: what it is, and why to use it', () => {
    for (const app of APP_ORDER) {
      const slugs = articlesFor(app)
        .filter((a) => a.categorySlug === 'about')
        .map((a) => a.slug);
      expect(slugs, app).toContain(`what-is-${app}`);
      expect(slugs, app).toContain(`why-${app}`);
    }
  });

  it('names every app in the All Apps footer', () => {
    const footer = readFileSync(new URL('../bindings/all.tsx', import.meta.url), 'utf8');
    for (const app of APP_ORDER) expect(footer, app).toContain(app);
  });
});
