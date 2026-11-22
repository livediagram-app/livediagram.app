// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  KNOWLEDGE_TOURS,
  KNOWLEDGE_TOURS_RELAUNCH_EVENT,
  KNOWLEDGE_TOUR_PLAN,
  MIN_TOUR_STEPS,
  judgesOnScreen,
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

// docs/specs/007-editor/knowledge-tours.md "Only what is there", "Taken, on every device" and "Settings".
const EDITOR: TourWho = { write: true, share: true, signedIn: true, online: true, phone: false };
const PARTICIPANT: TourWho = { ...EDITOR, share: false };
const VIEWER: TourWho = { ...EDITOR, write: false, share: false };
const GUEST_VIEWER: TourWho = { ...VIEWER, signedIn: false };

const ids = (id: (typeof KNOWLEDGE_TOURS)[number], who: TourWho) =>
  plannedFor(id, who).map((s) => s.id);

afterEach(() => window.history.replaceState(null, '', '/'));

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

  it('leaves out a control not drawn as a tour starts on Pages, on a computer only', () => {
    expect(judgesOnScreen(EDITOR)).toBe(true);
    expect(judgesOnScreen({ ...EDITOR, phone: true })).toBe(false);
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
