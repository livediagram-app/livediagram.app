import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import {
  LINKED_PULL_REQUESTS_MAX,
  PULL_REQUEST_HINT,
  PULL_REQUEST_TEXT_MAX,
  cardPullRequests,
  parsePullRequestUrl,
  pullRequestKey,
  pullRequestText,
  pullRequestUrl,
  pullRequestValueOf,
  pullRequestValueText,
} from './pull-request-fields';
import { customFieldText } from './card-text';
import { customValueOfText } from './board-csv';
import { resolveFields } from './plan-names';
import { changedValue } from './field-kind-change';
import { canBeRequired } from './required-fields';
import {
  CUSTOM_FIELD_KINDS,
  ITEM_TYPES,
  type CustomFieldDef,
  type ItemTypeDef,
} from './item-types';

// Pull Request fields (docs/specs/026-plan/github-pull-requests.md "The Pull Request field", "How a card names its
// pull requests").

const PR: CustomFieldDef = { id: 'f-pr', label: 'Pull Request', kind: 'pullrequest' };
const LINK: CustomFieldDef = { id: 'f-link', label: 'Link', kind: 'link' };
const TASK: ItemTypeDef = {
  ...ITEM_TYPES[0],
  id: 'task',
  fields: ['title', 'status', 'f-pr', 'f-link', 'f-pr-2'],
  custom: [PR, LINK, { id: 'f-pr-2', label: 'Follow-up', kind: 'pullrequest' }],
};
const CANONICAL = 'https://github.com/acme/web/pull/42';

describe('a pull request address', () => {
  it('is a kind of its own, after Link, that may be required', () => {
    const kinds: readonly string[] = CUSTOM_FIELD_KINDS;
    expect(kinds.indexOf('pullrequest')).toBe(kinds.indexOf('link') + 1);
    expect(canBeRequired('pullrequest')).toBe(true);
  });

  it('takes any address of the pull request, kept as the canonical one', () => {
    for (const ok of [
      CANONICAL,
      ` ${CANONICAL} `,
      'http://github.com/acme/web/pull/42',
      'github.com/acme/web/pull/42',
      'https://www.github.com/acme/web/pull/42',
      'HTTPS://GitHub.com/acme/web/pull/42',
      'https://github.com/acme/web/pull/42/',
      'https://github.com/acme/web/pull/42/files',
      'https://github.com/acme/web/pull/42/commits/abc123',
      'https://github.com/acme/web/pull/42?w=1',
      'https://github.com/acme/web/pull/42#issuecomment-1',
    ])
      expect(pullRequestValueOf(ok), ok).toBe(CANONICAL);
  });

  it('keeps the owner and repository as given, and reads every allowed character', () => {
    expect(parsePullRequestUrl('https://github.com/Acme-Co/My_Web.app/pull/7')).toEqual({
      owner: 'Acme-Co',
      repo: 'My_Web.app',
      number: 7,
    });
    expect(
      pullRequestValueOf(`github.com/${'a'.repeat(39)}/${'r'.repeat(100)}/pull/9999999999`),
    ).toBe(`https://github.com/${'a'.repeat(39)}/${'r'.repeat(100)}/pull/9999999999`);
  });

  it('refuses anything that names no pull request', () => {
    for (const bad of [
      '',
      '   ',
      'https://gitlab.com/acme/web/pull/42',
      'https://github.company.com/acme/web/pull/42',
      'https://github.com',
      'https://github.com/acme/web',
      'https://github.com/acme/web/issues/42',
      'https://github.com/acme/web/pulls/42',
      'https://github.com/acme/web/pull/',
      'https://github.com/acme/web/pull/0',
      'https://github.com/acme/web/pull/042',
      'https://github.com/acme/web/pull/4a',
      'https://github.com/acme/web/pull/12345678901',
      'https://github.com//web/pull/42',
      'https://github.com/acme//pull/42',
      'https://github.com/ac_me/web/pull/42',
      `https://github.com/${'a'.repeat(40)}/web/pull/42`,
      `https://github.com/acme/${'r'.repeat(101)}/pull/42`,
      'https://github.com/acme/./pull/42',
      'https://github.com/acme/../pull/42',
      'https://github.com/acme/we b/pull/42',
      'https://github.com/acme/web/pull/42 and more',
      'javascript:alert(1)//github.com/acme/web/pull/42',
      'acme/web#42',
      `https://github.com/acme/web/pull/42?${'x'.repeat(PULL_REQUEST_TEXT_MAX)}`,
      42,
      null,
      undefined,
    ])
      expect(parsePullRequestUrl(bad), String(bad)).toBeUndefined();
    expect(PULL_REQUEST_HINT).toContain('https://github.com/acme/web/pull/42');
  });

  it('reads as its short name and counts once whatever the case', () => {
    const ref = parsePullRequestUrl(CANONICAL)!;
    expect(pullRequestText(ref)).toBe('acme/web#42');
    expect(pullRequestUrl(ref)).toBe(CANONICAL);
    expect(pullRequestKey(parsePullRequestUrl('github.com/ACME/Web/pull/42')!)).toBe(
      pullRequestKey(ref),
    );
    expect(pullRequestValueText(CANONICAL)).toBe('acme/web#42');
    expect(pullRequestValueText('not one')).toBeNull();
    expect(customFieldText(PR, CANONICAL)).toBe('acme/web#42');
    expect(customFieldText(PR, 5)).toBeNull();
  });

  it('is read in linear time, however long the paste', () => {
    const worst = `https://github.com/${'a/'.repeat(1000)}`;
    const long = `${'github.com/'.repeat(5000)}`;
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 200; i += 1) {
        parsePullRequestUrl(worst);
        parsePullRequestUrl(long);
      }
    });
    expect(ms).toBeLessThan(cpuBudgetMs(100));
  });
});

