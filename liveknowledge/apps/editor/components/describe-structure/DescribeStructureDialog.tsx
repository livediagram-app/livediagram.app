'use client';

// Describe Structure's dialog (docs/specs/030-knowledgebase/describe-to-set-up.md "Describe Structure on a page"):
// centred (a sheet from the foot on a phone), one field for what the page is for, the quiet line saying which AI
// answers, Cancel and Describe. Describe asks the api for the page's structure and puts it into the page's draft at the
// top; nothing is saved. Fetched when first opened (DescribeStructureHost.tsx).
import { useEffect, useId, useRef, useState } from 'react';
import { savedFlowOf } from '@liveknowledge/document';
import { STRUCTURE_MAX_PURPOSE_CHARS } from '@liveknowledge/knowledge';
import { Button, DialogCloseButton, DialogFooter, DialogHeader, TextArea } from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { useEditorChromeStore, type EditorChromeStore } from '@/app/document/[id]/EditorContext';
import { openAiSettingsFrom } from '@/components/ask/AiSettingsButton';
import { useAiSettingsState, useAskSession, type AskSession } from '@/components/ask/useAskSession';
import { aiSettingsStore } from '@/lib/knowledge-ask/ai-settings-store';
import { useAskAiChoice } from '@/lib/knowledge-ask/ask-ai-choice';
import { apiDescribeStructure } from '@/lib/describe-structure/structure-api';
import { putStructureInDraft } from '@/lib/describe-structure/structure-draft';
import {
  STRUCTURE_BUTTON,
  STRUCTURE_LABEL,
  STRUCTURE_SUBTITLE,
  purposeHint,
  structureAiLine,
  structureFailureWords,
  structurePlaceholder,
  usesChosenBuiltIn,
} from '@/lib/describe-structure/structure-words';
import { pageEditLens } from '@/lib/page-edit/lens';
import { track } from '@/lib/telemetry';
import type { KnowledgeAiProvider } from '@liveknowledge/api-schema';

/** The page's title as it is being written: the draft's Title, else the saved name. */
export function draftTitleOf(chrome: EditorChromeStore, tabId: string): string {
  const { pageTab } = chrome.get();
  if (pageTab.id !== tabId) return '';
  const lens = pageEditLens(pageTab);
  const flow = savedFlowOf(lens);
  const block = (flow ? lens.articles?.[flow]?.blocks : undefined)?.find(
    (b) => b.type === 'paragraph' && b.style === 'title',
  );
  const typed = block && 'runs' in block ? block.runs.map((r) => r.text).join('') : '';
  return typed.trim() || pageTab.name.trim();
}

export function DescribeStructureDialog({
  tabId,
  onClose,
}: {
  tabId: string;
  onClose: () => void;
}) {
  const session = useAskSession();
  if (!session) return null;
  return <DialogBody session={session} tabId={tabId} onClose={onClose} />;
}

type Failure = { kind: string; provider?: KnowledgeAiProvider | undefined };

function DialogBody({
  session,
  tabId,
  onClose,
}: {
  session: AskSession;
  tabId: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const fieldId = useId();
  const hintId = useId();
  const chrome = useEditorChromeStore();
  const { documentId, who } = session;
  const settingsState = useAiSettingsState(documentId);
  const settings = settingsState.status === 'ready' ? settingsState.settings : null;
  const choice = useAskAiChoice(who, documentId);
  const [title] = useState(() => draftTitleOf(chrome, tabId));
  const [purpose, setPurpose] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const request = useRef<AbortController | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    void aiSettingsStore.load(who, documentId);
  }, [who, documentId]);
  // The caret in the field as it opens; closing ends a request that is out.
  useEffect(() => {
    field.current?.focus();
    return () => request.current?.abort();
  }, []);

  const length = purpose.trim().length;
  const hint = purposeHint(length);
  const canDescribe = !busy && hint === null && (length > 0 || title !== '');
  const aiLine = structureAiLine(settings, choice);
  const words = failure
    ? structureFailureWords(failure.kind, {
        provider: failure.provider ?? settings?.provider,
        manageAi: session.rights.manageAi,
      })
    : null;

  const describe = async () => {
    if (!canDescribe) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setFailure(null);
    const outcome = await apiDescribeStructure(
      who,
      documentId,
      tabId,
      {
        purpose: purpose.trim().slice(0, STRUCTURE_MAX_PURPOSE_CHARS),
        ...(title ? { title } : {}),
        ...(usesChosenBuiltIn(settings, choice) ? { ai: 'built-in' as const } : {}),
      },
      controller.signal,
    );
    if (controller.signal.aborted) return;
    request.current = null;
    setBusy(false);
    if (!outcome.ok) {
      setFailure({ kind: outcome.kind, provider: outcome.provider });
      return;
    }
    if (!putStructureInDraft(chrome, tabId, outcome.blocks)) {
      setFailure({ kind: 'page-gone' });
      return;
    }
    track('UI', 'Used', 'DescribeStructure');
    onClose();
  };

  const close = () => {
    request.current?.abort();
    onClose();
  };

  return (
    <Dialog open onClose={close} titleId={titleId} size="md" phoneSheet>
      <DialogHeader
        title={<span id={titleId}>{STRUCTURE_BUTTON}</span>}
        subtitle={STRUCTURE_SUBTITLE}
      >
        <DialogCloseButton onClick={close} />
      </DialogHeader>
      <div className="flex flex-col gap-3 px-6 py-5" data-describe-structure-dialog="">
        {words ? (
          <Callout
            tone="warning"
            size="md"
            role="alert"
            title={words.title}
            {...(words.settings
              ? { action: { label: 'Open AI Settings', onSelect: openAiSettingsFrom } }
              : {})}
          >
            {words.text}
          </Callout>
        ) : null}
        <label
          htmlFor={fieldId}
          className="text-sm font-semibold text-slate-900 dark:text-slate-100"
        >
          {STRUCTURE_LABEL}
        </label>
        <TextArea
          ref={field}
          id={fieldId}
          value={purpose}
          rows={4}
          invalid={hint !== null}
          hintId={hintId}
          disabled={busy}
          data-describe-structure-purpose=""
          placeholder={structurePlaceholder(title)}
          className="min-h-28 resize-none leading-relaxed"
          onChange={(event) => setPurpose(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void describe();
            }
          }}
        />
        <div id={hintId} className="flex min-h-5 items-start justify-between gap-3 text-xs">
          <p
            className={
              hint ? 'text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-400'
            }
            data-describe-structure-ai=""
          >
            {hint ?? aiLine ?? ''}
          </p>
          {length > STRUCTURE_MAX_PURPOSE_CHARS - 100 ? (
            <p
              aria-live="polite"
              className={`shrink-0 tabular-nums ${hint ? 'font-semibold text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-400'}`}
            >
              {length} / {STRUCTURE_MAX_PURPOSE_CHARS}
            </p>
          ) : null}
        </div>
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={close}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!canDescribe} onClick={() => void describe()}>
          {busy ? 'Drafting...' : 'Describe'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
