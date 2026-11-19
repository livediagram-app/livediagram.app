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

const FORM = { heading: 'Sign <up> & "go"', projectId: 'p 1', projectName: 'Plan & co' };
const FIXTURES: Record<string, unknown[][]> = {
  accountDeletedEmail: [[]],
  projectJoinedEmail: [
    ['Q3 <plan> & "x"', 'Ann'],
    ['', null],
    ['  ', '  '],
  ],
  actionAssignedEmail: [
    ['Bo <b>', { id: 'a b', name: 'N<' }, 'Do it', 'desc & more'],
    [null, null, ' X ', null],
    ['Bo', { id: 'x', name: ' ' }, 'a', 'y'.repeat(250)],
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
  formResponseEmail: [
    [FORM, 'Card <1>', 0],
    [FORM, 'Card', 3],
  ],
  automationEmail: [
    [
      {
        subject: 'S <x>',
        body: 'B\nline & two',
        rule: 'R',
        planName: 'P',
        cardUrl: 'https://x/y?a=1&b=2',
      },
    ],
  ],
  automationAddressEmail: [
    [
      {
        subject: 'S <x>',
        body: 'B\nline & two',
        rule: 'R',
        planName: 'P',
        cardUrl: 'https://x/y?a=1&b=2',
        unsubscribeUrl: 'https://x/api/email-optout/p/t',
        unsubscribePage: 'https://x/email-optout?p=p&t=t',
      },
    ],
  ],
  formSuspendedEmail: [[FORM]],
  mentionQuote: [['  a   b  '], ['word '.repeat(100)], ['x'.repeat(400)]],
};

const EXPECTED: Record<string, string> = {
  accountDeletedEmail: '40b3ce60a5f46f012a1b4b12b74f4b198a90913314d06113d96bc4cc32fe6063',
  actionAssignedEmail: '4536ec03977842845924c44bf6fabd1e0d3b799a0f6d6be72c50202c45f73c75',
  approvalRequestedEmail: '361474115ae0159b33fd97bca3ec49b670c4ecebdb761479e0a1c9d1cd048c09',
  automationAddressEmail: '2f5c40eefb275f8b0b6abecc38caa50c704abfa46ef6cc2c8ec6b6a3b6087a62',
  automationEmail: '00459a50e9c575ca8b4fe8e82b9d5dffe7362729b54fe472ce8d0e21831333c8',
  commentNotificationEmail: 'd67533e81468cbc72d7df8b406de54a9692dc6ab98deea5ba1ad3398441490de',
  firstShareEmail: 'b737bf7aafbb563c57be7634303fbe8db1c5a4792ebdb0ac1975b909ae740baa',
  formResponseEmail: '9ff7fec86671bb122718fff9a11328cdc699c504732fd0510a37c422adaa1dd5',
  formSuspendedEmail: 'eb4eb858fb2bed9bea1926510be10f841e3c9f2e5bd02d3cf3beee900e7970f1',
  mentionQuote: '8d3f68955246da293e50ef5ebbe33ecdd4a4b7e9d61945db180b8771a547ead9',
  mentionedEmail: 'c2288762e850f57e2d6b797e4acb2fd3a45465195a9add924e0ad9993361f32d',
  milestoneEmail: 'a429bdb880126e40c54f6d515ea48fe27b00647b8ce43e6a5283a909e60c7ede',
  projectJoinedEmail: '05b0440cda152eab3f9cc8fe9fb60398d7e6f89802e8af5db52a7b87456abc0d',
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
    if (recording()) console.log(`HASHES liveplanner ${JSON.stringify(renders())}`);
    expect(renders()).toEqual(EXPECTED);
  });
});
