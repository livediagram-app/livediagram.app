// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { preloadUpgradeDialog } from './provider/SubscriptionProvider';
import { useOwnerView } from './provider/hooks';
import { ProNote } from './ProNote';
import {
  GARDEN,
  ME,
  meResponse,
  ownerView,
  serviceFetch,
  setProForTests,
  withProvider,
} from './test/fixture';

// The quiet line under a list a tier trims: the offer is the owner's (or a team admin's); a team's member is pointed
// at an admin; anyone else reads the sentence and nothing more.

const WORDS = 'Free keeps 7 days of history. Pro keeps it forever.';

beforeAll(async () => {
  await preloadUpgradeDialog();
}, 60_000);

describe('ProNote', () => {
  it('goes once the owner is past Free: the words are the last read, the tier is live', () => {
    const { container, rerender } = render(
      <ProNote owner={ownerView(ME, 'upgrade')}>{WORDS}</ProNote>,
    );
    expect(screen.getByRole('note')).toBeTruthy();
    rerender(<ProNote owner={ownerView(ME, 'manage', 'pro')}>{WORDS}</ProNote>);
    expect(container.innerHTML).toBe('');
    rerender(<ProNote owner={ownerView(GARDEN, 'ask_admin', 'team')}>{WORDS}</ProNote>);
    expect(container.innerHTML).toBe('');
  });

  it('the owner: the sentence and See Pro, wearing the Pro mark', () => {
    render(<ProNote owner={ownerView(ME, 'upgrade')}>{WORDS}</ProNote>);
    const note = screen.getByRole('note');
    expect(note.textContent).toContain(WORDS);
    expect(note.getAttribute('data-pro-note')).toBe('upgrade');
    expect(note.getAttribute('data-pro-note-layout')).toBe('foot');
    // The Pro mark rides in the button, with no badge beside it.
    const button = screen.getByRole('button', { name: 'See Pro' });
    expect(button.querySelector('[data-pro-note-mark]')).not.toBeNull();
    expect(note.querySelector('[data-pro-badge]')).toBeNull();
  });

  it('a team member: Ask an Admin, wearing the mark', () => {
    render(<ProNote owner={ownerView(GARDEN, 'ask_admin')}>{WORDS}</ProNote>);
    const button = screen.getByRole('button', { name: 'Ask an Admin' });
    expect(button.querySelector('[data-pro-note-mark]')).not.toBeNull();
    expect(screen.getByRole('note').querySelector('[data-pro-badge]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'See Pro' })).toBeNull();
  });

  it('a collaborator, and while the owner is not known: the sentence alone', () => {
    const { rerender } = render(<ProNote owner={ownerView(ME, 'none')}>{WORDS}</ProNote>);
    expect(screen.getByRole('note').textContent).toContain(WORDS);
    expect(screen.queryByRole('button')).toBeNull();
    // No button to carry the mark: the outline badge leads.
    expect(screen.getByRole('note').querySelector('[data-pro-badge="outline"]')).not.toBeNull();
    rerender(<ProNote owner={null}>{WORDS}</ProNote>);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<ProNote owner={{ status: 'loading' }}>{WORDS}</ProNote>);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('with words for others: anyone who cannot act reads them, with no badge and no tier', () => {
    const OTHERS = 'History here is kept for 7 days.';
    const { rerender, container } = render(
      <ProNote owner={ownerView(ME, 'none')} others={OTHERS}>
        {WORDS}
      </ProNote>,
    );
    expect(screen.getByRole('note').textContent).toBe(OTHERS);
    expect(container.querySelector('[data-pro-badge]')).toBeNull();
    rerender(
      <ProNote owner={{ status: 'loading' }} others={OTHERS}>
        {WORDS}
      </ProNote>,
    );
    expect(screen.getByRole('note').textContent).toBe(OTHERS);
    rerender(
      <ProNote owner={ownerView(ME, 'upgrade')} others={OTHERS}>
        {WORDS}
      </ProNote>,
    );
    expect(screen.getByRole('note').textContent).toContain(WORDS);
    expect(screen.getByRole('button', { name: 'See Pro' })).toBeTruthy();
    rerender(
      <ProNote owner={ownerView(GARDEN, 'ask_admin')} others={OTHERS}>
        {WORDS}
      </ProNote>,
    );
    expect(screen.getByRole('note').textContent).toContain(WORDS);
  });

  it('is nothing with Pro off', () => {
    setProForTests(false);
    const { container } = render(<ProNote owner={ownerView(ME, 'upgrade')}>{WORDS}</ProNote>);
    expect(container.innerHTML).toBe('');
    setProForTests(true);
  });

  it('See Pro opens the provider’s one dialog on the limit it is about', async () => {
    function Note() {
      return (
        <ProNote owner={useOwnerView(ME)} limitKey="historyDays">
          {WORDS}
        </ProNote>
      );
    }
    const { fetcher } = serviceFetch({
      me: meResponse(),
      owners: { [ME]: ownerView(ME, 'upgrade') },
    });
    render(withProvider(<Note />, fetcher));
    fireEvent.click(await screen.findByRole('button', { name: 'See Pro' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
});
