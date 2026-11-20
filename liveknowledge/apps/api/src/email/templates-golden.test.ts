import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import * as templates from './templates';

// Every email this api sends, rendered from fixed inputs and pinned by hash: subjects and bodies stay byte for byte
// what they were before the shared layout (@liveworkspace/email/layout) took the shell, and any change to one shows
// here. Re-record a hash (RECORD_EMAIL_HASHES=1 prints them) only for a change to an email that is meant.
// Node's environment, read without the node types this Worker's tsconfig leaves out.
const recording = () =>
  !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
    .RECORD_EMAIL_HASHES;

const ENVS = [{}, { APP_BASE_URL: 'https://www.example.app/' }] as unknown as Env[];

const FIXTURES: Record<string, unknown[][]> = {
  accessRequestedEmail: [
    [
      {
        requestId: 'req 1',
        requesterName: 'Ana <a>',
        item: { id: 'a b', name: 'N<' },
        note: 'on & in',
      },
    ],
    [{ requestId: 'r2', requesterName: null, item: { id: 'x', name: ' ' }, note: null }],
  ],
  accessGrantedEmail: [
    [{ granterName: 'Bo <b>', item: { id: 'a b', name: 'N<' }, level: 'view' }],
    [{ granterName: null, item: { id: 'x', name: '' }, level: 'edit' }],
  ],
  accountDeletedEmail: [[]],
  documentJoinedEmail: [
    ['Q3 <plan> & "x"', 'Ann'],
    ['', null],
    ['  ', '  '],
  ],
  approvalRequestedEmail: [
    [
      {
        requesterName: 'Ada <a>',
        item: { id: 'a b', name: 'N<' },
        note: 'n & m',
        due: '2026-11-20',
      },
    ],
    [{ requesterName: null, item: { id: 'x', name: ' ' }, note: null, due: null }],
  ],
  actionAssignedEmail: [
    ['Bo <b>', { id: 'a b', name: 'N<' }, 'Do it', 'desc & more'],
    [null, null, ' X ', null],
    ['Bo', { id: 'x', name: ' ' }, 'a', 'y'.repeat(250)],
  ],
  mentionedEmail: [
    ['Al', 'Name <1>', 'id/1', 'hi <b>there</b>'],
    [null, '', 'x', 'word '.repeat(100)],
    ['Al', 'P', 'p1', 't', 'card1/thr2'],
    ['Al', 'P', 'p1', 't', 'card1'],
  ],
  commentNotificationEmail: [
    ['N\nline <x>', 'i d', 'C & D'],
    ['', 'x', null],
  ],
  milestoneEmail: [[10], [250]],
  firstShareEmail: [[]],
  mentionQuote: [['  a   b  '], ['word '.repeat(100)], ['x'.repeat(400)]],
};

const EXPECTED: Record<string, string> = {
  accessRequestedEmail: '20f2205678674ef5450bd24958ad5b1685718ad7f2031e7bc3cfcd7d0b97bd2b',
  accessGrantedEmail: '9c59fc822dc1cb275bd8919d39f8b661a1a157140a72adf61fc3bd8a157bafe0',
  approvalRequestedEmail: '282fdee15a19586194a0e8db7259ef1260000a5dac922626bed381454917b436',
  accountDeletedEmail: '5a83f249b242d53a149cc2f270f7b8b2a3d6964f753a19e1c961dcc00cf001c6',
  actionAssignedEmail: 'ba501ba8f43f88f5e1e8aacb130b7405fa64d9a47da33834d1a378667d4e72a0',
  commentNotificationEmail: 'c69894ab6b821af4ef3440a7ef05a242f613e725e4d4626ccd48f7cd54b7b9d8',
  documentJoinedEmail: '6f4405fb6840e3ed767ec158552699b15b1dcdeb34594af633f73777e8702ecf',
  firstShareEmail: '9a17abc98c01767945fc5e0b1fc4ae76578f77b62c32ec9da392475bce6dec59',
  mentionQuote: '8d3f68955246da293e50ef5ebbe33ecdd4a4b7e9d61945db180b8771a547ead9',
  mentionedEmail: '860132dc3a08186835de065096027e253672b1182ce577edc0c903c40f4a8ee1',
  milestoneEmail: 'c230c2e528eb770befc6a4e8093b1ed3da657e9764b2fd008d292c8e87368645',
};

function renders(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(templates)) {
    if (typeof value !== 'function') continue;
    const cases = FIXTURES[name];
    if (!cases) throw new Error(`no fixtures for ${name}`);
    const fn = value as (...args: unknown[]) => unknown;
    const results =
      name === 'mentionQuote'
        ? cases.map((args) => fn(...args))
        : ENVS.flatMap((env) => cases.map((args) => fn(env, ...args)));
    out[name] = createHash('sha256').update(JSON.stringify(results)).digest('hex');
  }
  return out;
}

describe('rendered emails stay byte-identical', () => {
  it('matches every pinned hash', () => {
    if (recording()) console.log(`HASHES liveknowledge ${JSON.stringify(renders())}`);
    expect(renders()).toEqual(EXPECTED);
  });
});
