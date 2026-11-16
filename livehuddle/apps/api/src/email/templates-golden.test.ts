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
  accountDeletedEmail: [[]],
  documentJoinedEmail: [
    ['Q3 <plan> & "x"', 'Ann'],
    ['', null],
    ['  ', '  '],
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
  callsBudgetEmail: [
    [{ level: 'off', usageGb: 1234.5, costUsd: 3.456, thresholdUsd: 5, mode: 'off' }],
    [{ level: 'audio-only', usageGb: 10, costUsd: 1, thresholdUsd: 1, mode: 'audio-only' }],
  ],
  mentionQuote: [['  a   b  '], ['word '.repeat(100)], ['x'.repeat(400)]],
};

const EXPECTED: Record<string, string> = {
  accountDeletedEmail: 'be280ad9d2030912e275eb18daa3be536650c180d2b4a5a6a382290f0268a37d',
  actionAssignedEmail: '4b0e1703f6e836b6e86aebca77e41e1665e612fce2e44683ca6d0f0aa3155015',
  callsBudgetEmail: 'fd3baf5c60a12764b3ddbf89b1cebe95586b0f5e90643d8c25f52fe0a3c485a3',
  commentNotificationEmail: '4d5c95d4863c0fefa9abb9ae3cc0fd8ee8c0aaab1329f4ff613b17b3a60dd163',
  documentJoinedEmail: 'd6869259fc2a455ea6c9ee1bbe3cdea593331dec95e4cd612295aa1d78764c68',
  firstShareEmail: '75250c23815d831dd8a88ffb5d1c1ab8a101b66c2cb340c19b5e581c2c4cbe9b',
  mentionQuote: '8d3f68955246da293e50ef5ebbe33ecdd4a4b7e9d61945db180b8771a547ead9',
  mentionedEmail: '2cd80eaebc581b5a0ced67e5535a2e7ded4f050af56424a9ef1092548527070e',
  milestoneEmail: 'b45062b3d00495c480898408a302b951a518f8392e1022e73671e5006ba52e79',
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
    if (recording()) console.log(`HASHES livehuddle ${JSON.stringify(renders())}`);
    expect(renders()).toEqual(EXPECTED);
  });
});
