// @vitest-environment jsdom
// The door (blueprint ui.md "The door"): the host gives the footer its row and draws the app's screen or gate; the
// row counts the rules that are on, turns amber for one that paused, and opens whichever stands before the person.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutomationsAccess } from './AutomationsContext';
import {
  AUTOMATIONS_FIRST_READ_MS,
  AutomationsHost,
  type AutomationsGate,
  type AutomationsScreenProps,
} from './AutomationsHost';
import { automationsSignInHref, AutomationsSyncGate } from './AutomationsSyncGate';
import { useAutomationsToolsItem } from './automations-tools-item';
import type { AutomationsScope } from './kit';
import { fakeClient, fakeKit, fakeRule, SCOPE, type FakeClient } from './test/fake-kit';
import { forgetAutomations, readAutomations } from './use-automations';
import { useAutomationsGate } from './use-automations-gate';

function Row() {
  const item = useAutomationsToolsItem();
  if (!item) return <p>No row</p>;
  return (
    <button type="button" data-attention={item.attention} onClick={() => item.onSelect(null)}>
      {item.label} {item.description} {item.badges?.join(',')}
      {item.aside}
    </button>
  );
}
const Screen = ({ target, onTarget, onClose, signedIn }: AutomationsScreenProps) => (
  <div role="dialog" aria-label="Automations" data-signed-in={String(signedIn)}>
    {JSON.stringify(target)}
    <button type="button" onClick={() => onTarget({ view: 'templates' })}>
      Templates
    </button>
    <button type="button" onClick={onClose}>
      Close
    </button>
  </div>
);
const Gate = ({ gate, onClose }: { gate: AutomationsGate; onClose: () => void }) => (
  <div role="dialog" aria-label={`Gate ${gate.kind}`}>
    <button type="button" onClick={onClose}>
      Cancel
    </button>
  </div>
);

function host(
  client: FakeClient,
  scope: AutomationsScope | null,
  gate: AutomationsGate | null = null,
) {
  const { plumbing, track } = fakeKit(client);
  const ui = (s: AutomationsScope | null, g: AutomationsGate | null) => (
    <AutomationsHost plumbing={plumbing} scope={s} gate={g} signedIn Screen={Screen} Gate={Gate}>
      <Row />
    </AutomationsHost>
  );
  return { ...render(ui(scope, gate)), ui, track, plumbing };
}

beforeEach(() => {
  forgetAutomations();
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/item/i1');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the host and the footer’s row', () => {
  it('gives no row to someone with neither a scope nor a gate', () => {
    host(fakeClient(), null);
    expect(screen.getByText('No row')).toBeTruthy();
  });

  it('opens the app’s screen for an Editor, and reports it', () => {
    const { track } = host(fakeClient(), SCOPE);
    const row = screen.getByRole('button', { name: /Automations…/ });
    expect(row.textContent).toContain('Rules that act on this Space for you.');
    fireEvent.click(row);
    const dialog = screen.getByRole('dialog', { name: 'Automations' });
    expect(dialog.textContent).toContain('{"view":"rules"}');
    expect(dialog.dataset.signedIn).toBe('true');
    expect(track).toHaveBeenCalledWith('opened');
    fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
    expect(dialog.textContent).toContain('{"view":"templates"}');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reads the list once the item has settled, and counts the rules that are on', async () => {
    vi.useFakeTimers();
    const client = fakeClient([
      fakeRule(),
      fakeRule({ id: 'r2', enabled: false }),
      fakeRule({ id: 'r3', paused: { reason: 'gone', at: 1 } }),
    ]);
    host(client, SCOPE);
    expect(client.list).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOMATIONS_FIRST_READ_MS);
    });
    expect(client.list).toHaveBeenCalledTimes(1);
    const count = document.querySelector('[data-automations-count]')!;
    expect(count.getAttribute('aria-label')).toBe('2 on');
    // A rule paused itself: the row turns amber.
    expect(screen.getByRole('button', { name: /Automations…/ }).dataset.attention).toBe('amber');
  });

  it('shows no count for no rule on, and caps a long one', async () => {
    const none = fakeClient([fakeRule({ enabled: false })]);
    host(none, SCOPE);
    await act(async () => {
      await readAutomations(none, SCOPE);
    });
    expect(document.querySelector('[data-automations-count]')).toBeNull();
    cleanup();
    forgetAutomations();
    const many = fakeClient(Array.from({ length: 120 }, (_, i) => fakeRule({ id: `r${i}` })));
    host(many, SCOPE);
    await act(async () => {
      await readAutomations(many, SCOPE);
    });
    expect(document.querySelector('[data-automations-count]')!.textContent).toBe('99+');
  });

  it('opens the gate while the item must sync, then the screen once it has', () => {
    const client = fakeClient();
    const gate: AutomationsGate = {
      kind: 'sync',
      ready: true,
      sync: async () => {},
      badges: ['Sync Space'],
    };
    const { rerender, ui, track } = host(client, null, gate);
    const row = screen.getByRole('button', { name: /Automations…/ });
    expect(row.textContent).toContain('Sync Space');
    fireEvent.click(row);
    expect(screen.getByRole('dialog', { name: 'Gate sync' })).toBeTruthy();
    expect(track).toHaveBeenCalledWith('opened_offline');
    // Synced: the scope arrives, and the same opening goes on to the screen.
    rerender(ui(SCOPE, null));
    expect(screen.getByRole('dialog', { name: 'Automations' })).toBeTruthy();
    cleanup();
    const guest = host(client, null, { kind: 'sign_in' });
    fireEvent.click(screen.getByRole('button', { name: /Automations…/ }));
    expect(guest.track).toHaveBeenCalledWith('opened_sign_in');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens on arrival where a guest’s sign-in comes back, and drops the ask from the address', () => {
    window.history.replaceState(null, '', '/item/i1?automations=1&x=2#t=1');
    host(fakeClient(), SCOPE);
    expect(screen.getByRole('dialog', { name: 'Automations' })).toBeTruthy();
    expect(window.location.search + window.location.hash).toBe('?x=2#t=1');
  });

  it('hands an app’s own parts the scope and the way in', () => {
    function Reads() {
      const access = useAutomationsAccess();
      return (
        <button type="button" onClick={() => access?.open({ view: 'runs', ruleId: 'r1' })}>
          Runs of {access?.scope.itemId}
        </button>
      );
    }
    const { plumbing } = fakeKit(fakeClient());
    render(
      <AutomationsHost plumbing={plumbing} scope={SCOPE} Screen={Screen} Gate={Gate}>
        <Reads />
      </AutomationsHost>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Runs of i1' }));
    expect(screen.getByRole('dialog').textContent).toContain('{"view":"runs","ruleId":"r1"}');
  });
});

