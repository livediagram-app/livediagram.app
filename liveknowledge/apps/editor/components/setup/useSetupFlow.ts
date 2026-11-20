'use client';

// The state of Describe to Set Up's dialog (docs/specs/030-knowledgebase/describe-to-set-up.md "The flow"): the
// description, the request for a structure (one at a time, aborted by Cancel), the pages under review and the run
// that makes them. Nothing is written to the knowledgebase before Create.
import { useCallback, useEffect, useRef, useState } from 'react';
import { pageTreeRows, truncateName, type PageTreeRefusal } from '@liveknowledge/document';
import type { KnowledgeAiProvider } from '@liveknowledge/api-schema';
import {
  SETUP_MAX_DESCRIPTION_CHARS,
  SETUP_MAX_EXISTING_PAGES,
  SETUP_MIN_DESCRIPTION_CHARS,
} from '@liveknowledge/knowledge';
import { useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { selectPage } from '@/components/page-tree/select-page';
import type { AskSession } from '@/components/ask/useAskSession';
import type { ImportProgress, ImportWriteResult } from '@/lib/knowledge-import/write-plan';
import { landingDepth, runSetup } from '@/lib/knowledge-setup/run-setup';
import { apiSuggestSetup } from '@/lib/knowledge-setup/setup-api';
import { untouchedOnlyPage } from '@/lib/knowledge-setup/setup-empty';
import type { SetupMode } from '@/lib/knowledge-setup/setup-open';
import {
  reviewPages,
  setupLimitRefusal,
  tickedPages,
  withTick,
  withTitle,
  type ReviewPage,
} from '@/lib/knowledge-setup/setup-tree';
import { track } from '@/lib/telemetry';

export type SetupStep = 'describe' | 'suggesting' | 'review' | 'creating' | 'done';
export type SetupFailure = { kind: string; provider?: KnowledgeAiProvider | undefined };

export const UNTITLED_KNOWLEDGEBASE = 'Untitled Knowledgebase';
const isUntitled = (name: string | null | undefined) =>
  !name?.trim() || name.trim() === UNTITLED_KNOWLEDGEBASE;

export type SetupFlow = {
  step: SetupStep;
  description: string;
  setDescription: (text: string) => void;
  canSuggest: boolean;
  suggest: () => void;
  /** Ends the request for a structure and returns to the description, which is kept. */
  cancelSuggest: () => void;
  failure: SetupFailure | null;
  pages: readonly ReviewPage[];
  ticked: number;
  setTicked: (id: string, ticked: boolean) => void;
  setTitle: (id: string, title: string) => void;
  /** The suggested name, offered only while the knowledgebase is still untitled; null when it is not offered. */
  name: string | null;
  setName: (name: string) => void;
  refusal: PageTreeRefusal | null;
  /** Back to step 1 with the description kept. */
  tryAgain: () => void;
  create: () => void;
  progress: ImportProgress | null;
  /** Stops between batches; what was made stays. */
  cancelCreate: () => void;
  /** What the run came to, once it has ended with something to say (a page that failed, a stop). */
  result: ImportWriteResult | null;
};

export function useSetupFlow(session: AskSession, mode: SetupMode, onClose: () => void): SetupFlow {
  const chrome = useEditorChromeStore();
  const [step, setStep] = useState<SetupStep>('describe');
  const [description, setDescription] = useState('');
  const [failure, setFailure] = useState<SetupFailure | null>(null);
  const [pages, setPages] = useState<readonly ReviewPage[]>([]);
  const [name, setName] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportWriteResult | null>(null);
  const request = useRef<AbortController | null>(null);
  const stopped = useRef(false);
  const alive = useRef(true);

  // Closing the dialog ends a request that is out, and stops a run at its next batch.
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current?.abort();
      stopped.current = true;
    };
  }, []);

  const length = description.trim().length;
  const canSuggest =
    step === 'describe' &&
    length >= SETUP_MIN_DESCRIPTION_CHARS &&
    length <= SETUP_MAX_DESCRIPTION_CHARS;

  // Where the pages land, read when it is needed: under the open page when adding, else at the top, where the
  // knowledgebase's untouched only page becomes the first of them.
  const landing = useCallback(() => {
    const editor = chrome.get();
    const parent = mode === 'add' ? editor.activeId : undefined;
    const replace =
      mode === 'set-up' ? untouchedOnlyPage(editor.tabs, editor.loadedTabIds) : undefined;
    return { editor, parent, replace };
  }, [chrome, mode]);

  const suggest = useCallback(() => {
    if (!canSuggest) return;
    const { editor } = landing();
    const controller = new AbortController();
    request.current = controller;
    setFailure(null);
    setStep('suggesting');
    const existing =
      mode === 'add'
        ? pageTreeRows(editor.tabs)
            .slice(0, SETUP_MAX_EXISTING_PAGES)
            .map((row) => ({ title: row.page.name, depth: row.depth }))
        : [];
    void apiSuggestSetup(
      session.who,
      session.documentId,
      { description: description.trim(), ...(existing.length > 0 ? { existing } : {}) },
      controller.signal,
    ).then((outcome) => {
      if (!alive.current || request.current !== controller) return;
      request.current = null;
      if (!outcome.ok) {
        // Cancelled by the person: back at the description with nothing to say.
        if (outcome.kind !== 'aborted')
          setFailure({ kind: outcome.kind, provider: outcome.provider });
        setStep('describe');
        return;
      }
      track('UI', 'Used', 'SetupSuggested');
      setPages(reviewPages(outcome.suggestion.pages));
      setName(
        mode === 'set-up' && isUntitled(chrome.get().documentName)
          ? truncateName(outcome.suggestion.name)
          : null,
      );
      setStep('review');
    });
  }, [canSuggest, landing, mode, session, description, chrome]);

  const cancelSuggest = useCallback(() => {
    request.current?.abort();
    request.current = null;
    setStep('describe');
  }, []);

  const where = landing();
  const refusal =
    step === 'review'
      ? setupLimitRefusal(pages, {
          existing: where.editor.tabs.length,
          replacing: where.replace !== undefined,
          parentDepth: landingDepth(where.editor.tabs, where.parent),
        })
      : null;
  const ticked = tickedPages(pages).length;

  const create = useCallback(() => {
    if (step !== 'review' || ticked === 0 || refusal) return;
    const { parent, replace } = landing();
    stopped.current = false;
    setStep('creating');
    setProgress({ done: 0, total: ticked });
    const named = name?.trim();
    void runSetup({
      pages,
      host: {
        documentId: session.documentId,
        getTabs: () => chrome.get().tabs,
        getActiveTab: () => chrome.get().activeTab,
        commitTabs: (mapTabs) => chrome.get().commitTabs(mapTabs),
        markTabLoaded: (id) => chrome.get().markTabLoaded(id),
      },
      parent,
      replaceId: replace?.id,
      cancelled: () => stopped.current,
      onProgress: (next) => {
        if (alive.current) setProgress(next);
      },
    }).then((made) => {
      if (made.imported > 0) {
        track('Tab', 'Created', 'FromSetup');
        // The suggested name, only while the knowledgebase still has none of its own.
        if (named && isUntitled(chrome.get().documentName))
          chrome.get().nameDocument(truncateName(named));
        if (made.first) selectPage(chrome.get(), made.first.id);
      }
      if (!alive.current) return;
      // Everything made: the dialog closes on the first new page. Otherwise it says what happened.
      if (made.imported === made.total && !made.stalled) onClose();
      else {
        setResult(made);
        setStep('done');
      }
    });
  }, [step, ticked, refusal, landing, name, pages, session.documentId, chrome, onClose]);

  return {
    step,
    description,
    setDescription,
    canSuggest,
    suggest,
    cancelSuggest,
    failure,
    pages,
    ticked,
    setTicked: (id, on) => setPages((list) => withTick(list, id, on)),
    setTitle: (id, title) => setPages((list) => withTitle(list, id, title)),
    name,
    setName,
    refusal,
    tryAgain: () => {
      setFailure(null);
      setStep('describe');
    },
    create,
    progress,
    cancelCreate: () => {
      stopped.current = true;
    },
    result,
  };
}
