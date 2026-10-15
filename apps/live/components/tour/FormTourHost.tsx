'use client';

// Orchestrates the Forms tour (docs/specs/030-forms/forms.md "The Forms tour"). Mounted in EditorView once a Form tab
// has been open; renders nothing until an Editor who has not seen it has a Form tab open, no other tour is on screen
// and the settle delay has passed, or Show Me Around in the form's cog asks for a rerun. Its destination step opens the board
// or sheet the form feeds and comes back to the form after; any other move away ends it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { readForm, questionsOf } from '@livediagram/forms';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useSelectTab } from '@/app/document/[id]/useSelectTab';
import { useLatest } from '@/hooks/ui/useLatest';
import { debugLog } from '@/lib/debug-log';
import { FORM_TOUR_RELAUNCH_EVENT } from '@/lib/form-tour';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { useStartPanelOpen } from '@/components/start/start-panel-open';
import { FormStarterPicture } from '@/components/forms/FormStarterPicture';
import { formTourSteps, formTourStepTelemetryType, type FormTourApi } from './form-tour-steps';
import { TourStage } from './TourStage';
import { useTourEngine, type TourOutcome } from './useTourEngine';

const OFFER_DELAY_MS = 800;

const FORM_TOUR_COPY = {
  welcomeEyebrow: 'Forms tour',
  helpHref: '/help/canvas/plan-mode/forms/',
  finish: 'Start Building',
};

// The welcome card's picture: a form in the art's light colours.
const ART_PALETTE = {
  surface: '#ffffff',
  border: '#e2e8f0',
  column: '#f1f5f9',
  card: '#ffffff',
  cardBorder: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  warning: '#b45309',
  warningBg: '#fef3c7',
  focus: '#0284c7',
};

export function FormTourHost() {
  const ctx = useEditorContext();
  const selectTab = useSelectTab();
  const tab = ctx.activeTab;
  const onForm = tab.kind === 'form';
  const form = onForm ? readForm(tab.form) : null;
  const destTabId = form?.sheet?.tabId ?? form?.destination?.tabId ?? null;
  const destKind: 'board' | 'sheet' | null = !destTabId ? null : form?.sheet ? 'sheet' : 'board';
  const hasQuestions = !!form && questionsOf(form).length > 0;

  // The Form tab the tour began on: the destination step leaves it and comes back.
  const formTabRef = useRef<string | null>(null);
  const apiRef = useLatest<FormTourApi>({
    destination: () => (destTabId && destKind ? { tabId: destTabId, kind: destKind } : null),
    openTab: (id) => selectTab(id),
    backToForm: () => {
      if (formTabRef.current && ctx.activeTab.id !== formTabRef.current)
        selectTab(formTabRef.current);
    },
  });

  // The steps fixed as the tour starts: the form as it was when offered.
  const [shape, setShape] = useState({ destination: destKind, hasQuestions });
  const steps = useMemo(() => formTourSteps(shape), [shape]);
  const engine = useTourEngine<FormTourApi>({
    steps,
    apiRef,
    onStepView: (step) => track('UI', 'View', formTourStepTelemetryType(step.id)),
    onStart: () => track('UI', 'Started', 'FormTour'),
    onFinish: (outcome) => endTour(outcome),
  });
  const { active } = engine;

  const shown = useActiveTour();
  const otherTour = shown !== null && shown !== 'form';
  useEffect(() => {
    setActiveTour('form', active);
  }, [active]);

  const seen = ctx.userPreferences?.formTourSeen === true;
  const startPanelOpen = useStartPanelOpen();
  const canWork =
    ctx.hydrated &&
    ctx.prefsSettled &&
    !ctx.anyWelcomeOpen &&
    !startPanelOpen &&
    !ctx.isReadOnly &&
    !ctx.embedMode &&
    tab.locked !== true;

  // Armed on opening a Form tab, and by Show Me Around; disarmed once offered or answered.
  const [armed, setArmed] = useState(false);
  // Show Me Around asked for it: offered at once, even to someone who has seen it.
  const [rerun, setRerun] = useState(false);
  const [wasOn, setWasOn] = useState(false);
  if (onForm !== wasOn) {
    setWasOn(onForm);
    if (onForm) setArmed(true);
  }
  if (armed && seen && !rerun) setArmed(false);

  const endTour = (outcome: TourOutcome) => {
    apiRef.current.backToForm();
    formTabRef.current = null;
    const next = rebaseUserPreferences(ctx.userPreferences, {
      ...ctx.userPreferences,
      formTourSeen: true,
    });
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
    debugLog('[form-tour] end', { outcome });
    if (outcome === 'declined') track('UI', 'Closed', 'FormTourOffer');
    else track('UI', 'Ended', outcome === 'completed' ? 'FormTourCompleted' : 'FormTourSkipped');
  };
  const endTourRef = useLatest(endTour);
  const engineRef = useLatest(engine);

  // The offer: armed, on a Form tab, usable, not seen (a rerun clears that), and no other tour on screen.
  useEffect(() => {
    if (!armed || active || (seen && !rerun)) return;
    if (!onForm || !canWork || otherTour) return;
    const t = setTimeout(
      () => {
        setArmed(false);
        setRerun(false);
        formTabRef.current = tab.id;
        setShape({ destination: destKind, hasQuestions });
        debugLog('[form-tour] offer');
        engineRef.current.start();
        track('UI', 'Opened', 'FormTourOffer');
      },
      rerun ? 0 : OFFER_DELAY_MS,
    );
    return () => clearTimeout(t);
  }, [
    armed,
    active,
    seen,
    rerun,
    onForm,
    canWork,
    otherTour,
    engineRef,
    tab.id,
    destKind,
    hasQuestions,
  ]);

  // Show Me Around: offers again at once.
  useEffect(() => {
    const onRelaunch = () => {
      setRerun(true);
      setArmed(true);
    };
    window.addEventListener(FORM_TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(FORM_TOUR_RELAUNCH_EVENT, onRelaunch);
  }, []);

  // Ends as skipped when it can no longer run: edit rights gone, or a tab opened that is neither the form nor where
  // its responses go.
  useEffect(() => {
    if (!active) return;
    const here = tab.id;
    if (!canWork || (here !== formTabRef.current && here !== destTabId)) {
      engineRef.current.stop();
      endTourRef.current('skipped');
    }
  }, [active, canWork, tab.id, destTabId, engineRef, endTourRef]);

  useEffect(() => () => setActiveTour('form', false), []);

  return (
    <TourStage
      engine={engine}
      ariaPrefix="Forms tour"
      copy={FORM_TOUR_COPY}
      welcomeArt={<FormStarterPicture starter="feedback" palette={ART_PALETTE} />}
    />
  );
}
