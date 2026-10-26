// Team Activity on a team's view (livediagram/docs/specs/013-workspace/timeline.md "Team Activity"): closed under
// the team's card and library, read only once opened, the team's own events from every app, with no New marks.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IndexError } from '@liveworkspace/index-client';
import { createFakeIndex, makeEvent } from '../test/fakeClient';
import { Explorer } from './Explorer';

function renderTeam(index: ReturnType<typeof createFakeIndex>, id = 'T1') {
  return render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'team', id }}
      onNavigate={vi.fn()}
      itemHref={(item) => `/project/${item.id}`}
      onCreate={vi.fn()}
      viewerId="user_me"
      teams={[
        { id: 'T1', name: 'Acme' },
        { id: 'T2', name: 'Beta' },
      ]}
    />,
  );
}

const teamReads = (index: ReturnType<typeof createFakeIndex>) =>
  index.calls.filter((c) => c.method === 'timeline').map((c) => c.args[0]);
const toggle = () => screen.getByRole('button', { name: /Team Activity/ });
const cards = () => document.querySelectorAll('[data-timeline-event]');

describe('Team Activity', () => {
  it('is closed until opened, then reads the team’s events from every app', async () => {
    const index = createFakeIndex({
      events: [
        makeEvent(1, { actorId: 'user_ann' }, { teamId: 'T1', title: 'Acme roadmap' }),
        makeEvent(
          2,
          { app: 'livediagram', type: 'moved' },
          { app: 'livediagram', kind: 'canvas', teamId: 'T1', title: 'Acme flow' },
        ),
        makeEvent(3, {}, { teamId: 'T2', title: 'Beta plan' }),
      ],
    });
    renderTeam(index);
    expect(
      (await screen.findByRole('button', { name: /Team Activity/ })).getAttribute('aria-expanded'),
    ).toBe('false');
    expect(teamReads(index)).toEqual([]);
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    await waitFor(() => expect(cards().length).toBe(2));
    expect(teamReads(index)).toEqual([{ team: 'T1', limit: 30 }]);
    expect(screen.queryByText(/Beta plan/)).toBeNull();
    // A shared feed has no one last look: the reader's Timeline is not marked seen.
    expect(index.calls.some((c) => c.method === 'markTimelineSeen')).toBe(false);
    fireEvent.click(toggle());
    expect(cards().length).toBe(0);
  });

  it('says so when the team has done nothing', async () => {
    renderTeam(createFakeIndex());
    fireEvent.click(await screen.findByRole('button', { name: /Team Activity/ }));
    expect(await screen.findByText('No Team Activity Yet')).toBeTruthy();
  });

  it('offers a retry when the read fails', async () => {
    const index = createFakeIndex({ events: [makeEvent(1, {}, { teamId: 'T1' })] });
    index.fail.set('timeline', new IndexError(403, 'not_team_member'));
    renderTeam(index);
    fireEvent.click(await screen.findByRole('button', { name: /Team Activity/ }));
    expect(await screen.findByText('Couldn’t load this team’s activity')).toBeTruthy();
    index.fail.delete('timeline');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(cards().length).toBe(1));
  });
});