describe('the gate', () => {
  const input = {
    level: 'edit',
    structureReadOnly: false,
    offline: true,
    hydrated: true,
    embed: false,
    signedIn: true,
    authLoaded: true,
    scope: null,
  };
  function Uses({ over = {} }: { over?: Partial<typeof input> }) {
    const gate = useAutomationsGate({
      ...input,
      ...over,
      ready: true,
      sync: async () => {},
      badges: BADGES,
    });
    return <p>{gate ? `${gate.kind}:${gate.badges?.join()}` : 'none'}</p>;
  }
  const BADGES = ['Sync Space'];

  it('is Sync for an item kept Offline, Sign In for a guest, nothing for an Editor on a server item', () => {
    const { rerender } = render(<Uses />);
    expect(screen.getByText('sync:Sync Space')).toBeTruthy();
    rerender(<Uses over={{ signedIn: false }} />);
    expect(screen.getByText('sign_in:Sync Space')).toBeTruthy();
    rerender(<Uses over={{ offline: false }} />);
    expect(screen.getByText('none')).toBeTruthy();
  });

  it('draws the app’s own gate dialog, with where a guest signs in', () => {
    const seen: Record<string, unknown>[] = [];
    const Dialog = (props: Record<string, unknown>) => {
      seen.push(props);
      return null;
    };
    const signIn = (returnTo: string) => `/sign-in/?return=${encodeURIComponent(returnTo)}`;
    window.history.replaceState(null, '', '/item/i1?s=abc#t=2');
    render(
      <AutomationsSyncGate
        gate={{ kind: 'sign_in' }}
        onClose={() => {}}
        item="Space"
        help={null}
        signIn={signIn}
        Dialog={Dialog as never}
      />,
    );
    expect(seen[0]).toMatchObject({
      title: 'Automations',
      promptTitle: 'Sign In Needed',
      ready: true,
      signInHref: signIn('/item/i1?s=abc&automations=1#t=2'),
    });
    const sync = vi.fn(async () => {});
    render(
      <AutomationsSyncGate
        gate={{ kind: 'sync', ready: false, sync }}
        onClose={() => {}}
        item="Space"
        help={null}
        signIn={signIn}
        Dialog={Dialog as never}
      />,
    );
    expect(seen[1]).toMatchObject({
      promptTitle: 'Sync Space',
      ready: false,
      onSyncToCloud: sync,
      signInHref: undefined,
    });
    expect(automationsSignInHref({ pathname: '/p', search: '', hash: '' }, signIn)).toBe(
      signIn('/p?automations=1'),
    );
  });
});
