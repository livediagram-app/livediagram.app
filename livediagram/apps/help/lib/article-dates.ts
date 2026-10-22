import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// When each help page last changed, for the sitemap's <lastmod> (docs/specs/018-help/help-app.md "SEO"). Read from
// git at build time: one `git log` pass over the app folder, newest commit first, so the first date seen for a page
// is its latest. Keyed by route (`canvas/themes`, '' for the home), the page.mdx / page.tsx folder under app/.
//
// Only an honest date is worth sending: a crawler that sees every page "changed today" stops trusting the field. So
// a shallow clone (every file would date to its one commit) or no git at all gives an empty map, and the sitemap
// leaves the field out. The deploy build fetches full history without file contents for this
// (.github/workflows/deploy-reusable.yml).

// Resolved from the working directory, which `next build` and vitest both set to apps/help: a
// `new URL(..., import.meta.url)` here is taken by the bundler for an asset to import.
const APP_DIR = join(process.cwd(), 'app');

type Git = (args: string[]) => string;
const runGit: Git = (args) =>
  execFileSync('git', args, { cwd: APP_DIR, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// Parses `git log --format=@%cI --name-only --relative` output: a `@<date>` line per commit, then the paths it
// touched relative to app/. Only page files count; an illustration or component change is not a content change.
export function parseArticleDates(log: string): Map<string, Date> {
  const dates = new Map<string, Date>();
  let current: Date | null = null;
  for (const line of log.split('\n')) {
    if (line.startsWith('@')) {
      current = new Date(line.slice(1));
      continue;
    }
    const match = /^(?:(.*)\/)?page\.(?:mdx|tsx)$/.exec(line.trim());
    if (!match || !current) continue;
    const route = match[1] ?? '';
    if (!dates.has(route)) dates.set(route, current);
  }
  return dates;
}

export function articleDates(git: Git = runGit): Map<string, Date> {
  try {
    if (git(['rev-parse', '--is-shallow-repository']).trim() !== 'false') return new Map();
    // A merge lists the files it brought in, against its first parent: livediagram arrived in this repo by one merge,
    // which `git log` would otherwise show without its files, leaving every page it brought undated.
    return parseArticleDates(
      git([
        'log',
        '--diff-merges=first-parent',
        '--format=@%cI',
        '--name-only',
        '--relative',
        '--',
        '.',
      ]),
    );
  } catch {
    return new Map();
  }
}
