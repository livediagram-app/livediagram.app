// @vitest-environment jsdom
// docs/specs/021-event-storming/note-reader.md "What the editor shows": before a charged photo read, the choice of
// the AI, at the credits it costs (one for every 24 notes), or this device, for nothing; what is left for whoever may
// know it; the AI disabled when too few are left; and the kit's used notice, with its offer, when none are.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Usage } from '@liveworkspace/subscription';
import {
  noteReadCredits,
  resetReadCreditsForTests,
  setReadOwner,
  setReadTarget,
} from '@/lib/reading/read-credits';
import { ownerOf, proOnForTests, proService, withPro, type Who } from '@/test/pro';
import { ReadChoice } from './ReadChoice';

proOnForTests();
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 10, 20, 12) });
});
afterEach(() => {
  cleanup();
  act(() => resetReadCreditsForTests());
  vi.useRealTimers();
});

// The diagram `who` reads into, owned as the api would name its payer.
function choice(who: Who, notes: number, usage: Usage = {}) {
  const scope = ownerOf(who);
  setReadTarget({ documentId: 'doc1', shareCode: null });
  setReadOwner(
    'doc1',
    scope.startsWith('t:') ? { team: scope.slice(2) } : { owner: scope.slice(2) },
  );
  const onChoose = vi.fn();
  const service = proService(who, usage);
  render(withPro(<ReadChoice notes={notes} onChoose={onChoose} />, service.fetcher, who));
  return onChoose;
}
const ai = () => screen.getByTestId<HTMLButtonElement>('photo-read-ai');
const words = () => screen.getByTestId('photo-read-choice-words').textContent;

describe('what the AI costs', () => {
  it.each([
    [10, 'Read 10 Notes with AI· Uses 1 AI credit'],
    [24, 'Read 24 Notes with AI· Uses 1 AI credit'],
    [30, 'Read 30 Notes with AI· Uses 2 AI credits'],
    [400, 'Read 400 Notes with AI· Uses 17 AI credits'],
  ])('says it on the AI choice for %i notes', (notes, label) => {
    choice('collaborator', notes);
    expect(ai().textContent).toBe(label);
    expect(ai().disabled).toBe(false);
  });

  it('tells the owner what is left, and reads with the AI when chosen', async () => {
    const onChoose = choice('owner', 30, { aiCredits: { used: 12 } });
    await vi.waitFor(() => expect(words()).toContain('38 of 50 left this month'));
    expect(words()).toContain('On this device: free, nothing is sent, fewer words read right.');
    fireEvent.click(ai());
    expect(onChoose).toHaveBeenCalledWith(false);
  });

  it('never tells a collaborator what the owner has left', async () => {
    choice('collaborator', 30, { aiCredits: { used: 12 } });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(words()).toBe('On this device: free, nothing is sent, fewer words read right.');
  });

  it('says what is left from the last read of this diagram when the kit cannot', () => {
    setReadTarget({ documentId: 'doc1', shareCode: null });
    noteReadCredits({ owner: 'p:user_bob', used: 40, max: 50 });
    choice('collaborator', 30);
    expect(words()).toContain('10 of 50 left this month');
  });
});

describe('this device', () => {
  it('reads for nothing when chosen', () => {
    const onChoose = choice('owner', 30);
    fireEvent.click(screen.getByRole('button', { name: 'Read on This Device' }));
    expect(onChoose).toHaveBeenCalledWith(true);
  });
});

describe('too few credits left', () => {
  it('disables the AI and says why, leaving this device', async () => {
    const onChoose = choice('owner', 30, { aiCredits: { used: 49 } });
    await vi.waitFor(() => expect(ai().disabled).toBe(true));
    expect(screen.getByTestId('photo-read-choice').getAttribute('data-read-choice')).toBe('short');
    expect(words()).toContain('Uses 2 AI credits, and 1 is left this month.');
    fireEvent.click(ai());
    expect(onChoose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Read on This Device' }));
    expect(onChoose).toHaveBeenCalledWith(true);
  });

  it('shows the used notice with the owner’s offer when none are left', async () => {
    const onChoose = choice('owner', 10, { aiCredits: { used: 50 } });
    expect(await screen.findByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy();
    const panel = screen.getByTestId('photo-read-choice');
    expect(panel.getAttribute('data-read-choice')).toBe('used');
    expect(panel.textContent).toContain('This month’s AI credits are used.');
    expect(screen.queryByTestId('photo-read-ai')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Read on This Device' }));
    expect(onChoose).toHaveBeenCalledWith(true);
  });

  it('points a team’s member at an admin', async () => {
    choice('member', 10, { aiCredits: { used: 50 } });
    expect(await screen.findByRole('button', { name: 'Ask an Admin' })).toBeTruthy();
  });

  it('says it plainly, with this device, before the kit has answered', () => {
    setReadTarget({ documentId: 'doc1', shareCode: null });
    noteReadCredits({ owner: 'p:user_bob', used: 50, max: 50 });
    choice('collaborator', 10);
    const panel = screen.getByTestId('photo-read-choice');
    expect(panel.textContent).toContain('Uses 1 AI credit, and 0 are left this month.');
    expect(screen.getByRole('button', { name: 'Read on This Device' })).toBeTruthy();
  });
});
