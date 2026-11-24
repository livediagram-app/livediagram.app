'use client';

// Add to Knowledgebase (docs/specs/013-workspace/suggestions.md; liveworkspace/docs/specs/016-notifications/
// suggestions.md): the article on show explains a process, so it is offered as a page in the team's knowledgebase,
// its text as Markdown with a line back to this document, in one click. The check reads the tab from a ref when the
// page is idle (the article's blocks, parsed once per commit by articlesOf), and asks where the page would go once,
// after the blocks matched. An Editor's alone, signed in, with a knowledgebase they can edit.
import { useCallback, useEffect, useRef } from 'react';
import { articlesOf, articleTabMarkdown, type Tab } from '@livedocuments/document';
import { NextAppSuggestion } from '@liveworkspace/workbench/components/suggest/NextAppSuggestion';
import {
  writeUpFrom,
  writeUpTarget,
  writeUpToKnowledgebase,
} from '@liveworkspace/workbench/components/suggest/write-up';
import { useToast } from '@/hooks/ui/useToast';
import { explainsProcess } from '@/lib/process-article';

export function AddToKnowledgebaseSuggestion({
  itemId,
  allowed,
  title,
  tab,
}: {
  itemId: string | null;
  allowed: boolean;
  title: string;
  tab: Tab;
}) {
  const toast = useToast();
  const latest = useRef({ tab, title, toast });
  useEffect(() => {
    latest.current = { tab, title, toast };
  }, [tab, title, toast]);

  const check = useCallback(() => {
    if (!itemId) return null;
    const flows = Object.values(articlesOf(latest.current.tab));
    if (flows.length === 0 || !explainsProcess(flows)) return null;
    return writeUpTarget(itemId).then((kb) =>
      kb
        ? {
            line: `This article explains how to do something. Add it to ${kb.title || 'your knowledgebase'} as a page, so the team finds it when they ask.`,
            run: () => {
              const now = latest.current;
              const { markdown } = articleTabMarkdown(now.tab);
              // The document's own address, never a share code.
              const link = `${window.location.origin}/document/${itemId}`;
              return writeUpToKnowledgebase(now.toast, itemId, kb, {
                title: now.title,
                body: `${markdown.trim()}${writeUpFrom(now.title, 'livedocuments', link)}`,
              });
            },
          }
        : null,
    );
  }, [itemId]);

  return (
    <NextAppSuggestion id="add-to-knowledgebase" itemId={itemId} allowed={allowed} check={check} />
  );
}
