// @vitest-environment jsdom

// AI Settings > Sources (docs/specs/030-knowledgebase/search-and-ask.md "Sources in AI Settings", "Share roles"):
// every role reads it, an Editor alone changes it, a team folder only on a team's knowledgebase, and each source's
// state in words.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeSourceRow, KnowledgeSources } from '@liveknowledge/api-schema';

const api = vi.hoisted(() => ({ apiKnowledgeSources: vi.fn(), apiSetKnowledgeSources: vi.fn() }));
vi.mock('@/lib/api/knowledge', async (actual) => ({
  ...(await actual<typeof import('@/lib/api/knowledge')>()),
  ...api,
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { track } from '@/lib/telemetry';
import { AiSourcesSection, SOURCES_SHOWN, sourceStateWords } from './AiSourcesSection';

const NOW = Date.UTC(2026, 10, 23);
const row = (n: number, over: Partial<KnowledgeSourceRow> = {}): KnowledgeSourceRow => ({
  itemId: `i${n}`,
  app: 'livediagram',
  title: `Diagram ${n}`,
  origin: 'connected',
  state: 'read',
  chunks: 3,
  readAt: NOW - 86_400_000,
  ...over,
});
const sources = (over: Partial<KnowledgeSources> = {}): KnowledgeSources => ({
  connected: true,
  folderId: null,
  folderName: null,
  teamId: null,
  items: [
    row(1),
    row(2, { app: 'liveplanner', title: 'Launch Plan', state: 'waiting', readAt: undefined }),
  ],
  ...over,
});
const who = { owner: 'user_o' } as never;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const draw = (manage: boolean, loadFolders = vi.fn(async () => [])) =>
  render(
    <AiSourcesSection
      who={who}
      documentId="kb"
      manage={manage}
      now={NOW}
      loadFolders={loadFolders}
    />,
  );

describe('AiSourcesSection', () => {
  it('shows a Participant or Viewer the sources and the settings, with nothing to change', async () => {
    api.apiKnowledgeSources.mockResolvedValue(sources());
    draw(false);
    const list = await screen.findByRole('list');
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Diagram 1Read 22 Nov', 'Launch PlanReading Soon']);
    expect(screen.getByText('Always')).toBeTruthy();
    expect(screen.getByText('On')).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByText('A Team Folder')).toBeNull();
  });

  it("lets an Editor turn Connected Items off, and says so when it couldn't", async () => {
    api.apiKnowledgeSources.mockResolvedValue(sources());
    api.apiSetKnowledgeSources.mockResolvedValueOnce(sources({ connected: false, items: [] }));
    draw(true);
    fireEvent.click(await screen.findByRole('switch', { name: 'Connected Items' }));
    await waitFor(() =>
      expect(api.apiSetKnowledgeSources).toHaveBeenCalledWith(who, 'kb', { connected: false }),
    );
    expect(await screen.findByText(/No connected items yet/)).toBeTruthy();
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'SourcesConnectedOff');
    api.apiSetKnowledgeSources.mockRejectedValueOnce(new Error('down'));
    fireEvent.click(screen.getByRole('switch', { name: 'Connected Items' }));
    expect((await screen.findByRole('alert')).textContent).toContain("couldn't be changed");
  });

  it("offers an Editor the team's folders on a team knowledgebase, and keeps the chosen one", async () => {
    api.apiKnowledgeSources.mockResolvedValue(
      sources({ teamId: 'T', folderId: 'f0', folderName: 'Old Specs' }),
    );
    api.apiSetKnowledgeSources.mockResolvedValue(
      sources({ teamId: 'T', folderId: 'f1', folderName: 'Specs' }),
    );
    const loadFolders = vi.fn(async () => [{ id: 'f1', name: 'Specs' }] as never);
    draw(true, loadFolders);
    const select = await screen.findByRole<HTMLSelectElement>('combobox', {
      name: 'A Team Folder',
    });
    await waitFor(() => expect(select.disabled).toBe(false));
    expect(loadFolders).toHaveBeenCalledWith('T');
    expect([...select.options].map((o) => o.textContent)).toEqual(['None', 'Old Specs', 'Specs']);
    fireEvent.change(select, { target: { value: 'f1' } });
    await waitFor(() =>
      expect(api.apiSetKnowledgeSources).toHaveBeenCalledWith(who, 'kb', {
        folderId: 'f1',
        folderName: 'Specs',
      }),
    );
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'SourcesFolderOn');
  });

  it('shows a reader the chosen folder by name, and lists the first sources with how many more', async () => {
    const items = Array.from({ length: SOURCES_SHOWN + 3 }, (_, i) => row(i));
    api.apiKnowledgeSources.mockResolvedValue(
      sources({ teamId: 'T', folderId: 'f1', folderName: 'Specs', items }),
    );
    draw(false);
    expect(await screen.findByText('and 3 more')).toBeTruthy();
    expect(screen.getByText('Specs')).toBeTruthy();
  });

  it('says when the sources could not be read', async () => {
    api.apiKnowledgeSources.mockRejectedValue(new Error('down'));
    draw(true);
    expect((await screen.findByRole('status')).textContent).toContain("couldn't be read");
  });

  it('words each state', () => {
    expect(sourceStateWords(row(1, { readAt: undefined }), NOW)).toBe('Read');
    expect(sourceStateWords(row(1, { state: 'capped' }), NOW)).toBe('Over the Limit');
    expect(sourceStateWords(row(1, { state: 'failed' }), NOW)).toBe("Couldn't Read");
  });
});
