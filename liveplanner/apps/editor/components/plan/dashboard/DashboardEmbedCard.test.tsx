// @vitest-environment jsdom
// docs/specs/013-workspace/embeds.md "Embed File on a Dashboard": an Editor chooses the file (at once when they placed
// the slot, by Choose a File, by a double-click); a Participant or a Viewer only reads it, with their own access.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardEmbedContent } from '@liveplanner/project';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { DashboardEmbedCard } from './DashboardEmbedCard';
import { act } from 'react';
import { askEmbedFile, forgetEmbedAsk } from '@/lib/embed-open-store';

const track = vi.fn();
vi.mock('@/lib/telemetry', () => ({
  track: (...a: unknown[]) => {
    track(...a);
  },
}));
// The dialog loads only when opened; here it is a stand-in that chooses a file or closes.
vi.mock('next/dynamic', () => ({
  default:
    () =>
    ({ onChoose, onClose }: { onChoose: (c: unknown) => void; onClose: () => void }) => (
      <div role="dialog" aria-label="Embed File">
        <button
          onClick={() =>
            onChoose({ liveItem: { app: 'liveknowledge', itemId: 'k1' }, liveName: 'Handbook' })
          }
        >
          Pick
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    ),
}));
vi.mock('@liveworkspace/workbench/components/live-embed/LiveEmbedView', () => ({
  LiveEmbedView: (p: { liveName?: string; canChoose: boolean; controlsAt?: string }) => (
    <div data-testid="face" data-can-choose={String(p.canChoose)} data-controls={p.controlsAt}>
      {p.liveName ?? 'empty'}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  track.mockClear();
});

type Role = 'Editor' | 'Participant' | 'Viewer';

function show(role: Role, embed: DashboardEmbedContent = { type: 'embed' }, slotId = 's1') {
  const setSlotContent = vi.fn();
  const value = {
    tabs: [],
    elements: new Map(),
    // Only an Editor reshapes the dashboard (plan-tabs.md "Who can do what").
    canEdit: role === 'Editor',
    actions: { setSlotContent },
    openTab: vi.fn(),
    tabStatus: () => 'loaded',
    retryTab: vi.fn(),
  } as unknown as DashboardContextValue;
  render(
    <DashboardContext.Provider value={value}>
      <DashboardEmbedCard slotId={slotId} embed={embed} />
    </DashboardContext.Provider>,
  );
  return setSlotContent;
}

describe('Embed File on a Dashboard', () => {
  it('opens Embed File at once for the Editor who placed it, once', () => {
    askEmbedFile('placed');
    show('Editor', { type: 'embed' }, 'placed');
    expect(screen.getByRole('dialog', { name: 'Embed File' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    cleanup();
    show('Editor', { type: 'embed' }, 'placed');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens when Slot Settings asks (Change File)', () => {
    show('Editor', {
      type: 'embed',
      liveItem: { app: 'livediagram', itemId: 'd' },
      liveName: 'Flow',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => askEmbedFile('s1'));
    expect(screen.getByRole('dialog', { name: 'Embed File' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('commits the chosen file to the slot and counts it', () => {
    const setSlotContent = show('Editor');
    fireEvent.click(screen.getByRole('button', { name: 'Choose a File' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick' }));
    expect(setSlotContent).toHaveBeenCalledWith('s1', {
      type: 'embed',
      liveItem: { app: 'liveknowledge', itemId: 'k1' },
      liveName: 'Handbook',
    });
    expect(track).toHaveBeenCalledWith('Element', 'Added', 'LiveEmbed');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lets an Editor change the file with a double-click, with Use and Open inside the slot', () => {
    show('Editor', {
      type: 'embed',
      liveItem: { app: 'livediagram', itemId: 'd' },
      liveName: 'Flow',
    });
    expect(screen.queryByRole('button', { name: 'Choose a File' })).toBeNull();
    const face = screen.getByTestId('face');
    expect(face.dataset['canChoose']).toBe('true');
    expect(face.dataset['controls']).toBe('inside');
    fireEvent.doubleClick(face);
    expect(screen.getByRole('dialog', { name: 'Embed File' })).toBeTruthy();
  });

  it.each(['Participant', 'Viewer'] as const)(
    'gives a %s the file to read and nothing to choose',
    (role) => {
      askEmbedFile('s1');
      const setSlotContent = show(role);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Choose a File' })).toBeNull();
      const face = screen.getByTestId('face');
      expect(face.dataset['canChoose']).toBe('false');
      fireEvent.doubleClick(face);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(setSlotContent).not.toHaveBeenCalled();
      forgetEmbedAsk('s1');
    },
  );
});
