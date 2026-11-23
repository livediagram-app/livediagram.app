// The Get Started tours' steps (docs/specs/007-editor/knowledge-tours.md "The tours"; blueprint knowledge-tours.md):
// each step's words, its anchor and what it opens. Loaded at a press, so none of this copy is in the editor's first
// load (knowledge-tours-lazy-load.test.ts). Which steps a person sees is the step plan's (lib/knowledge-tours.ts),
// filtered by who they are, then by what is on screen as the tour starts.
import type { TourStepOf } from '@liveworkspace/workbench/components/tour/tour-step';
import { opensFrom } from '@liveworkspace/workbench/components/tour/tour-open';
import { isOnScreen } from '@liveworkspace/workbench/components/tour/tour-dom';
import {
  KNOWLEDGE_TOUR_COPY,
  judgesOnScreen,
  plannedFor,
  shownPlan,
  type KnowledgeTourId,
  type PlannedStep,
  type TourWho,
} from '@/lib/knowledge-tours';
import { pick, VIEW_TAB, type KnowledgeTourApi } from './knowledge-tour-dom';

export type KnowledgeTourStep = TourStepOf<KnowledgeTourApi>;

// The open page's row in the tree: its + and ⋯ are always drawn (page-tree-row-styles ROW_CONTROLS_SHOWN).
const CURRENT_ROW = '[data-page-row][data-current]';

const onPages = (api: KnowledgeTourApi) => api.showView('pages');
const inTree = (api: KnowledgeTourApi) => {
  api.showView('pages');
  api.openTree();
};
const onView = (view: 'ask' | 'insights' | 'connect') => (api: KnowledgeTourApi) =>
  api.showView(view);
// Ask, Insights and Connect are drawn over the editor as a modal frame (KnowledgeViewFrame's modal guard). A step
// inside one is the tour's own dialog: without the modal layer the engine steps aside for it and the card vanishes.
const IN_VIEW = { layer: 'modal' } as const;

type StepBuilder = (who: TourWho) => KnowledgeTourStep;

