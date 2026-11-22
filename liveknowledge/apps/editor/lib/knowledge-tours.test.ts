// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  KNOWLEDGE_TOURS,
  KNOWLEDGE_TOURS_RELAUNCH_EVENT,
  KNOWLEDGE_TOUR_PLAN,
  MIN_TOUR_STEPS,
  judgesOnScreen,
  knowledgeTourLine,
  knowledgeTourTaken,
  markKnowledgeTourTaken,
  newlyOffered,
  offerKnowledgeTourAgain,
  offeredTours,
  plannedFor,
  requestKnowledgeToursRelaunch,
  shownPlan,
  type TourWho,
} from './knowledge-tours';
import { pageTrashStore } from './knowledge/page-trash-store';

// docs/specs/007-editor/knowledge-tours.md "Only what is there", "Taken, on every device" and "Settings".
const EDITOR: TourWho = { write: true, share: true, signedIn: true, online: true, phone: false };
const PARTICIPANT: TourWho = { ...EDITOR, share: false };
const VIEWER: TourWho = { ...EDITOR, write: false, share: false };
const GUEST_VIEWER: TourWho = { ...VIEWER, signedIn: false };

const ids = (id: (typeof KNOWLEDGE_TOURS)[number], who: TourWho) =>
  plannedFor(id, who).map((s) => s.id);

afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

describe('the step plan', () => {
  it('gives every tour 3 to 6 steps, each id once', () => {
    for (const id of KNOWLEDGE_TOURS) {
      const steps = KNOWLEDGE_TOUR_PLAN[id].map((s) => s.id);
      expect(steps.length, id).toBeGreaterThanOrEqual(3);
      expect(steps.length, id).toBeLessThanOrEqual(6);
      expect(new Set(steps).size, id).toBe(steps.length);
    }
  });

  it('offers an Editor every tour, every step', () => {
    expect(offeredTours(EDITOR)).toEqual([...KNOWLEDGE_TOURS]);
    for (const id of KNOWLEDGE_TOURS)
      expect(plannedFor(id, EDITOR)).toEqual(KNOWLEDGE_TOUR_PLAN[id]);
  });

  it('leaves Share out for a Participant, who still works together', () => {
    expect(offeredTours(PARTICIPANT)).toEqual([...KNOWLEDGE_TOURS]);
    expect(ids('share', PARTICIPANT)).toEqual(['makers', 'reactions', 'comments']);
    expect(ids('trust', PARTICIPANT)).toEqual(['meta', 'verify', 'health', 'approval']);
  });

  it('shows a Viewer only what a reader has', () => {
    expect(offeredTours(VIEWER)).toEqual(['organise', 'trust', 'ask', 'connect', 'share']);
    expect(ids('first-page', VIEWER)).toEqual([]);
    expect(ids('organise', VIEWER)).toEqual(['breadcrumb', 'tree', 'search']);
    expect(ids('trust', VIEWER)).toEqual(['meta', 'health']);
    expect(ids('share', VIEWER)).toEqual(['makers', 'reactions']);
  });

  it('keeps Ask and Connect for the signed in, and a one-step tour off the list', () => {
    expect(offeredTours(GUEST_VIEWER)).toEqual(['organise', 'trust']);
    expect(ids('trust', { ...EDITOR, signedIn: false })).toEqual(['meta', 'health']);
    expect(ids('share', GUEST_VIEWER)).toHaveLength(1);
    expect(MIN_TOUR_STEPS).toBe(2);
  });

  it('drops what needs the server Offline, and Connect on a phone', () => {
    const offline = { ...EDITOR, online: false };
    expect(offeredTours(offline)).toEqual(['first-page', 'organise', 'trust']);
    expect(ids('trust', offline)).toEqual(['meta', 'health']);
    expect(ids('share', offline)).toEqual(['share']);
    expect(offeredTours({ ...EDITOR, phone: true })).not.toContain('connect');
  });

  it('leaves out a control not drawn as a tour starts on Pages, a phone’s tree steps aside', () => {
    expect(judgesOnScreen(EDITOR)).toBe(true);
    const phone = { ...EDITOR, phone: true };
    // An empty Trash draws no row in the shut Pages sheet: the step is left out, so "N steps" is what runs.
    expect(shownPlan('organise', phone, true, () => false).map((s) => s.id)).toEqual([
      'tree',
      'options',
      'search',
    ]);
    expect(ids('first-page', phone)).toEqual(['edit', 'blocks', 'new-page']);
    window.history.replaceState(null, '', '/?view=ask');
    expect(judgesOnScreen(EDITOR)).toBe(false);
    const none = () => false;
    expect(shownPlan('organise', EDITOR, true, none).map((s) => s.id)).toEqual([
      'tree',
      'options',
      'search',
    ]);
    expect(shownPlan('organise', EDITOR, false, none)).toEqual(plannedFor('organise', EDITOR));
    expect(shownPlan('share', EDITOR, true, none).map((s) => s.id)).toEqual([
      'share',
      'reactions',
      'comments',
    ]);
  });
});

