import { describe, expect, it } from 'vitest';
import { MENTION_TEXT_MAX, PULL_REQUEST_TITLE_MAX } from '@liveplanner/items';
import { githubId, readCheckSuite, readPullRequest } from './github-payloads';
import { prPayload, suitePayload } from './test-github-payloads';

// What a plan keeps of a pull request's and a check suite's delivery (blueprint "Part 3" "Reading a delivery"): read
// as untrusted shapes, lengths capped, the address rebuilt from parsed parts.

describe('readPullRequest', () => {
  it('reads the parts a plan keeps', () => {
    expect(readPullRequest(prPayload({ title: 'Fix', body: 'Body', sha: 'ABCDEF1' }))).toEqual({
      repoId: 11,
      ref: { owner: 'acme', repo: 'repo-11', number: 42 },
      title: 'Fix',
      body: 'Body',
      state: 'open',
      headSha: 'abcdef1',
      updatedAt: Date.parse('2026-11-12T10:00:00Z'),
    });
  });

  it('reads draft, closed and merged (by the flag or its time)', () => {
    expect(readPullRequest(prPayload({ draft: true }))!.state).toBe('draft');
    expect(readPullRequest(prPayload({ state: 'closed' }))!.state).toBe('closed');
    expect(readPullRequest(prPayload({ state: 'closed', merged: true }))!.state).toBe('merged');
    const p = prPayload({ state: 'closed' });
    Reflect.set(p.pull_request, 'merged_at', '2026-11-12T10:00:00Z');
    expect(readPullRequest(p)!.state).toBe('merged');
  });

  it('caps the title and body, and reads anything but text as empty', () => {
    const long = readPullRequest(
      prPayload({ title: 't'.repeat(1000), body: 'b'.repeat(MENTION_TEXT_MAX + 10) }),
    )!;
    expect(long.title.length).toBe(PULL_REQUEST_TITLE_MAX);
    expect(long.body.length).toBe(MENTION_TEXT_MAX);
    const odd = prPayload();
    Reflect.set(odd.pull_request, 'title', 42);
    expect(readPullRequest(odd)!.title).toBe('');
    expect(readPullRequest(prPayload({ body: null }))!.body).toBe('');
  });

  it('refuses a part it cannot read', () => {
    const bad = (mutate: (p: ReturnType<typeof prPayload>) => void) => {
      const p = prPayload();
      mutate(p);
      return readPullRequest(p);
    };
    expect(readPullRequest(null)).toBeNull();
    expect(bad((p) => Reflect.set(p.repository, 'id', 0))).toBeNull();
    expect(bad((p) => Reflect.set(p.pull_request, 'number', '42'))).toBeNull();
    expect(bad((p) => Reflect.set(p.repository, 'full_name', 7))).toBeNull();
    expect(bad((p) => Reflect.set(p.repository, 'full_name', 'x'.repeat(141)))).toBeNull();
    expect(bad((p) => Reflect.set(p.repository, 'full_name', 'no-slash'))).toBeNull();
    expect(bad((p) => Reflect.set(p.pull_request, 'head', { sha: 'zzzzzzz' }))).toBeNull();
    expect(bad((p) => Reflect.set(p.pull_request, 'head', { sha: 'abc' }))).toBeNull();
    expect(bad((p) => Reflect.set(p.pull_request, 'head', { sha: 'a'.repeat(65) }))).toBeNull();
    expect(bad((p) => Reflect.set(p.pull_request, 'updated_at', 'not a time'))).toBeNull();
    expect(bad((p) => Reflect.set(p.pull_request, 'updated_at', 'x'.repeat(41)))).toBeNull();
    expect(bad((p) => Reflect.set(p.pull_request, 'updated_at', 5))).toBeNull();
  });
});

describe('readCheckSuite', () => {
  it('reads running until completed, then passing or failing by its conclusion', () => {
    expect(readCheckSuite(suitePayload({ status: 'queued', conclusion: null }))!.checks).toBe(
      'running',
    );
    for (const conclusion of ['success', 'neutral', 'skipped'])
      expect(readCheckSuite(suitePayload({ conclusion }))!.checks, conclusion).toBe('passing');
    for (const conclusion of ['failure', 'cancelled', 'timed_out', 'action_required', 'stale', null])
      expect(readCheckSuite(suitePayload({ conclusion }))!.checks, String(conclusion)).toBe(
        'failing',
      );
  });

  it('refuses a part it cannot read', () => {
    expect(readCheckSuite(null)).toBeNull();
    expect(readCheckSuite({ ...suitePayload(), repository: { id: -1 } })).toBeNull();
    const p = suitePayload();
    Reflect.set(p.check_suite, 'id', 1.5);
    expect(readCheckSuite(p)).toBeNull();
    const q = suitePayload();
    Reflect.set(q.check_suite, 'head_sha', null);
    expect(readCheckSuite(q)).toBeNull();
    const r = suitePayload();
    Reflect.set(r.check_suite, 'updated_at', null);
    expect(readCheckSuite(r)).toBeNull();
  });

  it('githubId takes positive safe integers only', () => {
    expect(githubId(5)).toBe(5);
    for (const v of [0, -1, 1.5, '5', Number.MAX_SAFE_INTEGER + 1]) expect(githubId(v)).toBeUndefined();
  });
});
