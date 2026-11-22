// @vitest-environment jsdom

// The Get Started tours' way in (docs/specs/007-editor/knowledge-tours.md "Where it appears", "Taken, on every device",
// "Settings"): the footer's Get Started button while any tour on offer is untaken, its list of them, a pick running
// one, the taken record kept per person, skip and the Settings rerun. Nothing starts on its own.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActiveTour } from '@liveworkspace/workbench/lib/tour-active';
import {
  resetTourOffersForTests,
  tourOffer,
} from '@liveworkspace/workbench/components/tour/tour-offer';
import type { TourEngine } from '@liveworkspace/workbench/components/tour/useTourEngine';
import { requestKnowledgeToursRelaunch } from '@/lib/knowledge-tours';
import type { KnowledgeTourApi } from './knowledge-tour-dom';
// Loaded at the press: imported here so the module loader is warm.
import './knowledge-tour-steps';
import { KnowledgeToursHost, knowledgeTourStepType } from './KnowledgeToursHost';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const stage = vi.hoisted(() => ({
  engine: null as TourEngine<KnowledgeTourApi> | null,
  helpHref: '' as string | undefined,
  ariaPrefix: '' as string | undefined,
}));
vi.mock('./TourStage', () => ({
  TourStage: ({
    engine,
    copy,
    ariaPrefix,
  }: {
    engine: TourEngine<KnowledgeTourApi>;
    copy: { helpHref?: string };
    ariaPrefix?: string;
  }) => {
    stage.engine = engine;
    stage.helpHref = copy.helpHref;
    stage.ariaPrefix = ariaPrefix;
    return null;
  },
}));
// The list as rows to press: the shared popover is tested in its package.
vi.mock('@liveworkspace/workbench/components/tour/GetStartedPopover', () => ({
  getStartedAnchor: () => document.querySelector('[data-tour-offer]'),
  GetStartedPopover: ({
    topics,
    onPick,
    onClose,
  }: {
    topics: { id: string; title: string; taken: boolean; meta?: string }[];
    onPick: (id: string) => void;
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label="Get Started">
      {topics.map((t) => (
        <button key={t.id} type="button" data-taken={t.taken} onClick={() => onPick(t.id)}>
          {t.title}
          {t.meta ? ` (${t.meta})` : ''}
        </button>
      ))}
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));
vi.mock('@liveworkspace/workbench/components/tour/tour-dom', () => ({
  findTour: () => null,
  clickTour: () => false,
  isOnScreen: () => true,
  waitForSelector: async (selector: string) => document.querySelector(selector) ?? document.body,
  waitForTour: async () => null,
}));
const views = vi.hoisted(() => ({ offered: true, offline: false, phone: false }));
vi.mock('@/components/ask/useKnowledgeViewsOffered', () => ({
  useKnowledgeViewsOffered: () => views.offered,
}));
vi.mock('@/hooks/persistence/useIsOfflineDocument', () => ({
  useIsOfflineDocument: () => views.offline,
}));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => views.phone,
}));
const ctx = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/app/document/[id]/EditorContext', () => ({
  useEditorChrome: (select: (v: unknown) => unknown) => select(ctx.current),
  useEditorChromeStore: () => ({ get: () => ctx.current }),
}));

const writeUserPreferences = vi.fn();
const setUserPreferences = vi.fn((next: Record<string, unknown>) => {
  ctx.current = { ...ctx.current, userPreferences: next };
});

const as = (role: 'Editor' | 'Participant' | 'Viewer', over: Record<string, unknown> = {}) => {
  ctx.current = {
    can: {
      editPages: role !== 'Viewer',
      takePart: role !== 'Viewer',
      manageKnowledgebase: role === 'Editor',
    },
    isStructureReadOnly: false,
    accountUserId: 'user_1',
    documentId: 'kb1',
    userPreferences: {},
    setUserPreferences,
    writeUserPreferences,
    selfParticipant: { id: 'me' },
    ...over,
  };
};

const mount = () => {
  const button = document.createElement('button');
  button.dataset.tourOffer = '';
  document.body.append(button);
  return render(<KnowledgeToursHost />);
};
const flush = () => act(async () => vi.advanceTimersByTimeAsync(0));
const openList = () => act(() => tourOffer()!.start());
const pick = async (title: RegExp) => {
  fireEvent.click(screen.getByRole('button', { name: title }));
  await flush();
};

beforeEach(() => {
  vi.useFakeTimers();
  views.offered = true;
  views.offline = false;
  views.phone = false;
  stage.engine = null;
  as('Editor');
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.clearAllMocks();
  vi.useRealTimers();
  setActiveTour('pages', false);
  resetTourOffersForTests();
});

