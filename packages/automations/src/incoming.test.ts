import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  WEBHOOK_SECRET_BYTES,
  WEBHOOK_SECRET_PREFIX,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_SIGNATURE_HEADER_LEGACY,
  WEBHOOK_VALUE_MAX,
  readHookBody,
  webhookPathsIn,
  webhookValues,
} from './incoming';
import { WEBHOOK_PATH_DEPTH_MAX, WEBHOOK_PATH_NAME_MAX, webhookPathOf } from './webhook-paths';

describe('a webhook value’s path', () => {
  it('reads 1 to 5 names of letters, digits, _ and -', () => {
    expect(webhookPathOf('webhook.build.status')).toEqual(['build', 'status']);
    expect(webhookPathOf('webhook.a-b_c.0')).toEqual(['a-b_c', '0']);
    expect(webhookPathOf('rule')).toBeNull();
    expect(webhookPathOf('webhook.')).toBeNull();
    expect(webhookPathOf('webhook.a..b')).toBeNull();
    expect(webhookPathOf('webhook.a b')).toBeNull();
    expect(webhookPathOf(`webhook.${'x'.repeat(WEBHOOK_PATH_NAME_MAX + 1)}`)).toBeNull();
    expect(
      webhookPathOf(
        `webhook.${Array(WEBHOOK_PATH_DEPTH_MAX + 1)
          .fill('a')
          .join('.')}`,
      ),
    ).toBeNull();
  });

  it('checks a long hostile name in linear time', () => {
    const name = `webhook.${'a.'.repeat(50_000)}`;
    expect(cpuMsOf(() => webhookPathOf(name))).toBeLessThan(cpuBudgetMs(200));
  });
});

describe('the secret and its header', () => {
  it('is longer than HMAC-SHA256’s block, and both headers are named', () => {
    expect(WEBHOOK_SECRET_PREFIX).toBe('lwh_');
    expect(WEBHOOK_SECRET_BYTES).toBeGreaterThanOrEqual(64);
    expect(WEBHOOK_SIGNATURE_HEADER).toBe('X-Liveworkspace-Signature');
    expect(WEBHOOK_SIGNATURE_HEADER_LEGACY).not.toBe(WEBHOOK_SIGNATURE_HEADER);
  });
});

describe('the values a rule names', () => {
  it('finds each path once, wherever a text sits in the steps', () => {
    const steps = [
      { kind: 'notify', text: '{{webhook.build.status}} {{rule}}' },
      {
        kind: 'if',
        then: [{ kind: 'email', body: '{{ webhook.build.status }} {{webhook.id}}' }],
        n: 5,
      },
    ];
    expect(webhookPathsIn(steps)).toEqual(['build.status', 'id']);
  });

  it('reads a string (cut), a finite number or a boolean, by own properties and list places', () => {
    const payload = {
      build: { status: 'green', ok: true, took: 12.5, bad: Infinity, deep: { x: 1 } },
      list: ['a', { id: 7 }],
      long: 'x'.repeat(WEBHOOK_VALUE_MAX + 10),
      nothing: null,
    };
    const values = webhookValues(payload, [
      'build.status',
      'build.ok',
      'build.took',
      'build.bad',
      'build.deep',
      'build.status.length',
      'list.0',
      'list.1.id',
      'list.01',
      'long',
      'nothing',
      'constructor',
      'missing.path',
    ]);
    expect(values).toEqual({
      'build.status': 'green',
      'build.ok': true,
      'build.took': 12.5,
      'list.0': 'a',
      'list.1.id': 7,
      long: 'x'.repeat(WEBHOOK_VALUE_MAX),
    });
  });

  it('keeps a __proto__ path as the call’s own value', () => {
    const payload = JSON.parse('{"__proto__": "mine"}') as unknown;
    const values = webhookValues(payload, ['__proto__']);
    expect(Object.hasOwn(values, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(values)).toBe(Object.prototype);
  });
});

describe('a call’s body', () => {
  const subjects = {
    key: 'tabs',
    read: (v: unknown) =>
      Array.isArray(v) ? (v as string[]) : { error: 'tabs must be a list of tab names' },
  };

  it('must be a JSON object', () => {
    for (const raw of [null, [], 'text', 5])
      expect(readHookBody(raw)).toEqual({ error: 'The body must be a JSON object' });
  });

  it('names nothing without the app’s list, or without its key', () => {
    expect(readHookBody({ a: 1 })).toEqual({ subjects: [], payload: { a: 1 } });
    expect(readHookBody({ a: 1 }, subjects)).toEqual({ subjects: [], payload: { a: 1 } });
  });

  it('names what the app reads, or is refused with the app’s words', () => {
    expect(readHookBody({ tabs: ['Roadmap'] }, subjects)).toEqual({
      subjects: ['Roadmap'],
      payload: { tabs: ['Roadmap'] },
    });
    expect(readHookBody({ tabs: 'Roadmap' }, subjects)).toEqual({
      error: 'tabs must be a list of tab names',
    });
  });
});
