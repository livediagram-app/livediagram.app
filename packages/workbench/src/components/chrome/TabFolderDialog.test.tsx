// @vitest-environment jsdom
// Organise in Tab Folder (docs/specs/006-document/tab-folders.md "Membership UX"): full-width rows (No Folder, each
// folder with its colour, count and Current, New Folder), a row moves the tab and closes, the colour button sets the
// folder's colour without moving the tab, and the New Folder editor makes a folder with or without a colour.

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TabFolderSummary } from '@liveworkspace/element-model/tab-folders';
import { AddTabToFolderDialog } from './TabFolderDialog';
import { folderColourWords } from './FolderColourButton';
import { folderHue } from './folder-colour';
import { tabCount } from './TabFolderList';

const FOLDERS: TabFolderSummary[] = [
  { name: 'Platform Services and Infrastructure Planning', count: 3, colour: 'emerald' },
  { name: 'Plans', count: 1, colour: null },
];

function setup(over: { currentFolder?: string | null; folders?: TabFolderSummary[] } = {}) {
  const calls = {
    onMoveToFolder: vi.fn(),
    onRemoveFromFolder: vi.fn(),
    onSetFolderColour: vi.fn(),
    onClose: vi.fn(),
  };
  render(
    <AddTabToFolderDialog
      folders={over.folders ?? FOLDERS}
      currentFolder={over.currentFolder === undefined ? 'Plans' : over.currentFolder}
      {...calls}
    />,
  );
  return calls;
}

const row = (name: RegExp | string) => screen.getByRole('button', { name });
const escape = (target: Element = document.body) =>
  fireEvent.keyDown(target, { key: 'Escape', bubbles: true });
const frames = (): void => {
  void act(() => {
    vi.advanceTimersByTime(50);
  });
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the list', () => {
  it('counts tabs in words', () => {
    expect(tabCount(1)).toBe('1 tab');
    expect(tabCount(3)).toBe('3 tabs');
  });

  it('lists No Folder, every folder in full with its count, and New Folder, the current one marked', () => {
    setup();
    const items = within(screen.getByRole('list', { name: 'Tab folders' })).getAllByRole(
      'listitem',
    );
    expect(items.map((li) => li.getAttribute('data-tab-folder-row'))).toEqual([
      'none',
      'Platform Services and Infrastructure Planning',
      'Plans',
      'new',
    ]);
    // The long name in full, never cut.
    expect(screen.getByText('Platform Services and Infrastructure Planning').className).not.toMatch(
      /truncate/,
    );
    expect(row('Platform Services and Infrastructure Planning, 3 tabs')).toBeTruthy();
    const plans = row('Plans, 1 tab, current folder');
    expect(plans.getAttribute('aria-current')).toBe('true');
    expect(within(plans).getByText('Current')).toBeTruthy();
    expect(row('No Folder, loose on the bar').getAttribute('aria-current')).toBeNull();
  });

  it("tints each folder's tile in its colour: the chosen one, else its name's", () => {
    setup();
    const tile = (name: string) =>
      document.querySelector(`[data-tab-folder-row="${name}"] [style]`) as HTMLElement;
    expect(
      tile('Platform Services and Infrastructure Planning').style.getPropertyValue('--tf'),
    ).toBe('#059669');
    expect(tile('Plans').style.getPropertyValue('--tf')).toBe(folderHue('Plans').light);
  });

  it('moves the tab into a folder and closes; the current one just closes', () => {
    const calls = setup();
    fireEvent.click(row(/^Platform Services/));
    expect(calls.onMoveToFolder).toHaveBeenCalledWith(
      'Platform Services and Infrastructure Planning',
    );
    expect(calls.onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(row(/^Plans, 1 tab/));
    expect(calls.onMoveToFolder).toHaveBeenCalledTimes(1);
    expect(calls.onClose).toHaveBeenCalledTimes(2);
  });

  it('makes the tab loose from No Folder, and does nothing more when it already is', () => {
    const calls = setup();
    fireEvent.click(row('No Folder, loose on the bar'));
    expect(calls.onRemoveFromFolder).toHaveBeenCalledOnce();
    cleanup();
    const loose = setup({ currentFolder: null });
    fireEvent.click(row('No Folder, loose on the bar, current'));
    expect(loose.onRemoveFromFolder).not.toHaveBeenCalled();
    expect(loose.onClose).toHaveBeenCalledOnce();
  });

  it('closes on Escape', () => {
    const calls = setup();
    escape();
    expect(calls.onClose).toHaveBeenCalledOnce();
  });
});

