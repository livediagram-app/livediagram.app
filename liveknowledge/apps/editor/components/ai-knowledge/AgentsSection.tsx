'use client';

// Connected Agents (docs/specs/030-knowledgebase/ai-knowledge.md "Connected agents"): a card for each agent that
// has read or written here in the last 30 days.
import type { ReactNode } from 'react';
import type { KnowledgeAgent, KnowledgeSuggestion } from '@liveknowledge/api-schema';
import { Button, CompactEmptyState } from '@liveknowledge/ui';
import {
  agentDoor,
  agentScopes,
  readsText,
  type AgentDoor,
} from '@/lib/knowledge-ask/overview-words';
import { AgentIcon, CliIcon, McpIcon, TokenIcon } from './ai-knowledge-icons';
import { AI_CHIP, AI_MUTED, AiSection } from './AiSection';

const DOOR_ICON: Record<AgentDoor, ReactNode> = {
  mcp: <McpIcon />,
  cli: <CliIcon />,
  token: <TokenIcon />,
  named: <AgentIcon />,
};
const PAGE_LINK =
  'block w-full cursor-pointer truncate rounded text-left text-[13px] text-slate-800 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 phone:min-h-11 dark:text-slate-200';

export function AgentsSection({
  agents,
  suggestions,
  onConnect,
  onOpenPage,
}: {
  agents: readonly KnowledgeAgent[];
  suggestions: readonly KnowledgeSuggestion[];
  onConnect: () => void;
  onOpenPage: (tab: string) => void;
}) {
  return (
    <AiSection
      id="ai-agents"
      title="Connected Agents"
      about="Agents that read or wrote here in the last 30 days. An agent can open only what its person or token can."
      count={agents.length}
    >
      {agents.length === 0 ? (
        <CompactEmptyState
          icon={<AgentIcon />}
          title="No Agents Yet"
          description="Connect a coding agent or an assistant and it can search and read these pages."
          action={
            <Button variant="secondary" size="xs" onClick={onConnect}>
              Connect an Agent
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => {
            const { door, how } = agentDoor(agent.name);
            return (
              <li
                key={agent.name}
                data-agent={agent.name}
                className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800"
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-brand-300 dark:bg-slate-800"
                  >
                    {DOOR_ICON[door]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {agent.name}
                    </p>
                    <p className={`truncate text-xs ${AI_MUTED}`}>{how}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                    <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-500" />
                    Connected
                  </span>
                </div>
                <ul aria-label="What it may do" className="mt-3 flex flex-wrap gap-1.5">
                  {agentScopes(agent, suggestions).map((scope) => (
                    <li key={scope} className={AI_CHIP}>
                      {scope}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[13px] font-medium text-slate-900 dark:text-slate-100">
                  {readsText(agent.readsThisWeek)}
                </p>
                {agent.topPages.length > 0 ? (
                  <ol className="mt-1 flex flex-col gap-0.5" aria-label="The pages it read most">
                    {agent.topPages.slice(0, 3).map((page) => (
                      <li key={page.tab}>
                        <button
                          type="button"
                          onClick={() => onOpenPage(page.tab)}
                          className={PAGE_LINK}
                        >
                          {page.title || 'Untitled Page'}
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </AiSection>
  );
}
