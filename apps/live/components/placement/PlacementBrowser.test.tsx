// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlacementBrowser, type PickerFolder } from './PlacementBrowser';
import type { PlacementLayout } from './PlacementCard';

// The browse the New Diagram wizard's folder step (spec/141) and the
// move-to-folder dialog (spec/15) share. These pin the parts a reader can't
// tell from the placement strings: the bar that is at every level, the
// subfolder badges, the Folder / Subfolder caption, and the cascade each
// level enters with.

// One personal tree: A (holds B and C, and C holds D), plus a root leaf E.
const FOLDERS: PickerFolder[] = [
  { id: 'a', name: 'Alpha', parentId: null },
  { id: 'b', name: 'Beta', parentId: 'a' },
  { id: 'c', name: 'Gamma', parentId: 'a' },
  { id: 'd', name: 'Delta', parentId: 'c' },
  { id: 'e', name: 'Epsilon', parentId: null },
];

const TEAM = { id: 't1', name: 'Team One' };

// The browser is controlled; a harness holds the placement like a host would.
function Harness({
  teams = [],
  teamFolders = {},
  layout,
  onCreateFolder,
  onCreateTeam,
}: {
  teams?: { id: string; name: string }[];
  teamFolders?: Record<string, PickerFolder[]>;
  layout?: PlacementLayout;
  onCreateFolder?: (
    name: string,
    parentId: string | null,
    teamId: string | null,
  ) => Promise<PickerFolder | null>;
  onCreateTeam?: (name: string) => Promise<{ id: string; name: string } | null>;
}) {
  const [placement, setPlacement] = useState('unsorted');
  return (
    <PlacementBrowser
      placement={placement}
      onPlacement={setPlacement}
      folders={FOLDERS}
      teams={teams}
      teamFolders={teamFolders}
      layout={layout}
      onCreateFolder={onCreateFolder}
      onCreateTeam={onCreateTeam}
    />
  );
}

const radio = (name: RegExp) => screen.getByRole('radio', { name });
// The browser opens on the space overview even with one space; most of
// these tests are about the levels inside Personal Space.
const enterPersonal = () => fireEvent.click(radio(/^Personal Space/));
const staggerIndex = (el: HTMLElement) => el.style.getPropertyValue('--stagger-i');

afterEach(cleanup);

describe('the bar above the rows', () => {
  it('opens on the space overview even when Personal Space is the only space', () => {
    render(<Harness />);
    // A heading, not a back button: there is no level above the overview.
    expect(screen.getByText('Choose a Space').closest('button')).toBeNull();
    expect(radio(/^Personal Space/).textContent).toContain('Your folders');
    // Nothing inside the space is listed until it is chosen.
    expect(screen.queryByRole('radio', { name: /^Alpha/ })).toBeNull();

    enterPersonal();
    const back = screen.getByRole('button', { name: /All spaces/ });
    expect(back.textContent).toContain('Personal Space');
    fireEvent.click(back);
    expect(screen.getByText('Choose a Space')).toBeTruthy();
  });

  it('opens straight inside the team on a team-scoped surface', () => {
    render(
      <PlacementBrowser
        placement="team:t1"
        onPlacement={() => {}}
        folders={[]}
        teams={[TEAM]}
        teamFolders={{ t1: [] }}
        showPersonal={false}
      />,
    );
    const heading = screen.getByText('Choose a Folder');
    expect(heading.closest('button')).toBeNull();
    expect(heading.parentElement?.textContent).toContain('Team One');
    expect(screen.queryByRole('button', { name: /all spaces/i })).toBeNull();
  });

  it('is "Choose a Space" on the overview, then a back button once inside a space', () => {
    render(<Harness teams={[TEAM]} />);
    expect(screen.getByText('Choose a Space').closest('button')).toBeNull();

    fireEvent.click(radio(/^Team One/));
    const back = screen.getByRole('button', { name: /All spaces/ });
    expect(back.textContent).toContain('Team One');

    fireEvent.click(back);
    expect(screen.getByText('Choose a Space')).toBeTruthy();
  });

  it('names the level above once inside a folder', () => {
    render(<Harness />);
    enterPersonal();
    fireEvent.click(radio(/^Alpha/));
    const back = screen.getByRole('button', { name: /Personal Space/ });
    expect(back.textContent).toContain('Alpha');
    fireEvent.click(radio(/^Gamma/));
    expect(screen.getByRole('button', { name: /Alpha/ }).textContent).toContain('Gamma');
  });
});

describe('subfolder badges', () => {
  it('count direct subfolders, pluralised, and stay off empty folders', () => {
    render(<Harness />);
    enterPersonal();
    // The save-here card at the root: two root folders.
    expect(radio(/^Personal Space/).textContent).toContain('2 Subfolders');
    expect(radio(/^Alpha/).textContent).toContain('2 Subfolders');
    expect(radio(/^Epsilon/).textContent).not.toMatch(/\d+ Subfolder/);

    fireEvent.click(radio(/^Alpha/));
    expect(radio(/^Alpha/).textContent).toContain('2 Subfolders');
    expect(radio(/^Gamma/).textContent).toContain('1 Subfolder');
    expect(radio(/^Gamma/).textContent).not.toContain('Subfolders');
    expect(radio(/^Beta/).textContent).not.toMatch(/\d+ Subfolder/);
  });

  it('count a space’s root folders on the overview', () => {
    render(
      <Harness teams={[TEAM]} teamFolders={{ t1: [{ id: 'x', name: 'Ex', parentId: null }] }} />,
    );
    expect(radio(/^Personal Space/).textContent).toContain('2 Subfolders');
    expect(radio(/^Team One/).textContent).toContain('1 Subfolder');
  });
});

