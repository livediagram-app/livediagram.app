'use client';

// The question before an agent is allowed to write, or stopped (docs/specs/024-agents/knowledgebase-for-agents.md
// "Scopes"): what writing lets it do, in plain words, and that it is this knowledgebase's alone.
import { ConfirmDialog } from '@liveworkspace/workbench/components/dialogs/ConfirmDialog';
import type { AgentWriteAsk } from './AgentCard';

export function agentWriteQuestion(ask: Pick<AgentWriteAsk, 'kind'> & { name: string }): {
  title: string;
  message: string;
  confirmLabel: string;
} {
  return ask.kind === 'allow'
    ? {
        title: `Allow ${ask.name} to Write?`,
        message:
          'It will be able to replace a page’s writing and move pages, at once and without a person looking first. It can never rewrite a page that is Verified or due for review: there it still suggests the edit for a person to accept. This applies to this knowledgebase only.',
        confirmLabel: 'Allow Writing',
      }
    : {
        title: `Stop ${ask.name} Writing?`,
        message:
          'It goes back to reading and suggesting edits. Nothing it has written is undone. This applies to this knowledgebase only.',
        confirmLabel: 'Stop Writing',
      };
}

export function AgentWriteDialog({
  ask,
  onConfirm,
  onCancel,
}: {
  ask: AgentWriteAsk | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const words = agentWriteQuestion(
    ask ? { kind: ask.kind, name: ask.agent.name } : { kind: 'allow', name: '' },
  );
  return <ConfirmDialog open={ask !== null} {...words} onConfirm={onConfirm} onCancel={onCancel} />;
}
