// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import type { Participant } from '@/lib/identity';
import type { SkipLocationStep } from '@/lib/skip-location-step';
import { TemplatePicker } from './TemplatePicker';

// docs/specs/013-workspace/default-folders.md "Skipping the Location step": the Location step's
// checkbox turns it on, and while it is on the welcome wizard is one step that creates in the
// saved place, with a "Saving in" line whose Change opens the Location step for this document.

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
Element.prototype.scrollTo ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
afterEach(cleanup);

const participant: Participant = { id: 'p1', name: 'Ada', color: '#0ea5e9', status: 'online' };
const folders = [
  { id: 'w', name: 'Workshops', parentId: null },
  { id: 'x', name: 'Elsewhere', parentId: null },
];
const teams = [{ id: 't', name: 'Design team' }];
const teamFolders = { t: [{ id: 's', name: 'Sprints', parentId: null }] };

function renderWizard(skipLocation?: SkipLocationStep | null) {
  const onPick = vi.fn();
  render(
    <TemplatePicker
      mode="welcome"
      participant={participant}
      currentThemeId="brand"
      onPick={onPick}
      onSkip={vi.fn()}
      onBackOut={vi.fn()}
      folders={folders}
      teams={teams}
      teamFolders={teamFolders}
      skipLocation={skipLocation}
    />,
  );
  return onPick;
}
const settingsOf = (onPick: ReturnType<typeof vi.fn>) => onPick.mock.calls[0]![3] as object;
const checkbox = () => screen.getByRole('checkbox', { name: /and skip this step/ });

describe('the Location step checkbox', () => {
  it('starts unticked, names the selection, and is not sent unticked', () => {
    const onPick = renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    expect((checkbox() as HTMLInputElement).checked).toBe(false);
    expect(checkbox().closest('label')!.textContent).toBe(
      'Always save new documents in My documents and skip this step',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(settingsOf(onPick)).not.toHaveProperty('skipLocationStep');
  });

  it('follows the selection and, ticked, sends the preference with Create', () => {
    const onPick = renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    // Into My documents from the space overview, then its folder.
    fireEvent.click(screen.getByRole('radio', { name: /My documents/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Workshops/ }));
    fireEvent.click(checkbox());
    expect(checkbox().closest('label')!.textContent).toContain('in Workshops and');
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(settingsOf(onPick)).toMatchObject({
      folderId: 'w',
      skipLocationStep: {
        saveLocation: 'livediagram',
        placement: 'folder:w',
        placeName: 'Workshops',
      },
    });
  });

  it('names Local Browser and saves it with no folder', () => {
    const onPick = renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Local Browser/ }));
    fireEvent.click(checkbox());
    expect(checkbox().closest('label')!.textContent).toContain('in Local Browser and');
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(settingsOf(onPick)).toMatchObject({
      saveLocation: 'browser',
      skipLocationStep: { saveLocation: 'browser', placement: 'unsorted' },
    });
  });

  it('starts unticked again each time the step shows', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    fireEvent.click(checkbox());
    fireEvent.click(screen.getByRole('button', { name: /Template/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    expect((checkbox() as HTMLInputElement).checked).toBe(false);
  });
});

describe('the wizard with the Location step skipped', () => {
  const saved: SkipLocationStep = {
    saveLocation: 'livediagram',
    placement: 'team:t:folder:s',
    placeName: 'Sprints · Design team',
  };

  it('is one step: no rail, Create on the template step, and where it saves', () => {
    renderWizard(saved);
    expect(screen.queryByRole('button', { name: /Location/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Next/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy();
    const note = screen.getByRole('note');
    expect(note.textContent).toMatch(/^Saving in Sprints · Design team/);
    expect(within(note).getByRole('button', { name: 'Change' })).toBeTruthy();
  });

  it('creates in the saved place, explicitly, from Create', () => {
    const onPick = renderWizard(saved);
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onPick.mock.calls[0]![0]).toBe('blank');
    expect(settingsOf(onPick)).toEqual({
      saveLocation: 'livediagram',
      documentName: 'Untitled document',
      teamId: 't',
      folderId: 's',
    });
  });

  it('creates at once when a template card is chosen', () => {
    const onPick = renderWizard({ ...saved, placement: 'unsorted', placeName: 'My documents' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search templates' }), {
      target: { value: 'kanban' },
    });
    return vi.waitFor(() => {
      fireEvent.click(screen.getAllByRole('button', { name: /Kanban/ })[0]!);
      expect(onPick).toHaveBeenCalledTimes(1);
      expect(onPick.mock.calls[0]![0]).toMatch(/kanban/i);
      expect(settingsOf(onPick)).toMatchObject({ teamId: null, folderId: null });
    });
  });

  it('saves Local Browser documents with no placement', () => {
    const onPick = renderWizard({
      saveLocation: 'browser',
      placement: 'unsorted',
      placeName: 'Local Browser',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(settingsOf(onPick)).toEqual({
      saveLocation: 'browser',
      documentName: 'Untitled document',
    });
  });

  it('Change opens the Location step on the saved place, for this document only', () => {
    const onPick = renderWizard({ ...saved, placement: 'folder:w', placeName: 'Workshops' });
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByRole('button', { name: /Location/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Workshops/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
    // Back on the template step the visit stays two steps.
    fireEvent.click(screen.getByRole('button', { name: /Template/ }));
    expect(screen.getByRole('button', { name: /^Next/ })).toBeTruthy();
    expect(onPick).not.toHaveBeenCalled();
  });
});
