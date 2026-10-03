// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Settings > Documents > Where New Documents Go (docs/specs/013-workspace/default-folders.md
// "Settings"): each row says where its new documents go, and changes or clears it.

const { api } = vi.hoisted(() => ({
  api: {
    apiListPlacementDefaults: vi.fn(),
    apiSetPlacementDefault: vi.fn(),
    apiClearPlacementDefault: vi.fn(),
  },
}));
vi.mock('@/lib/api/placement-defaults', () => api);
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { DEFAULT_FOLDER_NAMES_PREFIX } from '@/lib/placement-defaults/default-folder-names';
import {
  loadPlacementDefaults,
  resetPlacementDefaultsForTests,
} from '@/lib/placement-defaults/placement-defaults-store';
import { SETTINGS_CATEGORIES, type SettingsPlacementDefaultRowSpec } from './settings-catalogue';
import {
  SettingsPlacementDefaultRow,
  type SettingsPlacementLists,
} from './SettingsPlacementDefaultRow';

const rowFor = (key: string) =>
  SETTINGS_CATEGORIES.find((c) => c.id === 'documents')!.rows.find(
    (r) => r.kind === 'placementDefault' && r.placementKey === key,
  ) as SettingsPlacementDefaultRowSpec;

const lists = (over: Partial<SettingsPlacementLists> = {}): SettingsPlacementLists => ({
  folders: [{ id: 'w', name: 'Workshops', parentId: null }],
  teams: [{ id: 't', name: 'Design' }],
  teamFolders: { t: [{ id: 's', name: 'Sprints', parentId: null }] },
  createPickerFolder: async () => null,
  createPickerTeam: async () => null,
  ready: true,
  failed: false,
  ...over,
});

async function withDefaults(entries: { key: string; folderId: string }[]) {
  api.apiListPlacementDefaults.mockResolvedValue(entries);
  await act(() => loadPlacementDefaults('owner'));
}

beforeEach(() => {
  resetPlacementDefaultsForTests();
  localStorage.clear();
  api.apiClearPlacementDefault.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('SettingsPlacementDefaultRow', () => {
  it('lists the six entries in title case under Where New Documents Go', () => {
    const rows = SETTINGS_CATEGORIES.find((c) => c.id === 'documents')!.rows;
    expect(rows.map((r) => r.label)).toEqual([
      'Diagrams',
      'Whiteboards',
      'Infographics',
      'Event Storming Boards',
      'Retrospectives',
      'Kanban Boards',
    ]);
    expect(new Set(rows.map((r) => r.section))).toEqual(new Set(['Where New Documents Go']));
  });

  it('says My documents without a default, and offers no Clear', async () => {
    await withDefaults([]);
    render(<SettingsPlacementDefaultRow row={rowFor('mode:draw')} lists={lists()} />);
    expect(screen.getByText('My documents')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Change default folder for whiteboards' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Clear/ })).toBeNull();
  });

  it('names the folder, with its team, and clears it', async () => {
    await withDefaults([{ key: 'mode:draw', folderId: 's' }]);
    render(<SettingsPlacementDefaultRow row={rowFor('mode:draw')} lists={lists()} />);
    expect(screen.getByText('Sprints · Design')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Clear default folder for whiteboards' }));
    });
    expect(api.apiClearPlacementDefault).toHaveBeenCalledWith('owner', 'mode:draw');
    expect(screen.getByText('My documents')).toBeTruthy();
  });

  it('says a deleted default is deleted, by its remembered name, and where documents go instead', async () => {
    localStorage.setItem(
      `${DEFAULT_FOLDER_NAMES_PREFIX}owner`,
      JSON.stringify({ gone: { name: 'Old retros', teamId: null } }),
    );
    await withDefaults([
      { key: 'template:retrospective', folderId: 'gone' },
      { key: 'mode:diagram', folderId: 'w' },
    ]);
    render(<SettingsPlacementDefaultRow row={rowFor('template:retrospective')} lists={lists()} />);
    expect(screen.getByText('Old retros (deleted), using Workshops')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Clear default folder for retrospectives' }),
    ).toBeTruthy();
  });

  it('says so when it never saw the deleted folder', async () => {
    await withDefaults([{ key: 'mode:draw', folderId: 'gone' }]);
    render(<SettingsPlacementDefaultRow row={rowFor('mode:draw')} lists={lists()} />);
    expect(screen.getByText('A deleted folder, using My documents')).toBeTruthy();
  });

  it('waits for the folders before judging, and says when it cannot read them', async () => {
    await withDefaults([{ key: 'mode:draw', folderId: 'w' }]);
    const { rerender } = render(
      <SettingsPlacementDefaultRow row={rowFor('mode:draw')} lists={lists({ ready: false })} />,
    );
    expect(screen.getByText('Loading…')).toBeTruthy();
    rerender(
      <SettingsPlacementDefaultRow
        row={rowFor('mode:draw')}
        lists={lists({ ready: false, failed: true })}
      />,
    );
    expect(screen.getByText("Couldn't load your default folders")).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Change/ })).toBeNull();
  });
});
