// @vitest-environment jsdom

// Connect on an Unanswered question's likely item (docs/specs/030-knowledgebase/insights.md "Likely answered
// elsewhere"): an Editor's alone, at View and one way, a row added for it, a toast either way.
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connectFile: vi.fn(),
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
vi.mock('@liveworkspace/workbench/components/connect/connect-file', () => ({
  connectFile: mocks.connectFile,
}));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({ indexClient: { name: 'index' } }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => mocks.toast }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { track } from '@/lib/telemetry';
import { chromeValue, renderInEditor, type Role } from '../ask/test-chrome';
import { useConnectLikely } from './useConnectLikely';

const LIKELY = { app: 'livediagram', itemId: 'd9', title: 'Approvals Flow' } as const;

function Probe({ manage }: { manage: boolean }) {
  const { canConnect, connecting, connect } = useConnectLikely(manage);
  return (
    <button
      type="button"
      data-can={String(canConnect)}
      data-busy={connecting ?? ''}
      onClick={() => void connect(LIKELY)}
    >
      Connect
    </button>
  );
}

function draw(
  role: Role,
  manage: boolean,
  connected: string[] = [],
  grant: string | null = 'grant',
) {
  const addConnectedRow = vi.fn();
  renderInEditor(
    <Probe manage={manage} />,
    chromeValue(role, {
      addConnectedRow,
      connectedTabs: { connected: new Set(connected), grant: async () => grant },
    }),
  );
  return { button: screen.getByRole('button'), addConnectedRow };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useConnectLikely', () => {
  it("connects for an Editor at View, one way, adding the item's row", async () => {
    mocks.connectFile.mockImplementation(async (options: { addTab: (made: unknown) => void }) =>
      options.addTab({ id: 'cn' }),
    );
    const { button, addConnectedRow } = draw('edit', true);
    expect(button.dataset.can).toBe('true');
    await act(async () => fireEvent.click(button));
    expect(mocks.connectFile).toHaveBeenCalledWith(
      expect.objectContaining({
        hostId: 'd1',
        grant: 'grant',
        targetId: 'd9',
        level: 'view',
        both: false,
      }),
    );
    expect(addConnectedRow).toHaveBeenCalledWith({ id: 'cn' }, expect.any(String));
    expect(mocks.toast.success).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'ConnectLikely');
  });

  it.each(['participate', 'view'] as const)('is not offered to a %s session', async (role) => {
    const { button } = draw(role, false);
    expect(button.dataset.can).toBe('false');
    await act(async () => fireEvent.click(button));
    expect(mocks.connectFile).not.toHaveBeenCalled();
  });

  it('says so when the item is already connected, and when connecting fails', async () => {
    const first = draw('edit', true, ['d9']);
    await act(async () => fireEvent.click(first.button));
    expect(mocks.toast.info).toHaveBeenCalledWith('Approvals Flow is already connected.');
    cleanup();
    const second = draw('edit', true, [], null);
    await act(async () => fireEvent.click(second.button));
    expect(mocks.toast.error).toHaveBeenCalled();
    expect(mocks.connectFile).not.toHaveBeenCalled();
  });
});
