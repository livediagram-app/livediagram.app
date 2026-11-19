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
  accessRequestedEmail: '5ddbec2ccb8eb6b87038f9155805b7a826b31a68394c73def2dc4a2b8d75fc88',
  accessGrantedEmail: 'dc2de57b76e92043bd264a82d700c9c63666231a4b2d1c685fba8b78bbc7bbc1',
  approvalRequestedEmail: '3ba2c270959aed8ea4624df95bd6086da6195a1752f6dfde25da60658d064294',
  accountDeletedEmail: '4a524c2cdb03309bef0ebe1bcb5bab5a97d79b8150603f531ba3155450036b04',
  actionAssignedEmail: '83e7f2a50de6f0fb44320b6a3a9c2aad47b114c6e6a2f27c789ce325eb05fde5',
  commentNotificationEmail: '214125241f29df67a8a18b654769f54909a60d388422fabefc1ba68813b17526',
  documentJoinedEmail: 'b61a1744d07453592a77bb4c83828235695102c5b95c5bebf0b250b968bd9f8c',
  firstShareEmail: '00db957ea85550f7adbf5abe05cf4d55654ae6905ba0f719a052e90f3d5637a7',
  mentionQuote: '8d3f68955246da293e50ef5ebbe33ecdd4a4b7e9d61945db180b8771a547ead9',
  mentionedEmail: '55774b82f5e35def8c53a0d1f8068e85a4fecadedb5c49849ed061412a059574',
  milestoneEmail: '02b3790cb8e3110e2225823e49d788f2db4e3352c83996151eb3edbe6f4b17d7',
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
    if (recording()) console.log(`HASHES livediagram ${JSON.stringify(renders())}`);
    expect(renders()).toEqual(EXPECTED);
  });
});

// People see livediagram's files as canvases (domain-language.md "Canvas"), so no email says "document" in its subject
// or words; only the `/document/<id>` link path, which is an address, keeps the old name.
describe('emails call the file a canvas', () => {
  it('says no "document" in any subject or visible text', () => {
    const offenders: string[] = [];
    for (const [name, value] of Object.entries(templates)) {
      const cases = FIXTURES[name];
      if (typeof value !== 'function' || name === 'mentionQuote' || !cases) continue;
      const fn = value as (...args: unknown[]) => { subject: string; html: string };
      for (const args of cases) {
        const email = fn(ENVS[0], ...args);
        const visible = `${email.subject} ${email.html.replace(/<[^>]*>/g, ' ')}`;
        if (/document/i.test(visible)) offenders.push(name);
      }
    }
    expect(offenders).toEqual([]);
  });
});
