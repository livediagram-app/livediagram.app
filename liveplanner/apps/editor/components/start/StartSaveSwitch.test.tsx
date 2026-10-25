// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// docs/specs/006-project/save-locations.md "On the start screen": the start's Sync Plan to Server switch shows on
// a fresh plan that is the reader's alone, reflects where it is, and moves it with the editor's in-place moves.

const { state, toast } = vi.hoisted(() => ({
  state: { ctx: null as Record<string, unknown> | null, offline: false },
  toast: { error: vi.fn() },
}));
vi.mock('@/app/project/[id]/EditorContext', () => ({
  useOptionalEditorContext: () => state.ctx,
}));
vi.mock('@/hooks/persistence/useIsOfflineProject', () => ({
  useIsOfflineProject: () => state.offline,
}));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

import { ConversionInProgressError } from '@/lib/offline/offline-convert';
import { StartSaveSwitch } from './StartSaveSwitch';

const PALETTE = {
  surface: '#f8fafc',
  border: '#e2e8f0',
  column: '#f1f5f9',
  card: '#ffffff',
  text: '#0f172a',
  muted: '#5d6d83',
  focus: '#0ea5e9',
  cardBorder: '#e2e8f0',
  warning: '#b45309',
  warningBg: '#fef3c7',
};

function fresh(over: Record<string, unknown> = {}) {
  return {
    projectId: 'doc-1',
    hydrated: true,
    authLoaded: true,
    selfParticipant: { id: 'user-1' },
    accountUserId: 'user-1',
    isOwner: true,
    isReadOnly: false,
    embedMode: false,
    workbenchMode: false,
    tabs: [{ id: 't1' }],
    activeTab: { id: 't1', elements: [] },
    projectShareable: false,
    projectTeamId: null,
    sessionShareCode: null,
    livePresence: [{ id: 'user-1' }],
    syncToCloud: vi.fn(() => Promise.resolve()),
    takeOfflineInPlace: vi.fn(() => Promise.resolve()),
    ...over,
  };
}

beforeEach(() => {
  state.offline = false;
  state.ctx = fresh();
});
afterEach(() => vi.clearAllMocks());

const view = () => render(<StartSaveSwitch palette={PALETTE} />);

describe('StartSaveSwitch', () => {
  it('names the switch for a document and shows it on, on the server, for a signed-in owner', () => {
    view();
    const sw = screen.getByRole('switch', { name: 'Sync Plan to Server' });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Saved to your account, on every device.')).toBeTruthy();
  });

  it('shows off for a guest’s document in this browser', () => {
    state.offline = true;
    state.ctx = fresh({
      accountUserId: null,
      selfParticipant: { id: 'guest-1' },
      livePresence: [],
    });
    view();
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
    expect(
      screen.getByText(
        'Saved in this browser only. Turn on to save it to our servers and share it.',
      ),
    ).toBeTruthy();
  });

  it.each([
    ['outside an editor', null],
    ['before sign-in answers', { authLoaded: false }],
    ['as the early placeholder', { selfParticipant: { id: 'self' } }],
    ['for someone else’s document', { isOwner: false }],
    ['read only', { isReadOnly: true }],
    ['embedded', { embedMode: true }],
    ['in a workbench', { workbenchMode: true }],
    ['with a second tab', { tabs: [{ id: 't1' }, { id: 't2' }] }],
    ['with something on it', { activeTab: { id: 't1', elements: [{ id: 'e1' }] } }],
    ['shared by link', { projectShareable: true }],
    ['in a team', { projectTeamId: 'team-1' }],
    ['opened through a link', { sessionShareCode: 'abc' }],
    ['with someone else in it', { livePresence: [{ id: 'user-1' }, { id: 'user-2' }] }],
  ])('is hidden %s', (_why, over) => {
    state.ctx = over === null ? null : fresh(over);
    view();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('turned off, takes the document to this browser in place', async () => {
    view();
    await act(async () => fireEvent.click(screen.getByRole('switch')));
    expect(state.ctx!.takeOfflineInPlace).toHaveBeenCalledTimes(1);
    expect(state.ctx!.syncToCloud).not.toHaveBeenCalled();
  });

  it('turned on, syncs the document in place', async () => {
    state.offline = true;
    view();
    await act(async () => fireEvent.click(screen.getByRole('switch')));
    expect(state.ctx!.syncToCloud).toHaveBeenCalledTimes(1);
    expect(state.ctx!.takeOfflineInPlace).not.toHaveBeenCalled();
  });

  it('a failed move toasts and the switch returns', async () => {
    state.ctx = fresh({ takeOfflineInPlace: vi.fn(() => Promise.reject(new Error('down'))) });
    view();
    await act(async () => fireEvent.click(screen.getByRole('switch')));
    expect(toast.error).toHaveBeenCalledWith(
      'Couldn’t move this to this browser. It stays safe on the server.',
    );
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('a move already running elsewhere stays quiet', async () => {
    state.offline = true;
    state.ctx = fresh({
      syncToCloud: vi.fn(() => Promise.reject(new ConversionInProgressError())),
    });
    view();
    await act(async () => fireEvent.click(screen.getByRole('switch')));
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  });
});
