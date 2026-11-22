// @vitest-environment jsdom
// The Share dialog's Team tab and Sign In card (one-explorer-contracts.md "Sharing and access", Work Tracker 1330,
// 1331 and 1338): where a team item opens, its link and the way to Passes; Require Sign In and email domains, typed,
// checked and saved, the team item's suggested domain, and the host's lock.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IndexError,
  SHARE_SIGN_IN_OFF,
  type IndexClient,
  type ShareSignInRule,
} from '@liveworkspace/index-client';
import { failureText } from '../data/errors';
import { ShareDialog, type ShareDialogProps } from './ShareDialog';
import { domainsProblem, domainsText } from './share/SignInSection';
import { shareStatusShort, shareStatusText } from './share/ShareStatus';

function fakeClient(seed: { signIn?: ShareSignInRule; suggestedDomain?: string | null } = {}) {
  let signIn = seed.signIn ?? SHARE_SIGN_IN_OFF;
  const set: unknown[] = [];
  let refuse: IndexError | null = null;
  const client = {
    listShareLinks: async () => ({
      links: [],
      passwordSet: false,
      signIn,
      suggestedDomain: seed.suggestedDomain ?? null,
    }),
    setShareSignIn: async (_id: string, input: ShareSignInRule) => {
      set.push(input);
      if (refuse) throw refuse;
      signIn = {
        requireAccount: input.requireAccount || input.domains.length > 0,
        domains: [...input.domains],
      };
      return { signIn };
    },
  } as unknown as IndexClient;
  return { client, set, refuseWith: (e: IndexError) => (refuse = e) };
}

const TEAM_ITEM = {
  id: 'p1',
  app: 'liveplanner' as const,
  kind: 'plan' as const,
  sharedVia: null,
  title: 'Roadmap',
  teamId: 'team1',
};

function renderDialog(over: Partial<ShareDialogProps> = {}, seed = {}) {
  const fake = fakeClient(seed);
  const notify = vi.fn();
  const props: ShareDialogProps = {
    client: fake.client,
    item: { id: 'p1', app: 'liveplanner', kind: 'plan', sharedVia: null, title: 'Roadmap' },
    shareUrl: (l) => `https://x.test/s/${l.code}`,
    onClose: vi.fn(),
    notify,
    ...over,
  };
  render(<ShareDialog {...props} />);
  return { ...fake, notify };
}