describe('a Pull Request field on every surface', () => {
  it('imports any address from a file as the canonical one, and skips anything else', () => {
    expect(customValueOfText(PR, 'github.com/acme/web/pull/42/files', [])).toBe(CANONICAL);
    expect(customValueOfText(PR, 'see the PR', [])).toBeUndefined();
  });

  it('takes an agent’s address canonical, and refuses one that is not a pull request with the hint', () => {
    const naming = { statuses: [], items: [] };
    expect(
      resolveFields({ 'Pull Request': 'github.com/acme/web/pull/42' }, TASK, naming),
    ).toMatchObject({ ok: true, fields: { 'f-pr': CANONICAL } });
    const refused = resolveFields({ 'Pull Request': 'https://example.com' }, TASK, naming);
    expect(refused).toMatchObject({ ok: false, code: 'value_invalid' });
    expect(JSON.stringify(refused)).toContain('paste a pull request');
  });

  it('keeps a value only when it is a pull request as a field changes kind', () => {
    const text: CustomFieldDef = { id: 'f-pr', label: 'Pull Request', kind: 'text' };
    expect(changedValue(text, PR, 'https://github.com/acme/web/pull/42/files')).toEqual({
      kind: 'rewritten',
      value: CANONICAL,
      trimmed: false,
    });
    expect(changedValue(LINK, PR, 'https://example.com')).toEqual({ kind: 'cleared' });
    expect(changedValue(PR, text, CANONICAL)).toEqual({
      kind: 'rewritten',
      value: CANONICAL,
      trimmed: false,
    });
  });
});

describe('the pull requests a card names', () => {
  it('reads Pull Request fields first, then Link fields holding one, each once', () => {
    const refs = cardPullRequests(
      {
        fields: {
          'f-pr': CANONICAL,
          'f-link': 'https://github.com/acme/api/pull/7/files',
          'f-pr-2': 'https://github.com/ACME/WEB/pull/42',
        },
      },
      TASK,
    );
    expect(refs.map(pullRequestText)).toEqual(['acme/web#42', 'acme/api#7']);
  });

  it('skips a Link that is no pull request, other kinds and a missing type', () => {
    const t: ItemTypeDef = {
      ...TASK,
      custom: [LINK, { id: 'f-note', label: 'Note', kind: 'text' }],
    };
    expect(
      cardPullRequests({ fields: { 'f-link': 'https://example.com', 'f-note': CANONICAL } }, t),
    ).toEqual([]);
    expect(cardPullRequests({ fields: { 'f-pr': CANONICAL } }, undefined)).toEqual([]);
  });

  it('stops at the most a card names', () => {
    const custom: CustomFieldDef[] = Array.from(
      { length: LINKED_PULL_REQUESTS_MAX + 2 },
      (_, i) => ({
        id: `f-${i}`,
        label: `PR ${i}`,
        kind: 'pullrequest',
      }),
    );
    const fields = Object.fromEntries(
      custom.map((f, i) => [f.id, `https://github.com/acme/web/pull/${i + 1}`]),
    );
    expect(cardPullRequests({ fields }, { custom })).toHaveLength(LINKED_PULL_REQUESTS_MAX);
  });
});
