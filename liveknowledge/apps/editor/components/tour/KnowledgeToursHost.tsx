'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { lucideGlyph } from '@liveworkspace/ui';
import {
  lucideFilePlus,
  lucideListTree,
  lucidePlug,
  lucideShieldCheck,
  lucideSparkles,
  lucideUsers,
} from '@liveworkspace/icons/lucide';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { setActiveTour, useActiveTour } from '@liveworkspace/workbench/lib/tour-active';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { stepTelemetryType } from '@liveworkspace/workbench/components/tour/tour-step';
import { isOnScreen } from '@liveworkspace/workbench/components/tour/tour-dom';
import {
  useTourEngine,
  type TourOutcome,
} from '@liveworkspace/workbench/components/tour/useTourEngine';
import {
  TOUR_OFFER_RANK,
  useOfferTour,
  stepsLength,
} from '@liveworkspace/workbench/components/tour/tour-offer';
import {
  GetStartedPopover,
  getStartedAnchor,
} from '@liveworkspace/workbench/components/tour/GetStartedPopover';
import {
  useEditorChrome,
  useEditorChromeStore,
  type EditorContextValue,
} from '@/app/document/[id]/EditorContext';
import { sameSlice } from '@/app/document/[id]/editor-chrome-equal';
import { useKnowledgeViewsOffered } from '@/components/ask/useKnowledgeViewsOffered';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { helpArticleHref } from '@/lib/help-articles';
import {
  KNOWLEDGE_TOUR_COPY,
  KNOWLEDGE_TOURS_RELAUNCH_EVENT,
  knowledgeTourTaken,
  markKnowledgeTourTaken,
  judgesOnScreen,
  offeredTours,
  shownPlan,
  type KnowledgeTourId,
  type KnowledgeToursRelaunch,
  type TourWho,
} from '@/lib/knowledge-tours';
import { track } from '@/lib/telemetry';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { createKnowledgeTourApi, type KnowledgeTourApi } from './knowledge-tour-dom';
import type { KnowledgeTourStep } from './knowledge-tour-steps';
import { TourStage } from './TourStage';

const FirstPageIcon = lucideGlyph(lucideFilePlus, 18);
const OrganiseIcon = lucideGlyph(lucideListTree, 18);
const TrustIcon = lucideGlyph(lucideShieldCheck, 18);
const AskIcon = lucideGlyph(lucideSparkles, 18);
const ConnectIcon = lucideGlyph(lucidePlug, 18);
const ShareIcon = lucideGlyph(lucideUsers, 18);

// Each tour's glyph on its Get Started row.
const ICONS: Record<KnowledgeTourId, ReactNode> = {
  'first-page': <FirstPageIcon />,
  organise: <OrganiseIcon />,
  trust: <TrustIcon />,
  ask: <AskIcon />,
  connect: <ConnectIcon />,
  share: <ShareIcon />,
};

// Each tour's own literal events, so the dashboard's emitter scan reads every one (show-me.md "Code").
function trackStarted(id: KnowledgeTourId): void {
  if (id === 'first-page') track('UI', 'Started', 'FirstPageTour');
  else if (id === 'organise') track('UI', 'Started', 'OrganiseTour');
  else if (id === 'trust') track('UI', 'Started', 'TrustTour');
  else if (id === 'ask') track('UI', 'Started', 'AskTour');
  else if (id === 'connect') track('UI', 'Started', 'ConnectTour');
  else track('UI', 'Started', 'WorkTogetherTour');
}

function trackEnded(id: KnowledgeTourId, done: boolean): void {
  if (id === 'first-page')
    track('UI', 'Ended', done ? 'FirstPageTourCompleted' : 'FirstPageTourSkipped');
  else if (id === 'organise')
    track('UI', 'Ended', done ? 'OrganiseTourCompleted' : 'OrganiseTourSkipped');
  else if (id === 'trust') track('UI', 'Ended', done ? 'TrustTourCompleted' : 'TrustTourSkipped');
  else if (id === 'ask') track('UI', 'Ended', done ? 'AskTourCompleted' : 'AskTourSkipped');
  else if (id === 'connect')
    track('UI', 'Ended', done ? 'ConnectTourCompleted' : 'ConnectTourSkipped');
  else track('UI', 'Ended', done ? 'WorkTogetherTourCompleted' : 'WorkTogetherTourSkipped');
}

