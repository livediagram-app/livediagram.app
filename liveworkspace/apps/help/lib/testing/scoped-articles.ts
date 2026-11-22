import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { articlePath, SCOPE_WORDS, scopeName, type HelpScope } from '@liveworkspace/help-registry';
import { articlesFor, categoriesFor } from '@liveworkspace/help-registry/catalogue';
import { figureShowsIn } from '@liveworkspace/help-site/components/Figure';
import { SCOPE } from '@/lib/scope.generated';

// What a suite reading the article tree sees of one scope (liveworkspace/docs/specs/017-help/help-centre.md "Articles
// and the apps they apply to"). The one help centre holds every app's articles under app/, so an edition's suites
// (editions/<app>/tests, run with the scope set to that app, vitest.config.ts) read only the pages that scope shows:
// its articles' page.mdx, the landings of its categories, and the pages every scope has (the home, contact, the
// features index). A page read for a scope drops the other apps' notes (<AppNote app="...">), so a check against one
// app's editor never reads another app's words. `scope` defaults to the vitest project's scope.

/** The help centre's app/ folder, absolute. */
export const APP_DIR = fileURLToPath(new URL('../../app', import.meta.url));

/** Every page file under app/ (`<path>/page.mdx`, `<path>/page.tsx`, the home's `page.tsx`), relative, sorted. */
export function allPageFiles(): string[] {
  return readdirSync(APP_DIR, { recursive: true })
    .map((p) => String(p).replaceAll('\\', '/'))
    .filter((p) => p === 'page.tsx' || p.endsWith('/page.mdx') || p.endsWith('/page.tsx'))
    .sort();
}

/** An article's page file, relative to app/. */
export const articleFile = (article: { categorySlug: string; slug: string }) =>
  `${articlePath(article)}/page.mdx`;

/** The page.mdx files of the articles `scope` shows, in its reading order. */
export function scopedArticleFiles(scope: HelpScope = SCOPE): string[] {
  return articlesFor(scope).map(articleFile);
}

/** The page.tsx files `scope` shows: the landings of its categories, and every page.tsx that is no category's
 *  landing (the home, contact, features, a moved page's stub), which every scope serves. */
export function scopedLandingFiles(scope: HelpScope = SCOPE): string[] {
  const every = new Set(categoriesFor('all').map((c) => c.slug));
  const shown = new Set(categoriesFor(scope).map((c) => c.slug));
  return allPageFiles()
    .filter((f) => f.endsWith('page.tsx'))
    .filter((f) => {
      const dir = f === 'page.tsx' ? '' : f.slice(0, -'/page.tsx'.length);
      return !every.has(dir) || shown.has(dir);
    });
}

/** Every page file `scope` shows: its articles, then its landings and fixed pages. */
export function scopedPageFiles(scope: HelpScope = SCOPE): string[] {
  return [
    ...scopedArticleFiles(scope).filter((f) => existsSync(`${APP_DIR}/${f}`)),
    ...scopedLandingFiles(scope),
  ];
}

const NOTE = /<AppNote\b([^>]*)>([\s\S]*?)<\/AppNote>/g;
const APP_IDS = /live(?:diagram|planner|documents|design|huddle|knowledge)/g;

const FIGURE = /<Figure\b[^>]*?\bapp="([^"]*)"[^>]*>[\s\S]*?<\/Figure>/g;

/** `source` as `scope` reads it: every <AppNote> for other apps only removed (All Apps keeps them all), and every
 *  <Figure app="..."> variant the scope does not show (figureShowsIn: an app's variant only in its help, `all` only
 *  under All Apps). */
export function forScope(source: string, scope: HelpScope = SCOPE): string {
  const figures = source.replace(FIGURE, (figure, app: string) =>
    figureShowsIn(app, scope) ? figure : '',
  );
  if (scope === 'all') return figures;
  return figures.replace(NOTE, (note, attrs: string) =>
    ((attrs.match(APP_IDS) ?? []) as string[]).includes(scope) ? note : '',
  );
}

/** A page file's source (relative to app/) as `scope` reads it. */
export function readScoped(file: string, scope: HelpScope = SCOPE): string {
  return forScope(readFileSync(`${APP_DIR}/${file}`, 'utf8'), scope);
}

/** The articles `scope` shows, each with its file (relative), its absolute path and its source as the scope reads it. */
export function scopedArticleSources(
  scope: HelpScope = SCOPE,
): { file: string; path: string; source: string }[] {
  return scopedArticleFiles(scope)
    .filter((file) => existsSync(`${APP_DIR}/${file}`))
    .map((file) => ({ file, path: `${APP_DIR}/${file}`, source: readScoped(file, scope) }));
}

const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** `source` with its <Noun /> and <AppName /> written out as `scope`'s words (ScopeWords in @liveworkspace/help-site),
 *  so a check against an editor's strings reads **Sync <Noun capital />** as the label the reader looks for. */
export function inScopeWords(source: string, scope: HelpScope = SCOPE): string {
  const words = SCOPE_WORDS[scope];
  return source
    .replace(/<Noun\b([^>]*?)\s*\/>/g, (_, attrs: string) => {
      const word = /\bplural\b/.test(attrs) ? words.nouns : words.noun;
      return /\bcapital\b/.test(attrs) ? capitalised(word) : word;
    })
    .replace(/<AppName\s*\/>/g, scopeName(scope));
}
