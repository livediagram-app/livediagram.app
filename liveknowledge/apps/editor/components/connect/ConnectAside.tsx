'use client';

// Beside Connect's steps (docs/specs/030-knowledgebase/mcp-connect.md "The view"): Already Connected, the
// connections AI Knowledge counts, and Other Ways In, the command line and API tokens.
import type { ReactNode } from 'react';
import type { KnowledgeAgent } from '@liveknowledge/api-schema';
import { CodeSnippet } from '@liveworkspace/marketing-site/components/ai/CodeSnippet';
import { Button, CompactEmptyState } from '@liveknowledge/ui';
import { AiSection, AI_CHIP, AI_MUTED } from '@/components/ai-knowledge/AiSection';
import {
  AgentIcon,
  CliIcon,
  McpIcon,
  TokenIcon,
} from '@/components/ai-knowledge/ai-knowledge-icons';
import { ConnectViewIcon } from '@/components/ask/ask-icons';
import { agentDoor, agentScopeChips, type AgentDoor } from '@/lib/knowledge-ask/overview-words';
import { track } from '@/lib/telemetry';

/** How many connections the aside lists; AI Knowledge has them all. */
export const ASIDE_AGENTS = 5;

const DOOR_ICON: Record<AgentDoor, ReactNode> = {
  mcp: <McpIcon />,
  cli: <CliIcon />,
  token: <TokenIcon />,
  named: <AgentIcon />,
};

const CLI_COMMANDS = (name: string) =>
  `liveknowledge auth login\nliveknowledge context "${name}"\nliveknowledge search "${name}" when do we deploy`;

export function AlreadyConnected({
  agents,
  onManage,
}: {
  // Null while the first read is out.
  agents: readonly KnowledgeAgent[] | null;
  onManage: () => void;
}) {
  const shown = agents?.slice(0, ASIDE_AGENTS) ?? [];
  return (
    <AiSection
      id="connect-agents"
      title="Already Connected"
      icon={<AgentIcon />}
      about="Apps that read or wrote here in the last 30 days."
      {...(agents && agents.length > 0 ? { count: agents.length } : {})}
    >
      {agents === null ? (
        <div aria-hidden className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      ) : agents.length === 0 ? (
        <CompactEmptyState
          icon={<ConnectViewIcon />}
          title="No Apps Connected Yet"
          description="An app shows here once it reads a page of this knowledgebase."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2" data-connect-agents="">
            {shown.map((agent) => {
              const { door, how } = agentDoor(agent);
              return (
                <li
                  key={agent.id}
                  data-agent={agent.name}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                >
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-brand-300 dark:bg-slate-800 [&_svg]:size-4"
                  >
                    {DOOR_ICON[door]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {agent.name}
                    </p>
                    <p className={`truncate text-xs ${AI_MUTED}`}>{how}</p>
                    <ul aria-label="What it may do" className="mt-1.5 flex flex-wrap gap-1">
                      {agentScopeChips(agent).map((chip) => (
                        <li key={chip} className={AI_CHIP}>
                          {chip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
          <Button
            variant="secondary"
            size="xs"
            onClick={onManage}
            className="w-fit cursor-pointer phone:min-h-11"
          >
            Manage in AI Knowledge
          </Button>
        </div>
      )}
    </AiSection>
  );
}

export function OtherWaysIn({ name, onOpenTokens }: { name: string; onOpenTokens: () => void }) {
  const text = `text-[13px] leading-5 ${AI_MUTED}`;
  return (
    <AiSection
      id="connect-other"
      title="Other Ways In"
      icon={<CliIcon />}
      about="For a terminal, a script or a tool that cannot sign in."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Command Line</h3>
          <p className={text}>Sign in once, then read and suggest from a terminal or a script.</p>
          <CodeSnippet
            code={CLI_COMMANDS(name)}
            lang="bash"
            onCopied={() => track('UI', 'Copied', 'McpSetup')}
          />
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">API Token</h3>
          <p className={text}>
            Send a token from Settings as a Bearer token. A read-only token only reads, whatever is
            allowed here.
          </p>
          <Button
            variant="secondary"
            size="xs"
            onClick={onOpenTokens}
            className="w-fit cursor-pointer phone:min-h-11"
          >
            <TokenIcon />
            Open API Tokens
          </Button>
        </div>
      </div>
    </AiSection>
  );
}
