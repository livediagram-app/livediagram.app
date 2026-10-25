// @vitest-environment jsdom

// The Forms tour's way in (docs/specs/030-forms/forms.md "The Forms tour"): the footer's Start Tour button on a Form
// tab, to an Editor, taken or not; a press there, or Show Me Around in the form's cog, starts it, never beside another
// tour. It never starts on its own.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestFormTourRelaunch } from '@/lib/form-tour';
import { setActiveTour } from '@/lib/tour-active';
import {
  resetTourOffersForTests,
  tourOffer,
} from '@liveworkspace/workbench/components/tour/tour-offer';
import type { TourEngine } from '@liveworkspace/workbench/components/tour/useTourEngine';
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
vi.mock('@liveworkspace/workbench/components/tour/tour-dom', () => ({
  findTour: () => null,
  clickTour: () => false,
  waitForSelector: async () => null,
  waitForTour: async () => null,
}));
const ctx = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/app/project/[id]/EditorContext', () => ({ useEditorContext: () => ctx.current }));
const selectTab = vi.hoisted(() => vi.fn());
vi.mock('@/app/project/[id]/useSelectTab', () => ({ useSelectTab: () => selectTab }));

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
const startedTour = () => track.mock.calls.some((c) => c[1] === 'Started' && c[2] === 'FormTour');

beforeEach(() => {
  vi.useFakeTimers();
  track.mockReset();
  stage.engine = null;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  setActiveTour('plan', false);
  setActiveTour('form', false);
  resetTourOffersForTests();
});

describe('FormTourHost offer', () => {
  it('offers "Forms" on the footer button on a Form tab, and never starts on its own', () => {
    editor();
    render(<FormTourHost />);
    expect(tourOffer()?.name).toBe('Forms');
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(startedTour()).toBe(false);
    expect(stage.engine?.active).toBe(false);
  });

  it('starts from the button', () => {
    editor();
    render(<FormTourHost />);
    act(() => tourOffer()!.start());
    expect(startedTour()).toBe(true);
    expect(stage.engine?.active).toBe(true);
  });

  it('offers nothing off a Form tab', () => {
    editor({ activeTab: { id: 'board1', kind: 'board', locked: false } });
    render(<FormTourHost />);
    expect(tourOffer()).toBeNull();
  });

  it('stays on offer once seen, so it can be taken again', () => {
    editor({ userPreferences: { tourSeen: true, formTourSeen: true } });
    render(<FormTourHost />);
    expect(tourOffer()?.name).toBe('Forms');
  });

  it.each([
    ['read-only', { isReadOnly: true }],
    ['a Participant', { can: { level: 'participate' } }],
    ['a Viewer', { can: { level: 'view' } }],
    ['locked', { activeTab: { ...formTab(), locked: true } }],
    ['not hydrated', { hydrated: false }],
    ['embedded', { embedMode: true }],
  ])('offers nothing when %s', (_why, over) => {
    editor(over);
    render(<FormTourHost />);
    expect(tourOffer()).toBeNull();
  });

  it('starts nothing while another tour is on screen', () => {
    setActiveTour('plan', true);
    editor();
    render(<FormTourHost />);
    act(() => tourOffer()!.start());
    expect(startedTour()).toBe(false);
  });

  // The reported bug: Show Me Around did nothing for someone who had seen the tour.
  it('reruns from Show Me Around for someone who has seen it', () => {
    editor({ userPreferences: { tourSeen: true, formTourSeen: true } });
    render(<FormTourHost />);
    act(() => requestFormTourRelaunch());
    expect(startedTour()).toBe(true);
  });
});

describe('FormTourHost steps', () => {
  const start = (tab = formTab()) => {
    editor({ activeTab: tab });
    const r = render(<FormTourHost />);
    act(() => tourOffer()!.start());
    return r;
  };

  it('skipping marks it seen and sends the skip', () => {
    start();
    act(() => stage.engine!.skip());
    expect(writeUserPreferences).toHaveBeenCalledWith({ tourSeen: true, formTourSeen: true }, 'me');
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'FormTourSkipped');
  });

  it('runs the steps and completing sends the completion', async () => {
    start();
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
    editor({ activeTab: { id: 'sheet1', kind: 'sheet', locked: false } });
    r.rerender(<FormTourHost />);
    expect(track).not.toHaveBeenCalledWith('UI', 'Ended', 'FormTourSkipped');
    expect(stage.engine?.active).toBe(true);
  });

  it('ends as skipped when the person opens a tab that is neither the form nor its destination', () => {
    const r = start();
    editor({ activeTab: { id: 'other', kind: 'board', locked: false } });
    r.rerender(<FormTourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'FormTourSkipped');
    expect(stage.engine?.active).toBe(false);
  });
});