describe('what a phone’s shut Pages sheet would draw', () => {
  const phone: TourWho = { ...EDITOR, phone: true };
  const held = (pages: number) =>
    vi.spyOn(pageTrashStore, 'get').mockReturnValue({
      ...pageTrashStore.get(),
      pages: Array.from({ length: pages }, (_, i) => ({
        id: `p${i}`,
        name: `Page ${i}`,
        trashedAt: 0,
        trashedBy: null,
        subpages: [],
      })),
    });

  it('keeps the Trash step while the Trash holds pages, on any view', () => {
    held(2);
    expect(shownPlan('organise', phone, true, () => false).map((s) => s.id)).toContain('trash');
    expect(shownPlan('organise', phone, false, () => false).map((s) => s.id)).toContain('trash');
  });

  it('leaves it out with the Trash empty, on any view', () => {
    held(0);
    expect(shownPlan('organise', phone, true, () => true).map((s) => s.id)).not.toContain('trash');
    expect(shownPlan('organise', phone, false, () => true).map((s) => s.id)).not.toContain('trash');
  });
});

describe('a row’s line', () => {
  it('never names a writer’s step to a reader', () => {
    for (const reader of [VIEWER, GUEST_VIEWER]) {
      expect(knowledgeTourLine('organise', reader)).toBe(
        'The page tree, search and the breadcrumb.',
      );
      expect(knowledgeTourLine('trust', reader)).toBe('Who wrote a page, and its Page Health.');
      expect(knowledgeTourLine('share', reader)).toBe('See who wrote a page, and react to it.');
      for (const id of KNOWLEDGE_TOURS) {
        expect(knowledgeTourLine(id, reader), id).not.toMatch(/options|verifying|share|comment/i);
      }
    }
  });

  it('keeps the full line for a writer, less Share for a Participant', () => {
    for (const writer of [EDITOR, PARTICIPANT]) {
      expect(knowledgeTourLine('organise', writer)).toMatch(/a page’s options/);
      expect(knowledgeTourLine('trust', writer)).toMatch(/verifying it/);
    }
    expect(knowledgeTourLine('share', EDITOR)).toBe(
      'Share, see who wrote a page, react and comment.',
    );
    expect(knowledgeTourLine('share', PARTICIPANT)).toBe(
      'See who wrote a page, react and comment.',
    );
  });
});

describe('the taken record', () => {
  it('takes one tour, then offers it again', () => {
    const taken = markKnowledgeTourTaken({}, 'trust');
    expect(taken).toEqual({ knowledgeTours: ['trust'] });
    expect(knowledgeTourTaken(taken, 'trust')).toBe(true);
    expect(knowledgeTourTaken(taken, 'ask')).toBe(false);
    expect(markKnowledgeTourTaken(taken, 'trust')).toEqual(taken);
    expect(knowledgeTourTaken(offerKnowledgeTourAgain(taken, 'trust'), 'trust')).toBe(false);
    expect(knowledgeTourTaken(null, 'trust')).toBe(false);
  });

  it('turns the all-taken flag into the list when one tour is offered again', () => {
    const again = offerKnowledgeTourAgain({ knowledgeToursSeen: true }, 'ask');
    expect(again.knowledgeToursSeen).toBeUndefined();
    for (const id of KNOWLEDGE_TOURS) expect(knowledgeTourTaken(again, id), id).toBe(id !== 'ask');
  });

  it('names the tours newly offered since Settings opened, in list order', () => {
    const all = { knowledgeToursSeen: true };
    expect(newlyOffered(all, all)).toEqual([]);
    expect(newlyOffered(all, offerKnowledgeTourAgain(all, 'share'))).toEqual(['share']);
    expect(newlyOffered(all, {})).toEqual([...KNOWLEDGE_TOURS]);
    expect(newlyOffered({}, all)).toEqual([]);
  });

  it('asks the host to rerun them, and stays quiet with none', () => {
    const heard = vi.fn();
    window.addEventListener(KNOWLEDGE_TOURS_RELAUNCH_EVENT, heard);
    requestKnowledgeToursRelaunch([]);
    expect(heard).not.toHaveBeenCalled();
    requestKnowledgeToursRelaunch(['trust', 'ask']);
    expect((heard.mock.calls[0]![0] as CustomEvent).detail).toEqual({ ids: ['trust', 'ask'] });
    window.removeEventListener(KNOWLEDGE_TOURS_RELAUNCH_EVENT, heard);
  });
});