const STEPS: Record<KnowledgeTourId, Record<string, StepBuilder>> = {
  'first-page': {
    edit: () => ({
      id: 'edit',
      title: 'Press Edit',
      body: 'Edit opens this page to write, or press E. Everyone editing shares one live draft until Save.',
      selector: () => '[data-page-edit]',
      prepare: onPages,
    }),
    blocks: () => ({
      id: 'blocks',
      title: 'Type / for Blocks',
      body: 'In the writing, type / for headings, lists, tables, pictures, charts and links to other pages.',
      // The writing's first block, its Title: the card stands under it, clear of the rest of the page.
      selector: () => '[data-article-flow] > [data-block-id]',
      prepare: onPages,
    }),
    'new-page': () => ({
      id: 'new-page',
      title: 'New Page',
      body: 'New Page adds a page to this knowledgebase, ready to name and write.',
      selector: () =>
        pick('[data-new-page]', '[data-page-tree="rail"] button[aria-label="New Page"]'),
      prepare: inTree,
    }),
    'add-subpage': () => ({
      id: 'add-subpage',
      title: 'Add a Subpage',
      body: 'The + on a page’s row adds a page inside it, so related pages stay together.',
      selector: () => `${CURRENT_ROW} [data-row-action="add"]`,
      prepare: inTree,
    }),
  },
  organise: {
    breadcrumb: () => ({
      id: 'breadcrumb',
      title: 'Where You Are',
      body: 'The breadcrumb shows the pages this one sits inside. Press one to go up.',
      selector: () => '[data-page-breadcrumb]',
      prepare: onPages,
    }),
    tree: (who) => ({
      id: 'tree',
      title: 'Your Pages',
      body: who.write
        ? 'Every page lives in the tree. Drag a page onto another to nest it, or between two to move it.'
        : 'Every page lives in the tree. Press one to open it; its arrow folds the pages inside.',
      selector: () => '[data-page-tree-list]',
      prepare: inTree,
    }),
    options: () =>
      opensFrom<KnowledgeTourApi, KnowledgeTourStep>(
        {
          id: 'options',
          title: 'Page Options',
          body: 'A page’s ⋯ menu renames, duplicates, moves or deletes it.',
          selector: () => `${CURRENT_ROW} [data-row-action="menu"]`,
          prepare: inTree,
        },
        () => `${CURRENT_ROW} [data-row-action="menu"]`,
      ),
    search: (who) => ({
      id: 'search',
      title: 'Search',
      body: who.phone
        ? 'Search finds pages and what they say, across this knowledgebase.'
        : 'Search finds pages and what they say. Cmd or Ctrl K opens it from anywhere.',
      selector: () => '[data-knowledge-search-door]',
      prepare: inTree,
    }),
    trash: () => ({
      id: 'trash',
      title: 'The Trash',
      body: 'Deleted pages wait in the Trash, ready to restore.',
      selector: () => pick('[data-page-trash-row]', '[data-page-trash-rail]'),
      prepare: inTree,
    }),
  },
  trust: {
    meta: () => ({
      id: 'meta',
      title: 'Who Wrote It',
      body: 'Under the title: who made this page, a person or an agent, whether it is verified, and its reading time.',
      selector: () => '[data-page-meta]',
      prepare: onPages,
    }),
    verify: () => ({
      id: 'verify',
      title: 'Verify',
      body: 'Verify says this page is right today. It asks first, and comes due again after the Review Period.',
      selector: () => '[data-meta-verify]',
      prepare: onPages,
    }),
    health: () => ({
      id: 'health',
      title: 'Page Health',
      body: 'How fresh the page is, who owns it, when it was verified and when it comes due for review.',
      selector: () => '[data-page-health]',
      prepare: (api) => {
        api.showView('pages');
        api.openPageInfo();
      },
    }),
    approval: () => ({
      id: 'approval',
      title: 'Request Approval',
      body: 'Ask another member to approve this page before others rely on it.',
      selector: () => '[data-request-approval]',
      prepare: (api) => {
        api.showView('pages');
        api.openPageInfo();
      },
    }),
  },
  ask: {
    tab: () => ({
      id: 'tab',
      title: 'Ask',
      body: 'Ask answers questions from your pages, numbering every source it used.',
      selector: () => VIEW_TAB('ask'),
    }),
    composer: () => ({
      id: 'composer',
      title: 'Ask a Question',
      body: 'Type a question and press Enter. A follow-up keeps the conversation going.',
      selector: () => '[data-ask-composer]',
      prepare: onView('ask'),
      ...IN_VIEW,
    }),
    questions: () => ({
      id: 'questions',
      title: 'Your Questions',
      body: 'Every question you ask here is kept, to open again.',
      selector: () => 'aside[aria-label="Your Questions"]',
      prepare: onView('ask'),
      ...IN_VIEW,
    }),
    insights: () => ({
      id: 'insights',
      title: 'Insights',
      body: 'See what agents read, questions nobody could answer, and pages that disagree.',
      selector: () => VIEW_TAB('insights'),
    }),
  },
  connect: {
    tab: () => ({
      id: 'tab',
      title: 'Connect',
      body: 'Connect Claude, ChatGPT, Cursor or another AI app so it can read this knowledgebase.',
      selector: () => VIEW_TAB('connect'),
    }),
    apps: () => ({
      id: 'apps',
      title: 'Pick Your AI App',
      body: 'Pick the app you use. The steps below follow your pick.',
      selector: () => '[data-connect-apps]',
      prepare: onView('connect'),
      ...IN_VIEW,
    }),
    steps: () => ({
      id: 'steps',
      title: 'Add liveknowledge',
      body: 'Copy the address, or press the button that opens your app’s settings.',
      selector: () => '[data-connect-app-steps]',
      prepare: onView('connect'),
      ...IN_VIEW,
    }),
    access: () => ({
      id: 'access',
      title: 'What It May Do',
      body: 'Every connection reads. Suggesting edits and writing follow your role here.',
      selector: () => '[data-connect-access]',
      prepare: onView('connect'),
      ...IN_VIEW,
    }),
    status: () => ({
      id: 'status',
      title: 'Check It Worked',
      body: 'This turns to Connected once your app reads a page. Try the prompt it gives you.',
      selector: () => '[data-connect-status]',
      prepare: onView('connect'),
      ...IN_VIEW,
    }),
  },
  share: {
    share: () => ({
      id: 'share',
      title: 'Share',
      body: 'Invite people as Editors, Participants or Viewers, or make a link to send.',
      selector: () => '[data-tour-id="share"]',
      prepare: onPages,
    }),
    makers: () => ({
      id: 'makers',
      title: 'Who Made It',
      body: 'Everyone who wrote this page, its creator first.',
      // The top row's avatars (spec "Who Made It"), not the meta row's maker pills, which carry the same mark first.
      selector: () => 'ul[data-page-makers]',
      prepare: onPages,
    }),
    reactions: () => ({
      id: 'reactions',
      title: 'Reactions',
      body: 'React to a page with any emoji. Everyone who reads it sees the count.',
      selector: () => '[data-page-reactions]',
      prepare: onPages,
    }),
    comments: () => ({
      id: 'comments',
      title: 'Comments',
      body: 'Start a thread at the foot of any page. The people in it hear about replies.',
      selector: () => '[data-page-comments]',
      prepare: onPages,
    }),
  },
};

