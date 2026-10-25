'use client';

// Orchestrates the Forms tour (docs/specs/030-forms/forms.md "The Forms tour"). Mounted in EditorView once a Form tab
// has been open. While an Editor has a Form tab open, it offers the tour on the footer's Start Tour button ("Start
// Forms Tour"); a press there, or Show Me Around in the form's cog, starts it. It never starts or prompts on its own. Its destination step opens the board
// or sheet the form feeds and comes back to the form after; any other move away ends it.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addQuestion,
  deleteQuestion,
  newFormPartId,
  questionsOf,
  readForm,
} from '@liveplanner/forms';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { useSelectTab } from '@/app/project/[id]/useSelectTab';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { FORM_TOUR_RELAUNCH_EVENT } from '@/lib/form-tour';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { formTourSteps, formTourStepTelemetryType, type FormTourApi } from './form-tour-steps';
import { TourStage } from './TourStage';
import {
  useTourEngine,
  type TourOutcome,
} from '@liveworkspace/workbench/components/tour/useTourEngine';
import { TOUR_OFFER_RANK, useOfferTour } from '@liveworkspace/workbench/components/tour/tour-offer';

const FORM_TOUR_COPY = {
  helpHref: '/help/plan/forms/',
};

// The example question's wording.
const TOUR_QUESTION_PROMPT = 'What should we call you?';

export function FormTourHost() {
  const ctx = useEditorContext();
  const selectTab = useSelectTab();
  const tab = ctx.activeTab;
  const onForm = tab.kind === 'form';
  const form = onForm ? readForm(tab.form) : null;
  const destTabId = form?.sheet?.tabId ?? form?.destination?.tabId ?? null;
  const destKind: 'board' | 'sheet' | null = !destTabId ? null : form?.sheet ? 'sheet' : 'board';

  // The Form tab the tour began on: the destination step leaves it and comes back.
  const formTabRef = useRef<string | null>(null);
  // Where its responses go, fixed as the tour starts: on that tab the form is not the tab open, so it cannot be read.
  const destTabRef = useRef<string | null>(null);
  // The example question the tour added, while it is on the form (no undo step: changeFormQuietly).
  const questionRef = useRef<string | null>(null);
  const previewButton = () =>
    [...document.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find((b) =>
      /^(Preview|Back to Editing)$/.test(b.textContent?.trim() ?? ''),
    ) ?? null;
  const removeQuestion = () => {
    const id = questionRef.current;
    if (!id) return;
    questionRef.current = null;
    ctx.forms.changeFormQuietly((f) => deleteQuestion(f, id));
  };
  const apiRef = useLatest<FormTourApi>({
    addQuestion: () => {
      if (questionRef.current) return questionRef.current;
      const id = newFormPartId('q');
      ctx.forms.changeFormQuietly((f) => {
        const last = questionsOf(f).at(-1)?.id ?? null;
        const added = addQuestion(f, 'short', last, () => id).form;
        return {
          ...added,
          sections: added.sections.map((s) => ({
            ...s,
            questions: s.questions.map((q) =>
              q.id === id ? { ...q, prompt: TOUR_QUESTION_PROMPT } : q,
            ),
          })),
        };
      });
      questionRef.current = id;
      return id;
    },
    editQuestion: () => {
      const id = questionRef.current;
      if (!id) return;
      const card = document.querySelector<HTMLElement>(`[data-form-question="${id}"]`);
      card?.querySelector<HTMLButtonElement>('button[aria-label^="Edit question"]')?.click();
      // Opened, it grows in place at the foot of the form: brought to the middle of the view so all of it shows.
      requestAnimationFrame(() =>
        document
          .querySelector(`[data-form-question="${id}"]`)
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      );
    },
    questionId: () => questionRef.current,
    preview: (on) => {
      const button = previewButton();
      if (button && (button.getAttribute('aria-pressed') === 'true') !== on) button.click();
    },
    destination: () => (destTabId && destKind ? { tabId: destTabId, kind: destKind } : null),
    openTab: (id) => selectTab(id),
    backToForm: () => {
      if (formTabRef.current && ctx.activeTab.id !== formTabRef.current)
        selectTab(formTabRef.current);
    },
  });

  // The steps fixed as the tour starts: the form as it was then.
  const [shape, setShape] = useState({ destination: destKind });
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

  const canWork =
    ctx.hydrated &&
    !ctx.anyWelcomeOpen &&
    ctx.can.level === 'edit' &&
    !ctx.isReadOnly &&
    !ctx.embedMode &&
    tab.locked !== true;

  const endTour = (outcome: TourOutcome) => {
    apiRef.current.backToForm();
    // The form is left as the person had it: out of Preview, the example question gone.
    apiRef.current.preview(false);
    removeQuestion();
    formTabRef.current = null;
    destTabRef.current = null;
    const next = rebaseUserPreferences(ctx.userPreferences, {
      ...ctx.userPreferences,
      formTourSeen: true,
    });
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
    debugLog('[form-tour] end', { outcome });
    track('UI', 'Ended', outcome === 'completed' ? 'FormTourCompleted' : 'FormTourSkipped');
  };
  const endTourRef = useLatest(endTour);
  const engineRef = useLatest(engine);

  const start = () => {
    if (active || otherTour) return;
    formTabRef.current = tab.id;
    destTabRef.current = destTabId;
    setShape({ destination: destKind });
    debugLog('[form-tour] start');
    engineRef.current.start();
  };
  const canStart = onForm && canWork;
  // The footer's Start Tour button: offered on a Form tab the person can edit, taken or not (it is how it is taken
  // again).
  useOfferTour(
    'form',
    canStart
      ? {
          name: 'Forms',
          rank: TOUR_OFFER_RANK.mode,
          start,
          onShown: () => track('UI', 'Opened', 'FormTourOffer'),
        }
      : null,
  );

  // Show Me Around in the form's cog: runs it at once.
  const startRef = useLatest(start);
  const canStartRef = useLatest(canStart);
  useEffect(() => {
    const onRelaunch = () => {
      if (canStartRef.current) startRef.current();
    };
    window.addEventListener(FORM_TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(FORM_TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [canStartRef, startRef]);

  // Ends as skipped when it can no longer run: edit rights gone, or a tab opened that is neither the form nor where
  // its responses go.
  useEffect(() => {
    if (!active) return;
    const here = tab.id;
    if (!canWork || (here !== formTabRef.current && here !== destTabRef.current)) {
      engineRef.current.stop();
      endTourRef.current('skipped');
    }
  }, [active, canWork, tab.id, engineRef, endTourRef]);

  useEffect(() => () => setActiveTour('form', false), []);

  return <TourStage engine={engine} ariaPrefix="Forms tour" copy={FORM_TOUR_COPY} />;
}
