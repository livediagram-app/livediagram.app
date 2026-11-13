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
  accountDeletedEmail: '5333b9860bf5fae6cb5160923149384cc475bb4c5b33aca5f6bedb02b5151b17',
  actionAssignedEmail: 'dc95db5e1d00956f671a6244b456f1af84146cc8ff96b354beeafb5170d1f5a4',
  automationAddressEmail: '5ad4e6c7336a3eb40e9fd05b2fd865e272e31caa6b147a829af4fd5c57dc9030',
  automationEmail: '41f7dd42b5b05aceb55b7b6dc1c95d5fbda3a64aec2181e8730d131a8efd958a',
  commentNotificationEmail: 'd1791defcf18b7dca7b58d4b143fc509af641339a032fb14328d1e1c48ab5481',
  firstShareEmail: 'c65e8a751b3e08bcd12ca05170a3a62f0ad42fdc4fb9e7a3228658b5d1d36737',
  formResponseEmail: 'c89afa28b11f42d1464a29c5546f297f0f6f61113839d1b93c7c1e8e3d82b0f8',
  formSuspendedEmail: '4259b18e6c0b3e6e51ffdeec5916652ff4a5f1b5176246e716385afedf107f28',
  mentionQuote: '8d3f68955246da293e50ef5ebbe33ecdd4a4b7e9d61945db180b8771a547ead9',
  mentionedEmail: 'f64e56e51ba7d57b4857bb1cbde401fe4ec818ed71fcfb6a416a32eea534fc34',
  milestoneEmail: '530897a37a84a2e43347a57b9dcabb22b18e5bc83b30efa03a9d71e295b31a26',
  projectJoinedEmail: '7f69cf99201625678e01068af34489788fa04106c13563c37089d722e487e525',
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
