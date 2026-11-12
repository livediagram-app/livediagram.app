import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { isDeliveryId, readDelivery } from './github-delivery';
import { repositoriesOf } from './github-api';
import { readState } from './webhook-route';
import { webhookSignatureOk, hmacHex } from './webhook-signature';
import { INSTALLATION_REPOSITORIES_LISTED } from './github-config';
import { prPayload, suitePayload } from './test-github-payloads';

// What a plan reads of a verified delivery (blueprint "Part 2" "The worker's doors"), and the pure checks beside it.

describe('readDelivery', () => {
  const inst = { installation: { id: 7 } };

  it('reads a pull request’s and a check suite’s repository, and the part a plan keeps', () => {
    expect(readDelivery('pull_request', 'd1', prPayload())).toMatchObject({
      id: 'd1',
      event: 'pull_request',
      action: 'opened',
      installationId: 7,
      repositoryIds: [11],
      pullRequest: { repoId: 11, ref: { owner: 'acme', repo: 'repo-11', number: 42 } },
    });
    expect(readDelivery('check_suite', 'd2', suitePayload())).toMatchObject({
      event: 'check_suite',
      action: 'completed',
      repositoryIds: [11],
      checkSuite: { suiteId: 1, headSha: 'abc1234', checks: 'passing' },
    });
  });

  it('reads the repositories removed, deduplicated, odd entries skipped, capped', () => {
    const removed = [{ id: 1 }, { id: 1 }, { id: 0 }, { id: 2.5 }, null, { id: 3 }];
    expect(
      readDelivery('installation_repositories', 'd', {
        ...inst,
        action: 'removed',
        repositories_removed: removed,
      })!.repositoryIds,
    ).toEqual([1, 3]);
    const many = Array.from({ length: INSTALLATION_REPOSITORIES_LISTED + 5 }, (_, i) => ({
      id: i + 1,
    }));
    expect(
      readDelivery('installation_repositories', 'd', {
        ...inst,
        action: 'removed',
        repositories_removed: many,
      })!.repositoryIds,
    ).toHaveLength(INSTALLATION_REPOSITORIES_LISTED);
  });

  it('reads an uninstall', () => {
    expect(readDelivery('installation', 'd', { ...inst, action: 'deleted' })).toMatchObject({
      event: 'installation',
      repositoryIds: [],
    });
  });

  it('ignores every other event, action and shape', () => {
    const cases: [string | null, unknown][] = [
      [null, { ...inst, repository: { id: 1 } }],
      ['issues', { ...inst, repository: { id: 1 } }],
      ['pull_request', { repository: { id: 1 } }],
      ['pull_request', { installation: { id: '7' }, repository: { id: 1 } }],
      ['pull_request', { ...inst, repository: { id: -1 } }],
      ['pull_request', { ...inst }],
      ['installation', { ...inst, action: 'created' }],
      ['installation_repositories', { ...inst, action: 'added', repositories_added: [{ id: 1 }] }],
      ['installation_repositories', { ...inst, action: 'removed', repositories_removed: 'x' }],
      [
        'installation_repositories',
        { ...inst, action: 'removed', repositories_removed: [{ id: 'x' }] },
      ],
      ['pull_request', null],
      ['pull_request', 'text'],
      // A pull request or a suite whose part a plan keeps does not read.
      ['pull_request', { ...prPayload(), pull_request: { number: 1 } }],
      ['check_suite', { ...suitePayload(), check_suite: { id: 1 } }],
    ];
    for (const [event, payload] of cases)
      expect(readDelivery(event, 'd', payload), JSON.stringify([event, payload])).toBeNull();
    expect(
      readDelivery('pull_request', 'd', { ...prPayload(), action: 'x'.repeat(65) })!.action,
    ).toBe('');
  });
});

describe('isDeliveryId', () => {
  it('takes a GUID and refuses anything else', () => {
    expect(isDeliveryId('72d3162e-cc78-11e3-81ab-4c9367dc0958')).toBe(true);
    for (const id of [null, '', 'a b', 'x'.repeat(101), 'a/b', 'é'])
      expect(isDeliveryId(id), String(id)).toBe(false);
  });
});

describe('readState', () => {
  const secret = 'a'.repeat(43);
  it('reads a plan id and its secret', () => {
    expect(readState(`plan_1-x.${secret}`)).toEqual({ planId: 'plan_1-x', secret });
  });
  it('refuses anything else', () => {
    for (const s of [
      null,
      '',
      secret,
      `.${secret}`,
      `p.${secret}x`,
      `p.${'a'.repeat(42)}!`,
      `p q.${secret}`,
      `${'p'.repeat(201)}.${secret}`,
    ])
      expect(readState(s), String(s)).toBeNull();
  });
});

describe('repositoriesOf', () => {
  it('keeps well-formed entries, at most one page', () => {
    expect(
      repositoriesOf({
        repositories: [
          { id: 1, full_name: 'a/b', private: true },
          { id: 2, full_name: 'ab' },
          { id: 3, full_name: 'a/b/c' },
          { id: 4, full_name: '/ab' },
          { id: 5, full_name: 'ab/' },
          { id: 6, full_name: `a/${'b'.repeat(140)}` },
          { id: 0, full_name: 'a/b' },
          { id: 7, full_name: 'c/d', private: 'yes' },
        ],
      }),
    ).toEqual([
      { id: 1, fullName: 'a/b', private: true },
      { id: 7, fullName: 'c/d', private: false },
    ]);
    expect(repositoriesOf({})).toBeNull();
    expect(repositoriesOf(null)).toBeNull();
  });
});

describe('the signature check', () => {
  it('stays linear on a 1 MB body', async () => {
    const body = new Uint8Array(1024 * 1024).fill(120);
    const header = `sha256=${await hmacHex('s', body)}`;
    const ms = await cpuMsOfAsync(async () => {
      expect(await webhookSignatureOk('s', body, header)).toBe(true);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(200));
  });
});
