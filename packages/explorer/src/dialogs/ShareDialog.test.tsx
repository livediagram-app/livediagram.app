// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IndexClient, ShareLink } from '@liveworkspace/index-client';
import { ShareDialog, type ShareDialogProps } from './ShareDialog';
import { embedSnippet, liveImageHtml, liveImageMarkdown } from './share/handover';
import { passwordToSave } from './share/PasswordSection';
import { shareStatusText } from './share/ShareStatus';

const DAY = 24 * 60 * 60 * 1000;

function link(code: string, over: Partial<ShareLink> = {}): ShareLink {
  return {
    code,
    itemId: 'p1',
    level: 'view',
    tabId: null,
    expiry: 'never',
    expiresAt: null,
    createdAt: 1,
    ...over,
  };
}

function fakeShareClient(seed: { links?: ShareLink[]; passwordSet?: boolean } = {}) {
  let links = [...(seed.links ?? [])];
  let passwordSet = seed.passwordSet ?? false;
  const calls: { method: string; args: unknown[] }[] = [];
  let n = 0;
  const client = {
    listShareLinks: async () => ({ links, passwordSet }),
    createShareLink: async (_id: string, input: Partial<ShareLink>) => {
      calls.push({ method: 'createShareLink', args: [input] });
      const made = link(`new${++n}`, { ...input, createdAt: Date.now() });
      links = [made, ...links];
      return { link: made };
    },
    revokeShareLink: async (code: string) => {
      calls.push({ method: 'revokeShareLink', args: [code] });
      links = links.filter((l) => l.code !== code);
    },
    updateShareLink: async (code: string, input: Partial<ShareLink>) => {
      const next = { ...links.find((l) => l.code === code)!, ...input };
      return { link: next };
    },
    extendShareLink: async (code: string) => ({
      link: { ...links.find((l) => l.code === code)!, expiresAt: Date.now() + 7 * DAY },
    }),
    setSharePassword: async (_id: string, password: string | null) => {
      calls.push({ method: 'setSharePassword', args: [password] });
      passwordSet = password !== null;
      return { passwordSet };
    },
  } as unknown as IndexClient;
  return { client, calls };
}

function renderDialog(over: Partial<ShareDialogProps> = {}, seed = {}) {
  const fake = fakeShareClient(seed);
  const notify = vi.fn();
  const onTelemetry = vi.fn();
  const props: ShareDialogProps = {
    client: fake.client,
    item: { id: 'p1', app: 'liveplanner', kind: 'plan', sharedVia: null, title: 'Roadmap' },
    shareUrl: (l) => `https://x.test/s/${l.code}`,
    onClose: vi.fn(),
    notify,
    onTelemetry,
    ...over,
  };
  render(<ShareDialog {...props} />);
  return { ...fake, notify, onTelemetry, props };
}

let writeText: ReturnType<typeof vi.fn>;
beforeEach(() => {
  writeText = vi.fn(async () => {});
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});
afterEach(() => vi.useRealTimers());

