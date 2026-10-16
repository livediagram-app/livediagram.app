// @vitest-environment jsdom

// The Forms tour's offer (docs/specs/030-forms/forms.md "The Forms tour"): on opening a Form tab, once, to an Editor,
// never with another tour, and rerun from Show Me Around in the form's cog, seen or not.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestFormTourRelaunch } from '@/lib/form-tour';
import { setActiveTour } from '@/lib/tour-active';
import { setStartPanelOpen } from '@/components/start/start-panel-open';
import type { TourEngine } from './useTourEngine';
import type { FormTourApi } from './form-tour-steps';
import { FormTourHost } from './FormTourHost';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const stage = vi.hoisted(() => ({ engine: null as TourEngine<FormTourApi> | null }));
vi.mock('./TourStage', () => ({
  TourStage: ({ engine }: { engine: TourEngine<FormTourApi> }) => {
    stage.engine = engine;
    return null;
  },
}));
vi.mock('./tour-dom', () => ({
  findTour: () => null,
  clickTour: () => false,
  waitForSelector: async () => null,
  waitForTour: async () => null,
}));
const ctx = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/app/document/[id]/EditorContext', () => ({ useEditorContext: () => ctx.current }));
const selectTab = vi.hoisted(() => vi.fn());
vi.mock('@/app/document/[id]/useSelectTab', () => ({ useSelectTab: () => selectTab }));

const setUserPreferences = vi.fn();
const writeUserPreferences = vi.fn();

const FORM = {
  v: 1,
  heading: 'Feedback',
  sections: [{ id: 's-1', title: '', questions: [{ id: 'q-1', type: 'short', prompt: 'Name' }] }],
};
const formTab = (form: Record<string, unknown> = FORM) => ({
  id: 'form1',
  kind: 'form',
  locked: false,
  form,
});

const editor = (over: Record<string, unknown> = {}) => {
  ctx.current = {
    hydrated: true,
    anyWelcomeOpen: false,
    isReadOnly: false,
    can: { level: 'edit' },
    embedMode: false,
    activeTab: formTab(),
    userPreferences: { tourSeen: true },
    setUserPreferences,
    writeUserPreferences,
    selfParticipant: { id: 'me' },
    prefsSettled: true,
    ...over,
  };
};
const offered = () => track.mock.calls.some((c) => c[1] === 'Opened' && c[2] === 'FormTourOffer');

beforeEach(() => {
  vi.useFakeTimers();
  track.mockReset();
  stage.engine = null;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  setActiveTour('welcome', false);
  setActiveTour('plan', false);
  setActiveTour('form', false);
  setStartPanelOpen(false);
});

describe('FormTourHost offer', () => {
  it('offers itself after the settle delay on a Form tab', () => {
    editor();
    render(<FormTourHost />);
    act(() => {
      vi.advanceTimersByTime(799);
    });
    expect(offered()).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(offered()).toBe(true);
    expect(stage.engine?.active).toBe(true);
  });

  it('waits for a Form tab', () => {
    editor({ activeTab: { id: 'board1', kind: 'board', locked: false } });
    const { rerender } = render(<FormTourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
    editor();
    rerender(<FormTourHost />);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
  });

  it.each([
    ['seen', { userPreferences: { tourSeen: true, formTourSeen: true } }],
    ['read-only', { isReadOnly: true }],
    ['a Participant', { can: { level: 'participate' } }],
    ['a Viewer', { can: { level: 'view' } }],
    ['locked', { activeTab: { ...formTab(), locked: true } }],
    ['not hydrated', { hydrated: false }],
    ['embedded', { embedMode: true }],
    ['before the synced preferences are in', { prefsSettled: false }],
  ])('makes no offer when %s', (_why, over) => {
    editor(over);
    render(<FormTourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
  });

  it('waits while another tour is on screen, then follows it', () => {
    setActiveTour('plan', true);
    editor();
    render(<FormTourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
    act(() => setActiveTour('plan', false));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
  });

  it('waits while a start panel is on screen', () => {
    act(() => setStartPanelOpen(true));
    editor();
    render(<FormTourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
    act(() => setStartPanelOpen(false));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
  });

  // The reported bug: Show Me Around did nothing for someone who had seen the tour.
  it('reruns from Show Me Around for someone who has seen it', () => {
    editor({ userPreferences: { tourSeen: true, formTourSeen: true } });
    render(<FormTourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
    act(() => requestFormTourRelaunch());
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(offered()).toBe(true);
  });
});

describe('FormTourHost steps', () => {
  const start = (tab = formTab()) => {
    editor({ activeTab: tab });
    const r = render(<FormTourHost />);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    return r;
  };

  it('declining marks it seen and sends the decline', () => {
    start();
    act(() => stage.engine!.skip());
    expect(writeUserPreferences).toHaveBeenCalledWith({ tourSeen: true, formTourSeen: true }, 'me');
    expect(track).toHaveBeenCalledWith('UI', 'Closed', 'FormTourOffer');
  });

  it('starting runs the steps and completing sends the completion', async () => {
    start();
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'FormTour');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(stage.engine?.step?.id).toBe('outro');
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'FormTourCompleted');
  });

  // The reported bug: opening the sheet for the destination step ended the tour, as the sheet holds no form to read.
  it('keeps running on the tab its responses go to', () => {
    const tab = formTab({ ...FORM, sheet: { tabId: 'sheet1', sheetId: 'AAAAAAAAAAA1' } });
    const r = start(tab);
    act(() => stage.engine!.next());
    editor({ activeTab: { id: 'sheet1', kind: 'sheet', locked: false } });
    r.rerender(<FormTourHost />);
    expect(track).not.toHaveBeenCalledWith('UI', 'Ended', 'FormTourSkipped');
    expect(stage.engine?.active).toBe(true);
  });

  it('ends as skipped when the person opens a tab that is neither the form nor its destination', () => {
    const r = start();
    act(() => stage.engine!.next());
    editor({ activeTab: { id: 'other', kind: 'board', locked: false } });
    r.rerender(<FormTourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'FormTourSkipped');
    expect(stage.engine?.active).toBe(false);
  });
});
