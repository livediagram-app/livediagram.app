'use client';

// Draft a Page (docs/specs/030-knowledgebase/search-and-ask.md "It does not guess", ai-knowledge.md "Questions nobody
// could answer"): a page titled from the question whose first line is "Draft, Not Verified". With a key it is drafted
// by one more Ask call over the nearest passages; without one, or when that call fails, it holds the question as its
// first heading. An Editor's: without `makePages` nothing here runs. The same for an answer's Knowledge Gap card and
// an unanswered question's row.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { useToast } from '@/hooks/ui/useToast';
import { apiAskKnowledge } from '@/lib/api/knowledge-ask';
import { draftPageForQuestion } from '@/lib/knowledge-ask/make-page';
import { track } from '@/lib/telemetry';
import { openPassage } from './open-passage';
import type { AskSession } from './useAskSession';

export function useDraftPage(
  session: AskSession,
  hasKey: boolean,
): {
  /** The question a page is being drafted for now. */
  drafting: string | null;
  /** Resolves true once the page is made. */
  draft: (question: string) => Promise<boolean>;
} {
  const chrome = useEditorChromeStore();
  const toast = useToast();
  const [drafting, setDrafting] = useState<string | null>(null);
  const running = useRef<AbortController | null>(null);
  // Leaving the view stops the draft's Ask call; no page is made for it.
  useEffect(() => () => running.current?.abort(), []);

  const draft = useCallback(
    async (question: string): Promise<boolean> => {
      const { rights, who, documentId } = session;
      if (!rights.makePages || running.current) return false;
      const abort = new AbortController();
      running.current = abort;
      setDrafting(question);
      try {
        const outcome =
          hasKey && rights.askOff === null
            ? await apiAskKnowledge(who, documentId, { question }, { signal: abort.signal })
            : null;
        const made = draftPageForQuestion(chrome.get(), {
          question,
          draft:
            outcome?.type === 'done' ? { text: outcome.text, sources: outcome.sources } : undefined,
        });
        if (!made.ok) {
          toast.error(made.reason);
          return false;
        }
        track('Tab', 'Created', 'FromGap');
        toast.action({
          key: `draft-page-${made.id}`,
          message: `Drafted “${made.title}”`,
          actions: [
            {
              label: 'Open',
              ariaLabel: `Open ${made.title}`,
              onSelect: () => void openPassage(chrome, made.id),
            },
          ],
        });
        return true;
      } catch {
        // Aborted by leaving: nothing to say.
        return false;
      } finally {
        running.current = null;
        setDrafting(null);
      }
    },
    [session, hasKey, chrome, toast],
  );
  return { drafting, draft };
}
