import { tourTrackSeen, withTracksAnswered } from '@liveworkspace/workbench/lib/tour-tracks';
import type { HelpArticleKey } from './help-articles';
import { currentKnowledgeView } from './knowledge-ask/knowledge-view';
import type { UserPreferences } from './user-preferences';

// The Get Started tours (docs/specs/007-editor/knowledge-tours.md; blueprint knowledge-tours.md): their ids in the
// Get Started list's order, each step by id with what it needs to be shown (the step plan), the taken record and the
// Settings rerun. Small and copy-free beyond the list's own rows, so the editor can say which tours are on offer, and
// how long each is, without loading the steps' words (components/tour/knowledge-tour-steps.ts).

export const KNOWLEDGE_TOURS = [
  'first-page',
  'organise',
  'trust',
  'ask',
  'connect',
  'share',
] as const;
export type KnowledgeTourId = (typeof KNOWLEDGE_TOURS)[number];

/** What a step needs of the person to be shown (spec "Only what is there"). */
export type TourNeed = 'write' | 'share' | 'signedIn' | 'online' | 'desktop';

/** Who is looking: an Editor or a Participant writes, an Editor shares. */
export type TourWho = {
  write: boolean;
  share: boolean;
  signedIn: boolean;
  online: boolean;
  phone: boolean;
};

export type PlannedStep = {
  id: string;
  needs: readonly TourNeed[];
  // In the page tree: a phone's tree is in its Pages sheet, not on screen as the tour starts, so `present` is not
  // judged there.
  tree?: true;
  // A control on the Pages view that may simply not be drawn here (an empty Trash, a top-level page's breadcrumb, a
  // page nobody has saved): the step is left out when the tour starts on Pages on a computer and it is not on screen.
  present?: string;
};

// A one-step tour is a tooltip, not a tour (blueprint D112).
export const MIN_TOUR_STEPS = 2;

const ASK: readonly TourNeed[] = ['signedIn', 'online'];
const CONNECT: readonly TourNeed[] = ['signedIn', 'online', 'desktop'];

/** Each tour's steps, in order, the closing card left out (it is always shown). The steps on the page come before
 *  those in the page tree, so a phone's Pages sheet opens once and stays until the tour ends. */
export const KNOWLEDGE_TOUR_PLAN: Record<KnowledgeTourId, readonly PlannedStep[]> = {
  'first-page': [
    { id: 'edit', needs: ['write'] },
    { id: 'blocks', needs: ['write'] },
    { id: 'new-page', needs: ['write'] },
    // A touch screen's row has only its ⋯ (Add Subpage is in that menu): the + is a computer's.
    { id: 'add-subpage', needs: ['write', 'desktop'] },
  ],
  organise: [
    { id: 'breadcrumb', needs: [], present: '[data-page-breadcrumb]' },
    { id: 'tree', needs: [] },
    { id: 'options', needs: ['write'] },
    { id: 'search', needs: [] },
    {
      id: 'trash',
      needs: ['write'],
      present: '[data-page-trash-row], [data-page-trash-rail]',
      tree: true,
    },
  ],
  trust: [
    { id: 'meta', needs: [] },
    { id: 'verify', needs: ['write', 'signedIn', 'online'] },
    { id: 'health', needs: [] },
    { id: 'approval', needs: ['write', 'signedIn', 'online'] },
  ],
  ask: [
    { id: 'tab', needs: ASK },
    { id: 'composer', needs: ASK },
    { id: 'questions', needs: ASK },
    { id: 'ai', needs: ASK },
  ],
  connect: [
    { id: 'tab', needs: CONNECT },
    { id: 'apps', needs: CONNECT },
    { id: 'steps', needs: CONNECT },
    { id: 'access', needs: CONNECT },
    { id: 'status', needs: CONNECT },
  ],
  share: [
    { id: 'share', needs: ['share'] },
    { id: 'makers', needs: ['online'], present: '[data-page-makers]' },
    { id: 'reactions', needs: ['signedIn', 'online'] },
    { id: 'comments', needs: ['write', 'online'] },
  ],
};

/** The words of a tour's Get Started row, its cards' eyebrow, its help article and its telemetry token. */
export const KNOWLEDGE_TOUR_COPY: Record<
  KnowledgeTourId,
  { title: string; line: string; help: HelpArticleKey; token: string }
