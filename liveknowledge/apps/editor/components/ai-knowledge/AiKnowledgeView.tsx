'use client';

// AI Knowledge (docs/specs/030-knowledgebase/ai-knowledge.md): the knowledgebase's third view.
import { EmptyState } from '@liveknowledge/ui';
import { AiViewIcon } from '@/components/ask/ask-icons';
import { KnowledgeViewHeader } from '@/components/ask/KnowledgeViewFrame';

export function AiKnowledgeView() {
  return (
    <>
      <KnowledgeViewHeader
        title="AI Knowledge"
        about="What agents know, where they learned it and what they could not find."
      />
      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto p-6">
        <EmptyState
          icon={<AiViewIcon />}
          title="No AI Knowledge Yet"
          description="This view is being built. Pages and Ask work as they are."
        />
      </div>
    </>
  );
}