describe('the Get Started button', () => {
  it('offers the tours on the footer button, as one list, and starts nothing on its own', async () => {
    mount();
    await flush();
    const offer = tourOffer()!;
    expect(offer.label).toBe('Knowledgebase Tours');
    expect(offer.ownPanel).toBe(true);
    expect(stage.engine!.active).toBe(false);
    expect(track).not.toHaveBeenCalledWith('UI', 'Started', expect.anything());
  });

  it('lists all six for an Editor, and only a reader’s for a Viewer', async () => {
    mount();
    openList();
    expect(
      screen.getAllByRole('button', { name: /Tour|Page|Knowledgebase|Agent|Together/ }),
    ).toHaveLength(6);
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'KnowledgeTours');
    cleanup();
    resetTourOffersForTests();
    as('Viewer');
    mount();
    openList();
    expect(screen.queryByRole('button', { name: /Your First Page/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Trust a Page \(2 steps\)/ })).toBeTruthy();
  });

  it('offers nothing where the views are not drawn', async () => {
    views.offered = false;
    mount();
    await flush();
    expect(tourOffer()).toBeNull();
  });

  it('leaves the button once every tour on offer is taken', async () => {
    as('Editor', { userPreferences: { knowledgeToursSeen: true } });
    mount();
    await flush();
    expect(tourOffer()).toBeNull();
  });
});

describe('a tour', () => {
  it('runs the one picked, takes it as it starts, and links its help article', async () => {
    mount();
    openList();
    await pick(/Trust a Page/);
    expect(stage.engine!.active).toBe(true);
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'TrustTour');
    expect(writeUserPreferences).toHaveBeenCalledWith({ knowledgeTours: ['trust'] }, 'me');
    expect(stage.helpHref).toBe('/help/knowledgebase/owners-and-verifying/');
    expect(stage.ariaPrefix).toBe('Trust a Page tour');
    // The list is gone while it runs.
    expect(screen.queryByRole('dialog', { name: 'Get Started' })).toBeNull();
  });

  it('ends as skipped, kept taken, and is ticked in the list after', async () => {
    mount();
    openList();
    await pick(/Ask Your Knowledgebase/);
    act(() => stage.engine!.skip());
    await flush();
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'AskTourSkipped');
    expect(stage.engine!.active).toBe(false);
    openList();
    expect(screen.getByRole('button', { name: /Ask Your Knowledgebase/ }).dataset.taken).toBe(
      'true',
    );
    // Taken tours stay on the list, to run again.
    await pick(/Ask Your Knowledgebase/);
    expect(stage.engine!.active).toBe(true);
    expect(writeUserPreferences).toHaveBeenCalledOnce();
  });

  it('counts each step viewed under its tour', () => {
    expect(knowledgeTourStepType('trust', 'verify')).toBe('KnowledgeTourStepTrustVerify');
    expect(knowledgeTourStepType('share', 'done')).toBe('KnowledgeTourStepWorkTogetherDone');
    expect(knowledgeTourStepType('first-page', 'new-page')).toBe(
      'KnowledgeTourStepFirstPageNewPage',
    );
  });

  it('never starts beside another tour', async () => {
    mount();
    openList();
    act(() => setActiveTour('show-me', true));
    await pick(/Trust a Page/);
    expect(stage.engine!.active).toBe(false);
    act(() => setActiveTour('show-me', false));
  });

  it('ends when the knowledgebase changes under it', async () => {
    const view = mount();
    openList();
    await pick(/Organise Your Knowledgebase/);
    expect(stage.engine!.active).toBe(true);
    ctx.current = { ...ctx.current, documentId: 'kb2' };
    view.rerender(<KnowledgeToursHost />);
    await flush();
    expect(stage.engine!.active).toBe(false);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'OrganiseTourSkipped');
  });
});

describe('Settings rerun', () => {
  it('starts one tour newly on, and opens the list for several', async () => {
    as('Editor', { userPreferences: { knowledgeTours: ['trust'] } });
    mount();
    await flush();
    act(() => requestKnowledgeToursRelaunch(['trust']));
    await flush();
    expect(stage.engine!.active).toBe(true);
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'TrustTour');
    act(() => stage.engine!.stop());
    act(() => requestKnowledgeToursRelaunch(['trust', 'ask']));
    await flush();
    expect(screen.getByRole('dialog', { name: 'Get Started' })).toBeTruthy();
  });

  it('ignores a tour this person is not offered', async () => {
    as('Viewer');
    mount();
    await flush();
    act(() => requestKnowledgeToursRelaunch(['first-page']));
    await flush();
    expect(stage.engine!.active).toBe(false);
  });
});