> = {
  'first-page': {
    title: 'Your First Page',
    line: 'Add a page, open it to write, and the blocks you can type.',
    help: 'firstPage',
    token: 'FirstPage',
  },
  organise: {
    title: 'Organise Your Knowledgebase',
    line: 'The page tree, a page’s options, search and the breadcrumb.',
    help: 'pageTree',
    token: 'Organise',
  },
  trust: {
    title: 'Trust a Page',
    line: 'Who wrote a page, verifying it, and its Page Health.',
    help: 'verifying',
    token: 'Trust',
  },
  ask: {
    title: 'Ask Your Knowledgebase',
    line: 'Ask a question, get answers with sources, and see AI Knowledge.',
    help: 'ask',
    token: 'Ask',
  },
  connect: {
    title: 'Connect an AI Agent',
    line: 'Connect Claude, ChatGPT or Cursor so it can read these pages.',
    help: 'connectAiTool',
    token: 'Connect',
  },
  share: {
    title: 'Share and Work Together',
    line: 'Share, see who wrote a page, react and comment.',
    help: 'sharing',
    token: 'WorkTogether',
  },
};

function meets(need: TourNeed, who: TourWho): boolean {
  if (need === 'write') return who.write;
  if (need === 'share') return who.share;
  if (need === 'signedIn') return who.signedIn;
  if (need === 'online') return who.online;
  return !who.phone;
}

/** A tour's steps this person has the controls for. */
export function plannedFor(id: KnowledgeTourId, who: TourWho): readonly PlannedStep[] {
  return KNOWLEDGE_TOUR_PLAN[id].filter((s) => s.needs.every((n) => meets(n, who)));
}

/**
 * The steps a run shows: the plan for `who`, less a step whose control is not drawn as the tour starts. That is judged
 * only with the Pages view showing (`judge`), as elsewhere the page is not on screen yet, and never for a tree step on
 * a phone, whose tree is in its sheet: such a step is left to the engine, which skips it if it never appears.
 */
export function shownPlan(
  id: KnowledgeTourId,
  who: TourWho,
  judge: boolean,
  onScreen: (selector: string) => boolean,
): readonly PlannedStep[] {
  return plannedFor(id, who).filter(
    (s) => !judge || !s.present || (who.phone && s.tree) || onScreen(s.present),
  );
}

/** Whether a run starting now may judge what is on screen: the Pages view is showing (shownPlan). */
export const judgesOnScreen = (_who: TourWho): boolean => currentKnowledgeView() === 'pages';

/** The tours on offer to this person: each with at least MIN_TOUR_STEPS steps they can see. */
export function offeredTours(who: TourWho): KnowledgeTourId[] {
  return KNOWLEDGE_TOURS.filter((id) => plannedFor(id, who).length >= MIN_TOUR_STEPS);
}

/** Whether `id` has been taken: started, then finished or skipped (spec "Taken, on every device"). */
export function knowledgeTourTaken(
  prefs: UserPreferences | null | undefined,
  id: KnowledgeTourId,
): boolean {
  return tourTrackSeen(prefs?.knowledgeTours, prefs?.knowledgeToursSeen, id);
}

/** The preferences with `id` taken. */
export function markKnowledgeTourTaken(
  prefs: UserPreferences,
  id: KnowledgeTourId,
): UserPreferences {
  return { ...prefs, knowledgeTours: withTracksAnswered(prefs.knowledgeTours, [id]) };
}

/** The preferences with `id` offered again, every other tour kept as it was (the all-taken flag becomes the list). */
export function offerKnowledgeTourAgain(
  prefs: UserPreferences,
  id: KnowledgeTourId,
): UserPreferences {
  const others = prefs.knowledgeToursSeen === true ? KNOWLEDGE_TOURS.filter((t) => t !== id) : [];
  const { knowledgeToursSeen: _all, ...rest } = prefs;
  const answered = (prefs.knowledgeTours ?? []).filter((t) => t !== id);
  return { ...rest, knowledgeTours: withTracksAnswered(answered, others) };
}

// The Settings rerun (spec "Settings"): closing Settings with tours newly switched on asks the host to run them. A
// window event keeps the dialog apart from the host, as every editor's tour relaunch does.
export const KNOWLEDGE_TOURS_RELAUNCH_EVENT = 'liveknowledge:knowledge-tours-relaunch';

export type KnowledgeToursRelaunch = { ids: KnowledgeTourId[] };

/** The tours untaken in `now` that were taken in `opened`, in list order. */
export function newlyOffered(opened: UserPreferences, now: UserPreferences): KnowledgeTourId[] {
  return KNOWLEDGE_TOURS.filter(
    (id) => knowledgeTourTaken(opened, id) && !knowledgeTourTaken(now, id),
  );
}

export function requestKnowledgeToursRelaunch(ids: KnowledgeTourId[]): void {
  if (typeof window === 'undefined' || ids.length === 0) return;
  window.dispatchEvent(
    new CustomEvent<KnowledgeToursRelaunch>(KNOWLEDGE_TOURS_RELAUNCH_EVENT, { detail: { ids } }),
  );
}
