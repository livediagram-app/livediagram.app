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
  accessRequestedEmail: 'ba70e016b33611707ae143316891e89bc4438163aeb02ade24fe7f2160bea7a3',
  accessGrantedEmail: 'ed0ece47a41bbd278eedcef11fdd6cfbdb7b2e5f1f609f863115b0dc661d17a2',
  approvalRequestedEmail: '3f0d9983dcf732f3efeb6ddffcfa449518b62eb18f0675c269fa9bf7fdc08520',
  accountDeletedEmail: '75b1d68f090810975a7b053eb7ff81552e89dbfda36032361887ac367e7bdb08',
  actionAssignedEmail: 'a708d59bf11b365f8270886612c3d09f5f18e10e64a23138c205bc3dc9d0330e',
  commentNotificationEmail: '65b2ac024b83838735f3bf65f2112389f4ebe56e435a760530f83e1aaae37e6b',
  documentJoinedEmail: '39dc7ca8ab4321be5f0c65c9801a50646730915a4b349fc3e90fee7c77b5f7c1',
  firstShareEmail: 'cbd681dfb43e98f52c431c6ba80c8815c63e3c8ba3f66caec4ca6d37240253d3',
  mentionQuote: '8d3f68955246da293e50ef5ebbe33ecdd4a4b7e9d61945db180b8771a547ead9',
  mentionedEmail: 'bbdc35813efac30f0227ce435b41c3634edefa33e1325aa403de6a93c949b4ac',
  milestoneEmail: '958a8b1cbfccf9875fba961a9670dd33dfc696f6996f3239b658cb91c31cade1',
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
