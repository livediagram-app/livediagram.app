// @vitest-environment jsdom
// Bring In Your Diagrams and Docs (docs/specs/013-workspace/suggestions.md): a new knowledgebase offers an Editor to
// connect their recent diagrams and documents, one click connecting each at View; nothing once something is
// connected, in a grown knowledgebase, or with nothing recent; never to a Participant, a Viewer or a guest.
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maySuggestTo } from '@liveworkspace/workbench/components/suggest/suggest-gate';
import { resetSuggestionMemoryForTests } from '@liveworkspace/workbench/components/suggest/suggest-memory';
import { resetSuggestionShowingForTests } from '@liveworkspace/workbench/components/suggest/useSuggestion';
import { SUGGEST_IDLE_MS } from '@liveworkspace/workbench/components/suggest/suggestions';

const mocks = vi.hoisted(() => ({
  connectFile: vi.fn(),
  listItems: vi.fn(),
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
vi.mock('@liveworkspace/workbench/components/connect/connect-file', () => ({
  connectFile: mocks.connectFile,
}));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({
  indexClient: { listItems: mocks.listItems },
}));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => mocks.toast }));

import { chromeValue, page, renderInEditor, type Role } from '../ask/test-chrome';
import { BringInSuggestion, resetBringInForTests } from './BringInSuggestion';

const session = { readOnly: false, signedIn: true };

function draw(role: Role, over: Record<string, unknown> = {}, allowed?: boolean) {
  const addConnectedRow = vi.fn();
  renderInEditor(
    <BringInSuggestion
      itemId="d1"
      allowed={allowed ?? maySuggestTo({ ...session, level: role, readOnly: role !== 'edit' })}
    />,
    chromeValue(role, {
      addConnectedRow,
      connectedTabs: { connected: new Set<string>(), grant: async () => 'grant' },
      ...over,
    }),
  );
  return { addConnectedRow };
}

async function settle() {
  await act(async () => {
    vi.advanceTimersByTime(SUGGEST_IDLE_MS);
    for (let i = 0; i < 4; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  resetSuggestionMemoryForTests();
  resetSuggestionShowingForTests();
  resetBringInForTests();
  mocks.listItems.mockImplementation(async ({ app }: { app: string }) => ({
    items:
      app === 'livediagram'
        ? [
            { id: 'g1', title: 'Flow' },
            { id: 'g2', title: 'Map' },
          ]
        : [{ id: 'k1', title: 'Spec' }],
  }));
  mocks.connectFile.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('BringInSuggestion', () => {
  it('offers an Editor of a new knowledgebase their recent items, and connects each at View', async () => {
    draw('edit');
    await settle();
    expect(screen.getByText('Bring In Your Diagrams and Docs')).toBeTruthy();
    expect(screen.getByText(/Connect your 3 most recent diagrams and documents/)).toBeTruthy();
    mocks.connectFile.mockRejectedValueOnce(new Error('gone'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connect Them' }));
      for (let i = 0; i < 6; i++) await Promise.resolve();
    });
    expect(mocks.connectFile).toHaveBeenCalledTimes(3);
    expect(mocks.connectFile.mock.calls[1]![0]).toMatchObject({
      hostId: 'd1',
      grant: 'grant',
      targetId: 'g2',
      level: 'view',
      both: false,
    });
    expect(mocks.toast.success).toHaveBeenCalledWith(
      'Connected 2 items. Ask answers from them once they have been read.',
    );
  });

  it('says so when nothing could be connected, or there is no grant', async () => {
    draw('edit', { connectedTabs: { connected: new Set<string>(), grant: async () => null } });
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connect Them' }));
      for (let i = 0; i < 4; i++) await Promise.resolve();
    });
    expect(mocks.toast.error).toHaveBeenCalled();
    expect(mocks.connectFile).not.toHaveBeenCalled();
  });

  it('offers nothing once something is connected, in a grown knowledgebase, or with nothing recent', async () => {
    draw('edit', { connectedTabs: { connected: new Set(['g1']), grant: async () => 'grant' } });
    await settle();
    cleanup();
    draw('edit', { tabs: ['a', 'b', 'c', 'd'].map((id) => page(id, id)) });
    await settle();
    expect(mocks.listItems).not.toHaveBeenCalled();
    cleanup();
    mocks.listItems.mockResolvedValue({ items: [] });
    draw('edit');
    await settle();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each(['participate', 'view'] as const)(
    'is never offered to a %s, nor a guest',
    async (role) => {
      draw(role);
      await settle();
      expect(screen.queryByRole('status')).toBeNull();
      cleanup();
      draw('edit', {}, maySuggestTo({ ...session, level: 'edit', signedIn: false }));
      await settle();
      expect(screen.queryByRole('status')).toBeNull();
    },
  );
});