/** A step view's telemetry `type`: ('trust', 'verify') → 'KnowledgeTourStepTrustVerify'. */
export function knowledgeTourStepType(id: KnowledgeTourId, stepId: string): string {
  return stepTelemetryType('KnowledgeTourStep', `${KNOWLEDGE_TOUR_COPY[id].token}-${stepId}`);
}

// What the tours read of the editor, a slice of its chrome store: no writing, so a typing commit renders nothing here
// (docs/specs/007-editor/blueprints/typing.md). Its handlers read the store when they run.
const toursSlice = (s: EditorContextValue) => ({
  write: s.can.editPages && !s.isStructureReadOnly,
  share: s.can.manageKnowledgebase,
  signedIn: s.accountUserId != null,
  documentId: s.documentId,
  userPreferences: s.userPreferences,
});

// The Get Started tours (docs/specs/007-editor/knowledge-tours.md): offered on the footer's Get Started button while
// any tour on offer is untaken, the list of them opened from it, the one picked run on the shared engine, and the
// taken record kept. Mounted once with the editor (EditorTours), so leaving mid-tour still tidies up. Nothing starts
// on its own.
export function KnowledgeToursHost() {
  const chrome = useEditorChromeStore();
  const ctx = useEditorChrome(toursSlice, sameSlice);
  const usable = useKnowledgeViewsOffered();
  const online = !useIsOfflineDocument(ctx.documentId);
  const phone = useIsMobileViewport();
  const who = useMemo<TourWho>(
    () => ({ write: ctx.write, share: ctx.share, signedIn: ctx.signedIn, online, phone }),
    [ctx.write, ctx.share, ctx.signedIn, online, phone],
  );
  const offered = useMemo(() => (usable ? offeredTours(who) : []), [usable, who]);
  const prefs = ctx.userPreferences;

  const [subject, setSubject] = useState<KnowledgeTourId>('first-page');
  // The tour running, read by the engine's callbacks: the start lands in the same tick as the pick, before a render.
  const subjectRef = useRef<KnowledgeTourId>('first-page');
  const [steps, setSteps] = useState<KnowledgeTourStep[]>([]);
  // The Get Started list: the button it hangs from and each tour's length, both read as it opens (null: closed).
  const [list, setList] = useState<{ anchor: HTMLElement; lengths: Record<string, string> } | null>(
    null,
  );
  // One api a run: it remembers what the run opened, so tidy puts back exactly that.
  const apiRef = useRef<KnowledgeTourApi>(createKnowledgeTourApi());

  const engine = useTourEngine<KnowledgeTourApi>({
    steps,
    apiRef,
    onStepView: (step) => track('UI', 'View', knowledgeTourStepType(subjectRef.current, step.id)),
    onStart: () => trackStarted(subjectRef.current),
    onFinish: (outcome) => end(outcome),
  });
  const { active } = engine;

  // One tour at a time: published while on screen; nothing starts while another is. The tours hold the shared slot's
  // mode-tour place ('pages'), the one every editor's own tour holds, so no package change is needed for them.
  const shown = useActiveTour();
  const otherTour = shown !== null && shown !== 'pages';
  useEffect(() => {
    setActiveTour('pages', active);
  }, [active]);
  useEffect(() => () => setActiveTour('pages', false), []);

  // Taken onto the freshest preferences, not this render's: the whole blob is written.
  const markTaken = (id: KnowledgeTourId) => {
    const now = chrome.get();
    if (knowledgeTourTaken(now.userPreferences, id)) return;
    const next = rebaseUserPreferences(
      now.userPreferences,
      markKnowledgeTourTaken(now.userPreferences, id),
    );
    now.setUserPreferences(next);
    now.writeUserPreferences(next, now.selfParticipant?.id ?? null);
  };

  const end = (outcome: TourOutcome) => {
    const id = subjectRef.current;
    debugLog('[knowledge-tours] end', { id, outcome });
    trackEnded(id, outcome === 'completed');
    apiRef.current.tidy();
  };

  const engineRef = useLatest(engine);
  const whoRef = useLatest(who);
  const offeredRef = useLatest(offered);
  const loadingRef = useRef(false);
  const begin = (id: KnowledgeTourId) => {
    if (engineRef.current.active || otherTour || loadingRef.current) return;
    loadingRef.current = true;
    setList(null);
    void import('./knowledge-tour-steps')
      .then(({ knowledgeTourSteps }) => {
        const run = createKnowledgeTourApi();
        debugLog('[knowledge-tours] start', { id });
        apiRef.current = run;
        subjectRef.current = id;
        setSubject(id);
        setSteps(knowledgeTourSteps(id, whoRef.current));
        engineRef.current.start();
        // Taken as it starts, so a reload mid-tour does not put it back on the button.
        markTaken(id);
      })
      .catch((error: unknown) => debugLog('[knowledge-tours] load failed', { id, error }))
      .finally(() => {
        loadingRef.current = false;
      });
  };

  const taken = (id: KnowledgeTourId) => knowledgeTourTaken(prefs, id);
  const allTaken = offered.every(taken);
  useOfferTour(
    'knowledge',
    offered.length > 0
      ? {
          name: 'Knowledgebase',
          label: 'Knowledgebase Tours',
          rank: TOUR_OFFER_RANK.mode,
          ownPanel: true,
          seen: allTaken,
          start: () => {
            if (engineRef.current.active || otherTour) return;
            if (list) setList(null);
            else openList();
          },
          onShown: () => track('UI', 'Opened', 'KnowledgeToursOffer'),
          icon: ICONS['first-page'],
        }
      : null,
  );

  // Opens the list from the button on show, each row's length counted for this person as it opens.
  const openList = () => {
    const anchor = getStartedAnchor();
    if (!anchor) return false;
    const judge = judgesOnScreen(whoRef.current);
    const lengths: Record<string, string> = {};
    for (const id of offeredRef.current) {
      const n = stepsLength(shownPlan(id, whoRef.current, judge, isOnScreen).length);
      if (n) lengths[id] = n;
    }
    track('UI', 'Opened', 'KnowledgeTours');
    setList({ anchor, lengths });
    return true;
  };
  // The list is hidden while there is nothing to list (the views went away, every tour taken) or a tour runs; a tour
  // starting closes it for good.
  const listShown = list !== null && offered.length > 0 && !allTaken && !active;

  // Settings rerun: one tour newly on starts it, several open the list (lib/knowledge-tours.ts).
  const beginRef = useLatest(begin);
  const openListRef = useLatest(openList);
  useEffect(() => {
    const onRelaunch = (event: Event) => {
      const ids = ((event as CustomEvent<KnowledgeToursRelaunch>).detail?.ids ?? []).filter((id) =>
        offeredRef.current.includes(id),
      );
      if (ids.length === 0) return;
      if (ids.length > 1 && openListRef.current()) return;
      beginRef.current(ids[0]!);
    };
    window.addEventListener(KNOWLEDGE_TOURS_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(KNOWLEDGE_TOURS_RELAUNCH_EVENT, onRelaunch);
  }, [beginRef, openListRef, offeredRef]);

  // Gone mid-tour: the views went away, another knowledgebase opened, or a writer's tour lost its edit rights. It ends
  // as skipped, putting back what it opened.
  const startedOn = useRef<{ documentId: string | null; write: boolean } | null>(null);
  useEffect(() => {
    if (!active) {
      startedOn.current = null;
      return;
    }
    startedOn.current ??= { documentId: ctx.documentId ?? null, write: who.write };
    const lostWrite = startedOn.current.write && !who.write;
    if (!usable || startedOn.current.documentId !== (ctx.documentId ?? null) || lostWrite) {
      debugLog('[knowledge-tours] gone', { id: subjectRef.current });
      engineRef.current.stop();
      end('skipped');
    }
  }, [active, usable, ctx.documentId, who.write, engineRef]);

  const copy = KNOWLEDGE_TOUR_COPY[subject];
  return (
    <>
      {listShown ? (
        <GetStartedPopover
          anchor={list.anchor}
          topics={offered.map((id) => ({
            id,
            title: KNOWLEDGE_TOUR_COPY[id].title,
            line: KNOWLEDGE_TOUR_COPY[id].line,
            icon: ICONS[id],
            ...(list.lengths[id] ? { meta: list.lengths[id] } : {}),
            taken: taken(id),
          }))}
          onPick={(id) => {
            setList(null);
            begin(id);
          }}
          onClose={() => setList(null)}
          idAttribute="data-knowledge-tour"
        />
      ) : null}
      <TourStage
        engine={engine}
        ariaPrefix={`${copy.title} tour`}
        copy={{ outroEyebrow: copy.title, helpHref: helpArticleHref(copy.help), finish: 'Done' }}
      />
    </>
  );
}
