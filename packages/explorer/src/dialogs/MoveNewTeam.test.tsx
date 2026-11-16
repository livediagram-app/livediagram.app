// New Team in the Move dialog (livediagram's, 19e2d87ca): a team made on the spot, opened with its root chosen, and
// the item filed into it on Move Here.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MoveToFolderDialog } from './MoveToFolderDialog';

function open(onCreateTeam?: (name: string) => Promise<{ id: string; name: string } | null>) {
  const onPick = vi.fn();
  render(
    <MoveToFolderDialog
      subjectName="Roadmap"
      subjectKind="item"
      personalFolders={[]}
      teams={[]}
      onPick={onPick}
      onClose={vi.fn()}
      {...(onCreateTeam ? { onCreateTeam } : {})}
    />,
  );
  return onPick;
}

describe('New Team in the Move dialog', () => {
  it('makes a team, opens it, and files the item there', async () => {
    const onCreateTeam = vi.fn(async (name: string) => ({ id: 't9', name }));
    const onPick = open(onCreateTeam);
    // With no teams yet, the spaces still show, so New Team is there to make one.
    fireEvent.click(screen.getByRole('button', { name: /^Choose a Space/ }));
    fireEvent.click(screen.getByRole('button', { name: /New Team/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New team name' }), {
      target: { value: '  Design  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(onCreateTeam).toHaveBeenCalledWith('Design'));
    expect(await screen.findByRole('button', { name: /Team Library/, pressed: true })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Move Here' }));
    expect(onPick).toHaveBeenCalledWith({ teamId: 't9', folderId: null });
  });

  it('says so when the team could not be made, and keeps the name', async () => {
    open(async () => null);
    fireEvent.click(screen.getByRole('button', { name: /^Choose a Space/ }));
    fireEvent.click(screen.getByRole('button', { name: /New Team/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New team name' }), {
      target: { value: 'Design' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not be made/);
    expect((screen.getByRole('textbox', { name: 'New team name' }) as HTMLInputElement).value).toBe(
      'Design',
    );
  });

  it('is not offered without a host that makes teams', () => {
    open();
    expect(screen.queryByRole('button', { name: /^Choose a Space/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /New Team/ })).toBeNull();
  });
});

describe('the heading with one space to offer', () => {
  it('names the space, never "Choose a Space" with none to choose', () => {
    open();
    expect(screen.queryByText('Choose a Space')).toBeNull();
    // The static heading, no chip repeating it.
    const heading = screen.getAllByText('My Work')[0]!.parentElement!;
    expect(heading.tagName).toBe('DIV');
    expect(heading.textContent).toBe('My Work');
    // Said once: the top level's card under it doesn't name the space again.
    expect(screen.getAllByText('My Work')).toHaveLength(1);
    expect(screen.getByText('Top level')).toBeTruthy();
    expect(screen.getByText('Not in a folder')).toBeTruthy();
  });

  it('names the team for a team folder moving within its team', () => {
    render(
      <MoveToFolderDialog
        subjectName="Specs"
        subjectKind="folder"
        teams={[{ id: 't1', name: 'Design', folders: [] }]}
        currentTeamId="t1"
        subtitle="Folders move within their space. Pick where in Design it should live."
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText('Choose a Space')).toBeNull();
    expect(
      screen.getByText('Folders move within their space. Pick where in Design it should live.'),
    ).toBeTruthy();
    expect(screen.getAllByText('Design').length).toBeGreaterThan(0);
  });
});
