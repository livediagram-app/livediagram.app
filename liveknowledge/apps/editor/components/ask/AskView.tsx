'use client';

// Ask (docs/specs/030-knowledgebase/search-and-ask.md "Ask"): the knowledgebase's second view.
import { EmptyState } from '@liveknowledge/ui';
import { AskViewIcon } from './ask-icons';
import { KnowledgeViewHeader } from './KnowledgeViewFrame';

export function AskView() {
  return (
    <>
      <KnowledgeViewHeader
        title="Ask"
        about="Answers in plain words from this knowledgebase's own pages."
      />
      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto p-6">
        <EmptyState
          icon={<AskViewIcon />}
          title="No Questions Yet"
          description="Ask is being built. Search the pages in the meantime."
        />
      </div>
    </>
  );
}
