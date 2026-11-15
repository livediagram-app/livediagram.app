import { describe, expect, it } from 'vitest';
import { gitRepoVars, withoutGitRepoEnv } from './git-env';

describe('withoutGitRepoEnv', () => {
  it('drops every repository variable, keeps the rest and adds the extras', () => {
    const env = Object.fromEntries(gitRepoVars.map((name) => [name, '/x']));
    const clean = withoutGitRepoEnv({ ...env, PATH: '/bin', GIT_AUTHOR_NAME: 'a' }, { EXTRA: '1' });
    expect(clean).toEqual({ PATH: '/bin', GIT_AUTHOR_NAME: 'a', EXTRA: '1' });
  });

  it('leaves the input untouched', () => {
    const env = { GIT_DIR: '/x' };
    withoutGitRepoEnv(env);
    expect(env).toEqual({ GIT_DIR: '/x' });
  });
});