// Each tour's closing card: its words, then Done and its help link.
export const KNOWLEDGE_TOUR_OUTROS: Record<KnowledgeTourId, { title: string; body: string }> = {
  'first-page': {
    title: 'Your Page Is Ready',
    body: 'Write something, then Save. Cancel puts the page back as it was.',
  },
  organise: {
    title: 'Everything in Its Place',
    body: 'Pages can always move later. Nest them the way your team thinks.',
  },
  trust: {
    title: 'Pages People Can Rely On',
    body: 'Verified pages are the ones Ask and agents trust first.',
  },
  ask: {
    title: 'Ask Away',
    body: 'Ask what your team keeps asking. What nobody wrote down shows in Insights.',
  },
  connect: {
    title: 'Your Agent Can Read Along',
    body: 'Ask your AI app about this knowledgebase by its name.',
  },
  share: {
    title: 'Better Together',
    body: 'Everyone editing a page works in one shared draft, live.',
  },
};

const build = (id: KnowledgeTourId, who: TourWho) => (s: PlannedStep) => {
  const make = STEPS[id][s.id];
  if (!make) throw new Error(`[knowledge-tours] no step ${id}/${s.id}`);
  return make(who);
};

/** Every step a tour can show `who`, for tests: the plan's, built. */
export function allKnowledgeTourSteps(id: KnowledgeTourId, who: TourWho): KnowledgeTourStep[] {
  return plannedFor(id, who).map(build(id, who));
}

/** The steps a run of `id` shows to `who` (lib shownPlan), then its closing card. */
export function knowledgeTourSteps(
  id: KnowledgeTourId,
  who: TourWho,
  onScreen: (selector: string) => boolean = isOnScreen,
): KnowledgeTourStep[] {
  const steps = shownPlan(id, who, judgesOnScreen(who), onScreen).map(build(id, who));
  const outro = KNOWLEDGE_TOUR_OUTROS[id];
  return [
    ...steps,
    {
      id: 'done',
      title: outro.title,
      body: outro.body,
      card: 'outro',
      // The last card asks nothing of the page: what the tour opened is put away as it shows.
      prepare: (api) => api.tidy(),
    },
  ];
}

/** A tour's cards' eyebrow and label: "Trust a Page tour". */
export const knowledgeTourEyebrow = (id: KnowledgeTourId) =>
  `${KNOWLEDGE_TOUR_COPY[id].title} tour`;
