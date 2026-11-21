// @vitest-environment jsdom
// The list's store (blueprint ui.md "The door"): a refused list is read again only once the item is asked as someone
// else (another level or another person), never on a render that changes nothing.
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AutomationRefusal } from './automations-client';
import type { AutomationsScope } from './kit';
import { fakeClient, SCOPE } from './test/fake-kit';
import { forgetAutomations, useAutomations } from './use-automations';

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
