// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlacementBrowser, type PickerFolder, type PlacementLayout } from './PlacementBrowser';

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
}: {
  teams?: { id: string; name: string }[];
  teamFolders?: Record<string, PickerFolder[]>;
  layout?: PlacementLayout;
  onCreateFolder?: (name: string) => Promise<PickerFolder | null>;
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
    />
  );
}

const radio = (name: RegExp) => screen.getByRole('radio', { name });
const staggerIndex = (el: HTMLElement) => el.style.getPropertyValue('--stagger-i');

afterEach(cleanup);

describe('the bar above the rows', () => {
  it('is a heading, not a button, at the root of a single space', () => {
    render(<Harness />);
    const heading = screen.getByText('Choose a Folder');
    expect(heading.closest('button')).toBeNull();
    // The chip still says where you are.
    expect(heading.parentElement?.textContent).toContain('My Work');
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
    fireEvent.click(radio(/^Alpha/));
    const back = screen.getByRole('button', { name: /My Work/ });
    expect(back.textContent).toContain('Alpha');
    fireEvent.click(radio(/^Gamma/));
    expect(screen.getByRole('button', { name: /Alpha/ }).textContent).toContain('Gamma');
  });
});

describe('subfolder badges', () => {
  it('count direct subfolders, pluralised, and stay off empty folders', () => {
    render(<Harness />);
    // The save-here card at the root: two root folders.
    expect(radio(/^My Work/).textContent).toContain('2 Subfolders');
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
    expect(radio(/^My Work/).textContent).toContain('2 Subfolders');
    expect(radio(/^Team One/).textContent).toContain('1 Subfolder');
  });
});

describe('the caption', () => {
  it('says Folder at a space’s root and Subfolder inside a folder', () => {
    render(<Harness />);
    expect(radio(/^Epsilon/).textContent).toContain('Folder');
    expect(radio(/^Epsilon/).textContent).not.toContain('Subfolder');
    fireEvent.click(radio(/^Alpha/));
    expect(radio(/^Beta/).textContent).toContain('Subfolder');
  });
});

describe('the cascade', () => {
  it('numbers every row of a level in order, the New Folder row last', () => {
    render(<Harness layout="list" onCreateFolder={async () => null} />);
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
    fireEvent.click(radio(/^Alpha/));
    expect(screen.getAllByRole('radio').map(staggerIndex)).toEqual(['0', '1', '2']);
  });

  it('fades tiles rather than sliding them, since a grid track holds their place', () => {
    render(<Harness layout="tiles" />);
    for (const tile of screen.getAllByRole('radio')) {
      expect(tile.className).toContain('animate-fade-in');
      expect(tile.className).not.toContain('animate-slide-row-in');
    }
  });
});
