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
  accountDeletedEmail: 'd596d847791909014f7e17e5e4ef5884c0fd64acf81929aba70da286d0404d65',
  actionAssignedEmail: '201fbb2d8ab0960375463e0fd329387f6a19d7946a27edaca3f47b4d6ead47ea',
  callsBudgetEmail: '4998781c8fccebe8f82c62220b0e1444087de35369d4335fcf206c96c7fd4714',
  commentNotificationEmail: '28d201d0db3f0ddc9f64b75bad8de592c7ab313be7755bf2aef1bf47c4e9eee3',
  documentJoinedEmail: '74256549955c41b93097e5e32ad54ae288e16fa35b1157ee95ae93e0d8eb0862',
  firstShareEmail: 'dd49866d9ee31068aa9d88178f7344dfdea3a30b065748d0938e3b807c947e6f',
  mentionQuote: '8d3f68955246da293e50ef5ebbe33ecdd4a4b7e9d61945db180b8771a547ead9',
  mentionedEmail: '1afd04218d4590dde23788cb80ca33a502d93ac9dae3eb7f5b736133bf413c64',
  milestoneEmail: '7edfed3fff516e383115fe96323d502aebb187d6926b6aab9c2e7721cb81c8c0',
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
