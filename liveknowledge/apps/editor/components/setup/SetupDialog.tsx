'use client';

// Describe to Set Up (docs/specs/030-knowledgebase/describe-to-set-up.md "The flow"): one centred dialog of steady
// height in three steps, Describe, Review and Create. It runs on built-in AI with no key, and on the team's own key
// when one is set (owner, 2026-11-21): step 1 is there at once either way, with one quiet line saying which. Fetched
// when first opened (SetupHost.tsx).
import { useEffect, useId } from 'react';
import { Button, DialogCloseButton, DialogFooter, DialogHeader } from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { openAiSettingsFrom } from '@/components/ask/AiSettingsButton';
import { SETUP_BUILT_IN_PER_PERSON_PER_DAY } from '@liveknowledge/knowledge';
import { KnowledgeAiSource, saidOnLine } from '@/components/ask/KnowledgeAiSource';
import { useAiSettingsState, useAskSession, type AskSession } from '@/components/ask/useAskSession';
import { aiSettingsStore } from '@/lib/knowledge-ask/ai-settings-store';
import type { SetupMode } from '@/lib/knowledge-setup/setup-open';
import { createLabel, setupFailureWords, setupTitle } from '@/lib/knowledge-setup/setup-words';
import { DescribeStep } from './DescribeStep';
import { ReviewStep } from './ReviewStep';
import { SetupCreating, SetupDone, SetupSuggesting } from './SetupStates';
import { useSetupFlow, type SetupStep } from './useSetupFlow';

const STEPS = ['Describe', 'Review', 'Create'] as const;
const STEP_AT: Record<SetupStep, number> = {
  describe: 0,
  suggesting: 0,
  review: 1,
  creating: 2,
  done: 2,
};

function Steps({ at }: { at: number }) {
  return (
    <ol aria-label="Steps" className="flex items-center gap-2 text-xs" data-setup-steps="">
      {STEPS.map((name, index) => (
        <li
          key={name}
          aria-current={index === at ? 'step' : undefined}
          className={`flex items-center gap-1.5 ${
            index === at
              ? 'font-semibold text-slate-900 dark:text-slate-100'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <span
            aria-hidden
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] tabular-nums ${
              index === at
                ? 'bg-brand-700 text-white dark:bg-brand-600'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <span className="text-optical-centre">{index + 1}</span>
          </span>
          {name}
          {index < STEPS.length - 1 ? (
            <span aria-hidden className="ml-1 h-px w-5 bg-slate-200 dark:bg-slate-700" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function SetupDialog({ mode, onClose }: { mode: SetupMode; onClose: () => void }) {
  const session = useAskSession();
  if (!session) return null;
  return <SetupDialogBody session={session} mode={mode} onClose={onClose} />;
}

function SetupDialogBody({
  session,
  mode,
  onClose,
}: {
  session: AskSession;
  mode: SetupMode;
  onClose: () => void;
}) {
  const titleId = useId();
  const { documentId, who } = session;
  const settings = useAiSettingsState(documentId);
  const flow = useSetupFlow(session, mode, onClose);
  useEffect(() => {
    void aiSettingsStore.load(who, documentId);
  }, [who, documentId]);

  // Read only for the line that says which AI answers: nothing waits for it, and the api decides.
  const ready = settings.status === 'ready' ? settings.settings : null;
  // The request and the run end with the dialog; while pages are being made it does not close under the person.
  const close = flow.step === 'creating' ? flow.cancelCreate : onClose;
  const failure = flow.failure
    ? setupFailureWords(flow.failure.kind, { provider: flow.failure.provider ?? ready?.provider })
    : null;

  // Describe to Set Up always has built-in AI (describe-to-set-up.md "The model").
  const lineState = ready
    ? ({ status: 'ready', settings: { ...ready, builtIn: true } } as const)
    : null;
  const onLine = lineState !== null && saidOnLine(lineState, session.rights.manageAi, flow.failure);

  let body;
  if (flow.step === 'suggesting') body = <SetupSuggesting />;
  else if (flow.step === 'review')
    body = (
      <ReviewStep
        pages={flow.pages}
        name={flow.name}
        refusal={flow.refusal}
        onTick={flow.setTicked}
        onTitle={flow.setTitle}
        onName={flow.setName}
      />
    );
  else if (flow.step === 'creating') body = <SetupCreating progress={flow.progress} />;
  else if (flow.step === 'done' && flow.result) body = <SetupDone result={flow.result} />;
  else
    body = (
      <>
        {failure && onLine ? (
          <span role="alert" className="sr-only">
            {failure.title}. {failure.text}
          </span>
        ) : failure ? (
          <Callout
            tone="warning"
            size="md"
            role="alert"
            title={failure.title}
            {...(failure.step === 'ai-settings'
              ? { action: { label: 'Open AI Settings', onSelect: openAiSettingsFrom } }
              : {})}
          >
            {failure.text}
          </Callout>
        ) : null}
        <DescribeStep
          description={flow.description}
          onChange={flow.setDescription}
          onSubmit={flow.suggest}
          adding={mode === 'add'}
        />
        {lineState ? (
          <div className="-mt-1" data-setup-ai="">
            <KnowledgeAiSource
              state={lineState}
              who={who}
              documentId={documentId}
              manageAi={session.rights.manageAi}
              allowance={`${SETUP_BUILT_IN_PER_PERSON_PER_DAY} set-ups a person a day.`}
              failure={flow.failure}
            />
          </div>
        ) : null}
      </>
    );

  const describing = flow.step === 'describe';
  return (
    <Dialog open onClose={close} titleId={titleId} size="lg" phoneSheet>
      <DialogHeader
        title={<span id={titleId}>{setupTitle(mode)}</span>}
        subtitle={
          mode === 'add'
            ? 'Say what is missing and AI proposes pages to add under the open page.'
            : 'Say what this knowledgebase is for and AI proposes its pages.'
        }
      >
        <DialogCloseButton onClick={close} />
      </DialogHeader>
      {/* One height whatever step is showing, so nothing jumps between them. */}
      <div
        className="flex h-[29rem] max-h-[calc(100dvh-13rem)] flex-col gap-4 px-6 py-5"
        data-setup-dialog={flow.step}
      >
        <Steps at={STEP_AT[flow.step]} />
        {body}
      </div>
      <DialogFooter>
        {flow.step === 'done' ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : flow.step === 'creating' ? (
          <Button variant="secondary" onClick={flow.cancelCreate}>
            Stop
          </Button>
        ) : flow.step === 'suggesting' ? (
          <Button variant="secondary" onClick={flow.cancelSuggest}>
            Cancel
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            {flow.step === 'review' ? (
              <>
                <Button variant="secondary" onClick={flow.tryAgain}>
                  Try Again
                </Button>
                <Button
                  variant="primary"
                  disabled={flow.ticked === 0 || flow.refusal !== null}
                  onClick={flow.create}
                >
                  {createLabel(flow.ticked)}
                </Button>
              </>
            ) : describing ? (
              <Button variant="primary" disabled={!flow.canSuggest} onClick={flow.suggest}>
                Suggest a Structure
              </Button>
            ) : null}
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}
