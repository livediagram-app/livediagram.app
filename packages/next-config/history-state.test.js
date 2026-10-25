import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

// Next's App Router patches history.replaceState / pushState so a change to the address made outside it still
// reaches usePathname and useSearchParams, but it skips that when the state passed in is its own (`__NA`), which
// window.history.state always is. Passing it back left useSearchParams on the old address: the Explorer's Settings
// panel, opened by `?settings=`, reopened as it closed. Pass null and Next copies its own state across.
const root = fileURLToPath(new URL('../../', import.meta.url));

it('never hands Next its own history state back', () => {
  let found = '';
  try {
    found = execFileSync(
      'git',
      [
        'grep',
        '-n',
        '-E',
        String.raw`(replace|push)State\((window\.)?history\.state`,
        '--',
        '*.ts',
        '*.tsx',
        '*.js',
        '*.mjs',
      ],
      { cwd: root, encoding: 'utf8' },
    );
  } catch {
    // git grep exits 1 when nothing matches.
  }
  expect(
    found.split('\n').filter((line) => line && !line.includes('history-state.test.js')),
  ).toEqual([]);
});