describe('ShareDialog', () => {
  it('starts a new pass as an Editor’s, and issues and copies it with a note and a highlight', async () => {
    const { calls, notify, onTelemetry } = renderDialog();
    expect(screen.getByRole('radio', { name: /Editor/ }).getAttribute('aria-checked')).toBe('true');
    expect(await screen.findByText(/No passes yet\. Only you can open this plan/)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain(
      'Private: only you can open this plan.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create Pass' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Pass created and copied', 'success'));
    expect(calls[0]).toEqual({
      method: 'createShareLink',
      args: [{ level: 'edit', tabId: null, expiry: 'never' }],
    });
    expect(writeText).toHaveBeenCalledWith('https://x.test/s/new1');
    expect(onTelemetry).toHaveBeenCalledWith('Copied', 'ShareLink');
    const pass = document.querySelector('[data-share-link="new1"]')!;
    expect(pass.hasAttribute('data-share-pass-highlight')).toBe(true);
    // The count beside Passes, and the status line says who can get in.
    const heading = screen.getByRole('heading', { name: /Passes/ });
    expect(heading.textContent).toContain('1');
    expect(screen.getByRole('status').textContent).toContain('anyone holding the pass');
  });

  it('says when the clipboard refused, rather than failing quietly', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    const { notify } = renderDialog({}, { links: [link('a1')] });
    fireEvent.click(await screen.findByRole('button', { name: 'Copy link' }));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        'Couldn’t copy the link. Select it to copy it yourself.',
        'error',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create Pass' }));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('Pass created. Copy it from its card.', 'info'),
    );
  });

  it('asks before revoking, then revokes', async () => {
    const { calls, onTelemetry } = renderDialog({}, { links: [link('a1')] });
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke link' }));
    const ask = screen.getByRole('alertdialog', { name: 'Revoke this pass?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }));
    expect(calls.filter((c) => c.method === 'revokeShareLink')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Revoke link' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Revoke' }),
    );
    await waitFor(() => expect(calls).toContainEqual({ method: 'revokeShareLink', args: ['a1'] }));
    await waitFor(() => expect(onTelemetry).toHaveBeenCalledWith('Removed', 'ShareLink'));
  });

  it('lists expired passes apart, with Extend, and ticks a live one down', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const now = Date.now();
    renderDialog(
      {},
      {
        links: [
          link('old', { expiry: 'week', expiresAt: now - 1000, createdAt: 1 }),
          link('soon', { expiry: 'week', expiresAt: now + 90 * 60_000, createdAt: 2 }),
        ],
      },
    );
    const expired = await screen.findByRole('heading', { name: /Expired/ });
    expect(expired.textContent).toContain('1');
    expect(screen.getByRole('button', { name: 'Extend 1 week' })).toBeTruthy();
    const countdown = document.querySelector('[data-share-countdown]')!;
    expect(countdown.textContent).toBe('2h left');
    await act(async () => {
      vi.advanceTimersByTime(60 * 60_000);
    });
    expect(document.querySelector('[data-share-countdown]')!.textContent).toBe('30m left');
  });

  it('tags passes with the password, trims it, and turns the live image off while one is set', async () => {
    const { calls } = renderDialog(
      {
        handOver: {
          embedUrl: (l) => `https://x.test/embed?s=${l.code}`,
          liveImageUrl: (l) => `https://x.test/api/share/${l.code}/image.svg`,
        },
      },
      { links: [link('a1')] },
    );
    await screen.findByRole('button', { name: /Embed/ });
    expect(screen.getByRole('button', { name: /Live image/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Password Protection' }));
    const field = screen.getByRole('textbox', { name: 'Share password' });
    fireEvent.change(field, { target: { value: '   ' } });
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(field, { target: { value: '  hunter2 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(calls).toContainEqual({ method: 'setSharePassword', args: ['hunter2'] }),
    );
    await screen.findByText('Password Saved');
    expect(document.querySelector('[data-share-password-tag]')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Live image/ })).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('with the password');
  });

  it("locks Password Protection with the host's reason, and shows the host's own section below it", async () => {
    renderDialog({
      passwordLockedReason: 'Remove the canvas from the Community first.',
      appSection: <section aria-label="Community">Published</section>,
    });
    const toggle = (await screen.findByRole('switch', {
      name: 'Password Protection',
    })) as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    expect(screen.getByText('Remove the canvas from the Community first.')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Community' }).textContent).toBe('Published');
  });

  it('still lets a password already set be removed while locked', async () => {
    const { calls } = renderDialog({ passwordLockedReason: 'Locked.' }, { passwordSet: true });
    await screen.findByText('Password Set');
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(calls).toContainEqual({ method: 'setSharePassword', args: [null] }));
  });

  it('tells the host whether a password is set, as read and as changed', async () => {
    const onPasswordSetChange = vi.fn();
    renderDialog({ onPasswordSetChange });
    fireEvent.click(await screen.findByRole('switch', { name: 'Password Protection' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Share password' }), {
      target: { value: 'hunter2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onPasswordSetChange).toHaveBeenLastCalledWith(true));
    expect(onPasswordSetChange).toHaveBeenCalledWith(false);
  });

  it('copies the embed and live image snippets from their menus', async () => {
    const { notify, onTelemetry } = renderDialog(
      {
        tabs: [
          { id: 't1', name: 'Board' },
          { id: 't2', name: 'Roadmap' },
        ],
        handOver: {
          embedUrl: (l) => `https://x.test/embed?s=${l.code}`,
          liveImageUrl: (l, tab) =>
            `https://x.test/api/share/${l.code}/image.svg${tab ? `?tab=${tab}` : ''}`,
          liveImageAlt: 'liveplanner tab',
        },
      },
      { links: [link('a1')] },
    );
    fireEvent.click(await screen.findByRole('button', { name: /Embed/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy iframe' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(embedSnippet('https://x.test/embed?s=a1')),
    );
    expect(notify).toHaveBeenCalledWith('Copied iframe', 'success');
    expect(onTelemetry).toHaveBeenCalledWith('Copied', 'EmbedCode');

    fireEvent.click(screen.getByRole('button', { name: /Live image/ }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Tab' }), { target: { value: 't2' } });
    expect(onTelemetry).toHaveBeenCalledWith('Selected', 'LiveImageTab');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Markdown' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        '![liveplanner tab](https://x.test/api/share/a1/image.svg?tab=t2)',
      ),
    );
  });

  it('reads the tabs from the host, so a new pass can open one', async () => {
    const { calls } = renderDialog({
      loadTabs: async () => [
        { id: 't1', name: 'Board' },
        { id: 't2', name: 'Roadmap' },
      ],
    });
    const scope = await screen.findByRole('combobox', { name: 'Tabs this link opens' });
    fireEvent.change(scope, { target: { value: 't2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Pass' }));
    await waitFor(() =>
      expect(calls[0]).toEqual({
        method: 'createShareLink',
        args: [{ level: 'edit', tabId: 't2', expiry: 'never' }],
      }),
    );
  });

  it('says a team’s item is open to the team', async () => {
    renderDialog({
      item: {
        id: 'p1',
        app: 'liveplanner',
        kind: 'plan',
        sharedVia: null,
        title: 'Roadmap',
        teamId: 'team1',
      },
    });
    expect((await screen.findByRole('status')).textContent).toContain(
      'Team: every member of the team can open this plan.',
    );
  });

  it('shows a guest’s “Sharing as” and saves a new name on Done', async () => {
    const onSave = vi.fn();
    const { props } = renderDialog({
      identity: { name: 'Quiet Otter', onSave, randomName: () => 'Bold Heron' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Pick a different name' }));
    expect((screen.getByRole('textbox', { name: 'Your name' }) as HTMLInputElement).value).toBe(
      'Bold Heron',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onSave).toHaveBeenCalledWith('Bold Heron');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('runs Show Me over the dialog, step by step, and Escape ends it without closing', async () => {
    const { props, onTelemetry } = renderDialog();
    fireEvent.click(await screen.findByRole('button', { name: 'Show Me' }));
    expect(onTelemetry).toHaveBeenCalledWith('Started', 'ShareTour');
    expect(screen.getByRole('dialog', { name: 'Choose What They Can Do' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog', { name: 'Set How Long It Lasts' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Set How Long It Lasts' })).toBeNull();
    expect(onTelemetry).toHaveBeenCalledWith('Ended', 'ShareTourSkipped');
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('ends Show Me with the sharing article, and completes', async () => {
    const { onTelemetry } = renderDialog({ helpHref: (a) => `https://help.test/${a}` });
    fireEvent.click(await screen.findByRole('button', { name: 'Show Me' }));
    for (let i = 0; i < 10 && !screen.queryByRole('dialog', { name: 'That Is Sharing' }); i++)
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const outro = screen.getByRole('dialog', { name: 'That Is Sharing' });
    expect(
      within(outro).getByRole('link', { name: 'Read about sharing' }).getAttribute('href'),
    ).toBe('https://help.test/sharing');
    fireEvent.click(within(outro).getByRole('button', { name: 'Done' }));
    expect(onTelemetry).toHaveBeenCalledWith('Ended', 'ShareTourCompleted');
  });

  it('says Public on the status line while the host says the item is public, over any pass', async () => {
    renderDialog(
      { publicNote: 'in the Community, where anyone can find it.' },
      { links: [link('a')] },
    );
    const status = await screen.findByText('Public: in the Community, where anyone can find it.');
    expect(status.closest('[data-share-status]')?.getAttribute('data-share-status')).toBe('public');
  });
});

describe('share helpers', () => {
  it('trims a password and treats spaces alone as none', () => {
    expect(passwordToSave('  a b  ')).toBe('a b');
    expect(passwordToSave('   ')).toBeNull();
  });
  it('builds the hand-over snippets, escaping the address', () => {
    expect(embedSnippet('https://x/e?s=a&b')).toContain('src="https://x/e?s=a&amp;b"');
    expect(liveImageMarkdown('https://x/i.svg', 'a [tab]')).toBe('![a tab](https://x/i.svg)');
    expect(liveImageHtml('https://x/i.svg', 'tab')).toBe('<img src="https://x/i.svg" alt="tab" />');
  });
  it('words the status line', () => {
    expect(shareStatusText({ passes: 3, password: false, team: false, word: 'plan' })).toBe(
      'Shared: anyone holding one of the 3 passes can get in.',
    );
    expect(shareStatusText({ passes: 1, password: true, team: true, word: 'plan' })).toBe(
      'Shared: every member of the team can open this plan, and anyone holding the pass can get in, with the password.',
    );
    expect(
      shareStatusText({
        passes: 2,
        password: false,
        team: true,
        word: 'canvas',
        publicNote: 'in the Community.',
      }),
    ).toBe('Public: in the Community.');
  });
});
