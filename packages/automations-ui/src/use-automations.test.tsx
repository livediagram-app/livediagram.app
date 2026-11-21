// @vitest-environment jsdom
// The list's store (blueprint ui.md "The door"): a refused list is read again only once the item is asked as someone
// else (another level or another person), never on a render that changes nothing.
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AutomationRefusal } from './automations-client';
import type { AutomationsScope } from './kit';
import { fakeClient, SCOPE } from './test/fake-kit';
import { forgetAutomations, readAutomations, useAutomations } from './use-automations';

const readAutomationsNow = (client: ReturnType<typeof fakeClient>) =>
  readAutomations(client, SCOPE);

const refused = () => new AutomationRefusal(403, { error: 'automations_need_editor' });

function Reader({
  client,
  scope,
}: {
  client: ReturnType<typeof fakeClient>;
  scope: AutomationsScope;
}) {
  const { status } = useAutomations(client, scope);
  return <p data-status={status} />;
}
const statusOf = () => document.querySelector('[data-status]')!.getAttribute('data-status');

beforeEach(() => forgetAutomations());
afterEach(cleanup);

describe('a refused list', () => {
  it('is read again when the asker changes, and only then', async () => {
    const client = fakeClient();
    client.list.mockRejectedValueOnce(refused());
    const viewer = { ...SCOPE, as: 'u1:view' };
    const { rerender } = render(<Reader client={client} scope={viewer} />);
    await act(async () => {});
    expect(statusOf()).toBe('refused');
    expect(client.list).toHaveBeenCalledTimes(1);
    // A render with the same asker (a fresh object) reads nothing.
    rerender(<Reader client={client} scope={{ ...viewer }} />);
    await act(async () => {});
    expect(client.list).toHaveBeenCalledTimes(1);
    // Made an Editor: read again, and ready.
    rerender(<Reader client={client} scope={{ ...SCOPE, as: 'u1:edit' }} />);
    await act(async () => {});
    expect(client.list).toHaveBeenCalledTimes(2);
    expect(statusOf()).toBe('ready');
  });

  it('is read again for another person at the same level', async () => {
    const client = fakeClient();
    client.list.mockRejectedValueOnce(refused()).mockRejectedValueOnce(refused());
    const { rerender } = render(<Reader client={client} scope={{ ...SCOPE, as: 'u1:edit' }} />);
    await act(async () => {});
    rerender(<Reader client={client} scope={{ ...SCOPE, as: 'u2:edit' }} />);
    await act(async () => {});
    expect(client.list).toHaveBeenCalledTimes(2);
    expect(statusOf()).toBe('refused');
    // Refused again for the same person: no loop.
    await act(async () => {});
    expect(client.list).toHaveBeenCalledTimes(2);
  });
});

describe('after a run', () => {
  function Runner({ client }: { client: ReturnType<typeof fakeClient> }) {
    const api = useAutomations(client, SCOPE);
    return (
      <>
        <p data-runs={api.data?.runsToday ?? ''} />
        <button type="button" onClick={() => void api.run('r1', null).catch(() => {})}>
          Run
        </button>
        <button type="button" onClick={() => void api.test(api.data!.rules[0]!, null)}>
          Test
        </button>
      </>
    );
  }
  const runsOf = () => document.querySelector('[data-runs]')!.getAttribute('data-runs');
  const press = (name: string) =>
    act(async () => {
      document
        .querySelectorAll<HTMLButtonElement>('button')
        .forEach((b) => b.textContent === name && b.click());
    });

  it('reads the list again, so Last Run and the day’s runs show it; a test reads nothing', async () => {
    const client = fakeClient();
    render(<Runner client={client} />);
    await act(async () => {});
    expect(client.list).toHaveBeenCalledTimes(1);
    expect(runsOf()).toBe('3');
    client.list.mockResolvedValueOnce({ rules: [], runsToday: 4, runsPerDay: 1000 });
    await press('Run');
    expect(client.run).toHaveBeenCalledTimes(1);
    expect(client.list).toHaveBeenCalledTimes(2);
    expect(runsOf()).toBe('4');
    await press('Test');
    expect(client.test).toHaveBeenCalledTimes(1);
    expect(client.list).toHaveBeenCalledTimes(2);
  });

  it('reads it again after a run that failed too, and once more when a read was under way', async () => {
    const client = fakeClient();
    render(<Runner client={client} />);
    await act(async () => {});
    client.run.mockRejectedValueOnce(new Error('offline'));
    await press('Run');
    expect(client.list).toHaveBeenCalledTimes(2);
    // A read under way as the run lands: it reads once more, after the run.
    let release!: () => void;
    client.list.mockImplementationOnce(
      () =>
        new Promise((done) => {
          release = () => done({ rules: [], runsToday: 9, runsPerDay: 1000 });
        }),
    );
    await act(async () => {
      void readAutomationsNow(client);
    });
    await press('Run');
    await act(async () => release());
    expect(client.list).toHaveBeenCalledTimes(4);
  });
});