let writeText: ReturnType<typeof vi.fn>;
beforeEach(() => {
  writeText = vi.fn(async () => {});
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

const toggle = (name: RegExp) => screen.getByRole('switch', { name });

describe('the Team tab', () => {
  it('opens a team item on Team, first in the tab row, with its own link to copy', async () => {
    renderDialog({
      item: TEAM_ITEM,
      itemUrl: 'https://www.liveplanner.app/project/p1',
      teamName: 'Acme',
    });
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['Team', 'Passes']);
    expect(screen.getByRole('tab', { name: 'Team' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Everyone in Acme can already open this plan')).toBeTruthy();
    const field = screen.getByRole('textbox', { name: 'Link to this plan' }) as HTMLInputElement;
    expect(field.value).toBe('https://www.liveplanner.app/project/p1');
    expect(field.readOnly).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('https://www.liveplanner.app/project/p1'),
    );
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('takes the sharer to Passes in one click, to share with someone outside the team', async () => {
    renderDialog({ item: TEAM_ITEM });
    fireEvent.click(screen.getByRole('button', { name: 'Share With Someone Outside the Team' }));
    expect(screen.getByRole('tab', { name: 'Passes' }).getAttribute('aria-selected')).toBe('true');
    expect(
      await screen.findByText(/No passes yet\. Only the team can open this plan/),
    ).toBeTruthy();
    // And back.
    fireEvent.click(screen.getByRole('tab', { name: 'Team' }));
    expect(screen.getByText('Everyone in the team can already open this plan')).toBeTruthy();
  });

  it('builds the item’s own address on this page when the host names none', () => {
    renderDialog({ item: TEAM_ITEM });
    const field = screen.getByRole('textbox', { name: 'Link to this plan' }) as HTMLInputElement;
    expect(field.value).toBe(`${window.location.origin}/project/p1`);
  });

  it('says when the clipboard refused', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    const { notify } = renderDialog({ item: TEAM_ITEM });
    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        'Couldn’t copy the link. Select it to copy it yourself.',
        'error',
      ),
    );
  });

  it('opens a personal item on Passes with no Team tab', () => {
    renderDialog();
    expect(screen.queryByRole('tab', { name: 'Team' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Create Pass' })).toBeTruthy();
  });

  it('lets the host’s own start win, and Show Me still starts on Passes', () => {
    renderDialog({
      item: TEAM_ITEM,
      appTab: { label: 'Community', panel: <p>Community panel</p> },
      initialView: 'app',
    });
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Team',
      'Passes',
      'Community',
    ]);
    expect(screen.getByText('Community panel')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Team' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show Me' }));
    expect(screen.getByRole('tab', { name: 'Passes' }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('the Sign In card', () => {
  it('turns Require Sign In on and off, reading back what the index stored', async () => {
    const { set } = renderDialog();
    await waitFor(() =>
      expect(toggle(/Require Sign In/).getAttribute('aria-checked')).toBe('false'),
    );
    fireEvent.click(toggle(/Require Sign In/));
    await waitFor(() =>
      expect(toggle(/Require Sign In/).getAttribute('aria-checked')).toBe('true'),
    );
    expect(screen.getByRole('status').textContent).toContain('only you');
    fireEvent.click(toggle(/Require Sign In/));
    await waitFor(() =>
      expect(toggle(/Require Sign In/).getAttribute('aria-checked')).toBe('false'),
    );
    expect(set).toEqual([
      { requireAccount: true, domains: [] },
      { requireAccount: false, domains: [] },
    ]);
  });

  it('opens the domain box, checks what is typed, saves it normalised and shows chips with Change', async () => {
    const { set } = renderDialog();
    await screen.findByText('Anybody With Email Address Domain');
    fireEvent.click(toggle(/Anybody With Email Address Domain/));
    const box = screen.getByRole('textbox', { name: 'Email domains' }) as HTMLInputElement;
    expect(box.value).toBe('');
    const save = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save().disabled).toBe(true);
    fireEvent.change(box, { target: { value: '@acme.com nope' } });
    expect(screen.getByText('“nope” isn’t an email domain. Use names like acme.com.')).toBeTruthy();
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(save().disabled).toBe(true);
    fireEvent.change(box, { target: { value: '@Acme.com, liveworkspace.app' } });
    expect(save().disabled).toBe(false);
    fireEvent.click(save());
    const chips = await screen.findByRole('list', { name: 'Email domains' });
    expect(
      within(chips)
        .getAllByRole('listitem')
        .map((c) => c.textContent),
    ).toEqual(['@acme.com', '@liveworkspace.app']);
    expect(set).toEqual([{ requireAccount: true, domains: ['acme.com', 'liveworkspace.app'] }]);
    // Domains hold sign-in on, and say so.
    const require = toggle(/Require Sign In/);
    expect(require.getAttribute('aria-checked')).toBe('true');
    expect(
      require.hasAttribute('disabled') || require.getAttribute('aria-disabled') === 'true',
    ).toBe(true);
    expect(
      screen.getByText('On while email domains are set: only accounts can be at a domain.'),
    ).toBeTruthy();
    // Change opens the box with what is saved; Escape backs out and keeps the dialog.
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    const again = screen.getByRole('textbox', { name: 'Email domains' }) as HTMLInputElement;
    expect(again.value).toBe('@acme.com @liveworkspace.app');
    fireEvent.keyDown(again, { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Email domains' })).toBeNull();
    expect(screen.getByRole('list', { name: 'Email domains' })).toBeTruthy();
    // Off removes the domains and leaves sign-in on.
    fireEvent.click(toggle(/Anybody With Email Address Domain/));
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Email domains' })).toBeNull());
    expect(set[1]).toEqual({ requireAccount: true, domains: [] });
    expect(toggle(/Require Sign In/).getAttribute('aria-checked')).toBe('true');
  });

  it('starts a team item’s box with the sharer’s own domain', async () => {
    renderDialog({ item: TEAM_ITEM, initialView: 'passes' }, { suggestedDomain: 'acme.com' });
    fireEvent.click(screen.getByRole('tab', { name: 'Passes' }));
    await screen.findByText('Anybody With Email Address Domain');
    await act(async () => {});
    fireEvent.click(toggle(/Anybody With Email Address Domain/));
    expect((screen.getByRole('textbox', { name: 'Email domains' }) as HTMLInputElement).value).toBe(
      '@acme.com',
    );
    // Switched back off before saving: the box closes, nothing is sent.
    fireEvent.click(toggle(/Anybody With Email Address Domain/));
    expect(screen.queryByRole('textbox', { name: 'Email domains' })).toBeNull();
  });

  it('keeps the box open and says why when the index refuses', async () => {
    const fake = renderDialog();
    fake.refuseWith(new IndexError(400, 'invalid_domain'));
    await screen.findByText('Anybody With Email Address Domain');
    fireEvent.click(toggle(/Anybody With Email Address Domain/));
    fireEvent.change(screen.getByRole('textbox', { name: 'Email domains' }), {
      target: { value: 'acme.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(fake.notify).toHaveBeenCalledWith(
        'One of those isn’t an email domain. Use names like acme.com.',
        'error',
      ),
    );
    expect(screen.getByRole('textbox', { name: 'Email domains' })).toBeTruthy();
  });

  it("locks both switches with the host's reason, and still lets a rule in force be turned off", async () => {
    renderDialog({ signInLockedReason: 'Remove it from the Community first.' }, {});
    await screen.findByText('Anybody With Email Address Domain');
    expect(screen.getAllByText('Remove it from the Community first.').length).toBeGreaterThan(0);
    const require = toggle(/Require Sign In/);
    expect(
      require.hasAttribute('disabled') || require.getAttribute('aria-disabled') === 'true',
    ).toBe(true);
  });

  it('shows a rule already set as on, with its domains', async () => {
    renderDialog({}, { signIn: { requireAccount: true, domains: ['acme.com'] } });
    expect(await screen.findByRole('list', { name: 'Email domains' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('only you');
  });
});

describe('sign-in helpers', () => {
  it('says what is wrong with typed domains, or nothing', () => {
    expect(domainsProblem('')).toBeNull();
    expect(domainsProblem('acme.com, b.org')).toBeNull();
    expect(domainsProblem('acme')).toBe('“acme” isn’t an email domain. Use names like acme.com.');
    expect(domainsProblem(Array.from({ length: 21 }, (_, i) => `d${i}.com`).join(' '))).toBe(
      'Up to 20 domains.',
    );
    expect(domainsText(['acme.com', 'b.org'])).toBe('@acme.com @b.org');
  });

  it('words the status line with the rule', () => {
    const base = { passes: 2, password: false, team: false, word: 'plan' };
    expect(shareStatusText({ ...base, signIn: { requireAccount: true, domains: [] } })).toBe(
      'Shared: anyone signed in holding one of the 2 passes can get in.',
    );
    expect(
      shareStatusText({ ...base, signIn: { requireAccount: true, domains: ['acme.com'] } }),
    ).toBe('Shared: anyone at acme.com holding one of the 2 passes can get in.');
    expect(
      shareStatusText({ ...base, signIn: { requireAccount: true, domains: ['a.com', 'b.com'] } }),
    ).toBe('Shared: anyone at a.com or 1 more holding one of the 2 passes can get in.');
    expect(shareStatusShort({ ...base, signIn: { requireAccount: true, domains: [] } })).toBe(
      'Shared: 2 passes live, sign-in on',
    );
    expect(
      shareStatusShort({ ...base, signIn: { requireAccount: true, domains: ['a.com', 'b.com'] } }),
    ).toBe('Shared: 2 passes live, 2 domains only');
  });

  it('words the index’s refusals of a rule', () => {
    expect(failureText(new IndexError(400, 'too_many_domains'), 'x')).toBe('Up to 20 domains.');
  });
});