describe('the colour button', () => {
  const colourButton = (name: string) =>
    screen.getByRole('button', { name: new RegExp(`^Folder Colour for ${name}`) });

  it('says the colour in force, Automatic with the hue it picks', () => {
    setup();
    expect(colourButton('Platform Services').getAttribute('aria-label')).toBe(
      'Folder Colour for Platform Services and Infrastructure Planning: Emerald',
    );
    expect(colourButton('Plans').getAttribute('aria-label')).toBe(
      `Folder Colour for Plans: Automatic, ${folderHue('Plans').label}`,
    );
    expect(folderColourWords('x', 'rose')).toBe('Rose');
  });

  it('opens the picker, the colour in force checked, and picking sets it without moving the tab', () => {
    const calls = setup();
    fireEvent.click(colourButton('Plans'));
    frames();
    const group = screen.getByRole('radiogroup', { name: 'Folder Colour for Plans' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual([
      `Automatic, ${folderHue('Plans').label}`,
      'Blue',
      'Violet',
      'Emerald',
      'Amber',
      'Rose',
      'Cyan',
      'Orange',
      'Pink',
    ]);
    expect(radios[0]!.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(radios[0]);
    fireEvent.click(within(group).getByRole('radio', { name: 'Rose' }));
    expect(calls.onSetFolderColour).toHaveBeenCalledWith('Plans', 'rose');
    expect(calls.onMoveToFolder).not.toHaveBeenCalled();
    expect(calls.onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(document.activeElement).toBe(colourButton('Plans'));
  });

  it('goes back to Automatic, and picking the colour already in force writes nothing', () => {
    const calls = setup();
    fireEvent.click(colourButton('Platform Services'));
    frames();
    fireEvent.click(screen.getByRole('radio', { name: 'Emerald' }));
    expect(calls.onSetFolderColour).not.toHaveBeenCalled();
    fireEvent.click(colourButton('Platform Services'));
    frames();
    fireEvent.click(screen.getByRole('radio', { name: /^Automatic/ }));
    expect(calls.onSetFolderColour).toHaveBeenCalledWith(
      'Platform Services and Infrastructure Planning',
      null,
    );
  });

  it('moves through the swatches with the arrows, wrapping, without picking', () => {
    const calls = setup();
    fireEvent.click(colourButton('Platform Services'));
    frames();
    const emerald = screen.getByRole('radio', { name: 'Emerald' });
    expect(document.activeElement).toBe(emerald);
    fireEvent.keyDown(emerald, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Amber' }));
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: /^Automatic/ }));
    expect(calls.onSetFolderColour).not.toHaveBeenCalled();
  });

  it('closes the picker on Escape first, the dialog staying open; a second Escape closes the dialog', () => {
    const calls = setup();
    fireEvent.click(colourButton('Plans'));
    frames();
    escape(document.activeElement!);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(calls.onClose).not.toHaveBeenCalled();
    escape();
    expect(calls.onClose).toHaveBeenCalledOnce();
  });

  it('toggles the picker shut from its own button', () => {
    setup();
    fireEvent.click(colourButton('Plans'));
    expect(colourButton('Plans').getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(colourButton('Plans'));
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
});

describe('New Folder', () => {
  const open = () => fireEvent.click(row(/^New Folder/));
  const field = () => screen.getByRole('textbox', { name: 'Folder name' });

  it('adds a folder on Enter, on Automatic, and moves the tab in', () => {
    const calls = setup();
    open();
    expect(document.activeElement).toBe(field());
    const add = screen.getByRole<HTMLButtonElement>('button', { name: 'Add' });
    expect(add.disabled).toBe(true);
    fireEvent.change(field(), { target: { value: '  Research  ' } });
    // The colour button previews the name's own colour, live.
    expect(
      screen
        .getByRole('button', { name: /^Folder Colour for Research/ })
        .getAttribute('aria-label'),
    ).toBe(`Folder Colour for Research: Automatic, ${folderHue('Research').label}`);
    fireEvent.submit(field().closest('form')!);
    expect(calls.onMoveToFolder).toHaveBeenCalledWith('Research', null);
    expect(calls.onClose).toHaveBeenCalledOnce();
  });

  it('stores a colour chosen while naming it', () => {
    const calls = setup();
    open();
    fireEvent.change(field(), { target: { value: 'Research' } });
    fireEvent.click(screen.getByRole('button', { name: /^Folder Colour for Research/ }));
    frames();
    fireEvent.click(screen.getByRole('radio', { name: 'Cyan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(calls.onMoveToFolder).toHaveBeenCalledWith('Research', 'cyan');
  });

  it("says an existing name moves into that folder, in that folder's colour", () => {
    const calls = setup();
    open();
    fireEvent.change(field(), {
      target: { value: 'Platform Services and Infrastructure Planning' },
    });
    expect(screen.getByText('Moves into the existing folder')).toBeTruthy();
    expect(field().getAttribute('aria-describedby')).toBeTruthy();
    const newRow = document.querySelector('[data-tab-folder-row="new"]') as HTMLElement;
    const colour = within(newRow).getByRole('button', { name: /^Folder Colour for Platform/ });
    expect((colour as HTMLButtonElement).disabled).toBe(true);
    expect(colour.getAttribute('aria-label')).toMatch(
      /Emerald\. Change it from the folder's own row$/,
    );
    fireEvent.submit(field().closest('form')!);
    expect(calls.onMoveToFolder).toHaveBeenCalledWith(
      'Platform Services and Infrastructure Planning',
      null,
    );
  });

  it('closes a picker opened for a new name once the name turns out to exist', () => {
    setup();
    open();
    fireEvent.change(field(), { target: { value: 'Plan' } });
    fireEvent.click(screen.getByRole('button', { name: /^Folder Colour for Plan:/ }));
    expect(screen.getByRole('radiogroup')).toBeTruthy();
    fireEvent.change(field(), { target: { value: 'Plans' } });
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('names the picker for a folder not named yet', () => {
    setup();
    open();
    fireEvent.click(screen.getByRole('button', { name: /^Folder Colour for New Folder/ }));
    expect(screen.getByRole('radiogroup', { name: 'Folder Colour for New Folder' })).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Folder Colour for New Folder' })).toBeTruthy();
  });

  it('adds nothing for a blank name', () => {
    const calls = setup();
    open();
    fireEvent.change(field(), { target: { value: '   ' } });
    fireEvent.submit(field().closest('form')!);
    expect(calls.onMoveToFolder).not.toHaveBeenCalled();
  });

  it('puts the dashed row back on Escape, the dialog staying open, and ignores other keys', () => {
    const calls = setup();
    open();
    fireEvent.keyDown(field(), { key: 'a' });
    fireEvent.change(field(), { target: { value: 'Draft' } });
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(calls.onClose).not.toHaveBeenCalled();
    frames();
    expect(document.activeElement).toBe(row(/^New Folder/));
    // Opened again, it starts empty.
    open();
    expect((field() as HTMLInputElement).value).toBe('');
    escape(field());
    escape();
    expect(calls.onClose).toHaveBeenCalledOnce();
  });
});