describe('the caption', () => {
  it('says Folder at a space’s root and Subfolder inside a folder', () => {
    render(<Harness />);
    enterPersonal();
    expect(radio(/^Epsilon/).textContent).toContain('Folder');
    expect(radio(/^Epsilon/).textContent).not.toContain('Subfolder');
    fireEvent.click(radio(/^Alpha/));
    expect(radio(/^Beta/).textContent).toContain('Subfolder');
  });
});

describe('the cascade', () => {
  it('numbers every row of a level in order, the New Folder row last', () => {
    render(<Harness layout="list" onCreateFolder={async () => null} />);
    enterPersonal();
    const rows = screen.getAllByRole('radio');
    expect(rows.map(staggerIndex)).toEqual(['0', '1', '2']);
    for (const row of rows) {
      expect(row.className).toContain('stagger-enter');
      expect(row.className).toContain('animate-slide-row-in');
    }
    const newFolder = screen.getByRole('button', { name: /New Folder/ });
    expect(staggerIndex(newFolder)).toBe('3');
    expect(newFolder.className).toContain('stagger-enter');
  });

  it('starts again from zero on the next level', () => {
    render(<Harness layout="list" />);
    enterPersonal();
    fireEvent.click(radio(/^Alpha/));
    expect(screen.getAllByRole('radio').map(staggerIndex)).toEqual(['0', '1', '2']);
  });

  it('fades tiles rather than sliding them, since a grid track holds their place', () => {
    render(<Harness layout="tiles" />);
    enterPersonal();
    for (const tile of screen.getAllByRole('radio')) {
      expect(tile.className).toContain('animate-fade-in');
      expect(tile.className).not.toContain('animate-slide-row-in');
    }
  });
});

describe('the New Folder tile', () => {
  it('creates under the selected folder, and at the root when the root is selected', async () => {
    const onCreateFolder = vi.fn(async (name: string, parentId: string | null) => ({
      id: `new-${parentId ?? 'root'}`,
      name,
      parentId,
    }));
    render(<Harness layout="list" onCreateFolder={onCreateFolder} />);
    enterPersonal();
    // Root selected: a plain new folder.
    expect(screen.getByRole('button', { name: /New Folder/ }).textContent).toContain('Create here');

    // Select a leaf folder: the tile becomes a subfolder of it.
    fireEvent.click(radio(/^Epsilon/));
    const tile = screen.getByRole('button', { name: /New Subfolder/ });
    expect(tile.textContent).toContain('In Epsilon');
    fireEvent.click(tile);
    fireEvent.change(screen.getByPlaceholderText('Folder name'), { target: { value: 'Zeta' } });
    fireEvent.keyDown(screen.getByPlaceholderText('Folder name'), { key: 'Enter' });
    await screen.findByRole('button', { name: /New Subfolder|New Folder/ });
    expect(onCreateFolder).toHaveBeenCalledWith('Zeta', 'e', null);
  });

  it('goes back to New Folder when the space root is selected again', () => {
    render(<Harness layout="list" onCreateFolder={async () => null} />);
    enterPersonal();
    fireEvent.click(radio(/^Epsilon/));
    expect(screen.getByRole('button', { name: /New Subfolder/ })).toBeTruthy();
    fireEvent.click(radio(/^Personal Space/));
    expect(screen.getByRole('button', { name: /New Folder/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /New Subfolder/ })).toBeNull();
  });
});

describe('the New Team tile', () => {
  it('is absent unless the host can create teams (guests cannot)', () => {
    render(<Harness layout="list" />);
    expect(screen.queryByRole('button', { name: /New Team/ })).toBeNull();
  });

  it('creates the team and enters it with its root selected', async () => {
    // The host owns the team list, as the wizard's hook does: creating
    // appends to it, and the browser reads the new card on re-render.
    function Host() {
      const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
      return (
        <Harness
          layout="list"
          teams={teams}
          onCreateTeam={async (name) => {
            const team = { id: 't-new', name };
            setTeams((list) => [...list, team]);
            return team;
          }}
        />
      );
    }
    render(<Host />);
    const tile = screen.getByRole('button', { name: /New Team/ });
    expect(tile.textContent).toContain('Create a team');
    fireEvent.click(tile);
    fireEvent.change(screen.getByPlaceholderText('Team name'), { target: { value: 'Design' } });
    fireEvent.keyDown(screen.getByPlaceholderText('Team name'), { key: 'Enter' });
    // Inside the new team: its "here" card is the level's first row and selected.
    const here = await screen.findByRole('radio', { name: /^Team Library/ });
    expect(here.textContent).toContain('Design');
    expect(here.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('button', { name: /All spaces/ }).textContent).toContain('Design');
  });
});
