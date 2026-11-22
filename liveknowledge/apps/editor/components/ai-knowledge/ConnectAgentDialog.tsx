'use client';

// Connect an Agent (docs/specs/030-knowledgebase/ai-knowledge.md "Connected agents"): what a new connection may do
// here, how an Editor allows it to write, and the three ways in. The tool and command names are the MCP server's
// and the CLI's own (@liveknowledge/agent-verbs).
import { useId, type ReactNode } from 'react';
import { mcpEndpoint } from '@liveknowledge/api-schema';
import { Button, DialogCloseButton, DialogFooter, DialogHeader } from '@liveknowledge/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { MCP_ORIGIN } from '@/lib/mcp-config';
import { CliIcon, McpIcon, TokenIcon } from './ai-knowledge-icons';
import { AI_MUTED } from './AiSection';

const CODE =
  'block overflow-x-auto whitespace-pre rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs leading-5 text-slate-100 dark:bg-slate-950';

function Way({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="flex gap-3">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-brand-300 dark:bg-slate-800"
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
        {children}
      </div>
    </section>
  );
}

export function ConnectAgentDialog({
  canGrant,
  onOpenTokens,
  onClose,
}: {
  // An Editor reads how to allow writing; anyone else, who can.
  canGrant: boolean;
  onOpenTokens: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const text = `text-[13px] leading-5 ${AI_MUTED}`;
  return (
    <Dialog open onClose={onClose} titleId={titleId} size="md" phoneSheet>
      <DialogHeader
        title={<span id={titleId}>Connect an Agent</span>}
        subtitle="A new connection can read and search this knowledgebase and suggest edits for a person to accept."
      >
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="flex flex-col gap-5 px-6 py-4">
        <p className={text} data-connect-writing="">
          {canGrant
            ? 'To let a connection write pages directly, wait until it has connected, then open the menu on its card in Connected Agents and choose Allow Writing. That applies to this knowledgebase only, and you can stop it there at any time.'
            : 'Only an Editor of this knowledgebase can allow a connection to write pages directly, from its card in Connected Agents.'}
        </p>
        <Way icon={<McpIcon />} title="MCP Server">
          <p className={text}>
            Add this address to Claude or another AI tool. It asks you to approve the connection and
            makes its own token. The agent then calls get_context first, and search_pages, read_page
            and suggest_edit after it.
          </p>
          <code className={CODE}>{mcpEndpoint(MCP_ORIGIN)}</code>
        </Way>
        <Way icon={<CliIcon />} title="Command Line">
          <p className={text}>
            Sign in once, then read and suggest from a terminal or a script. Each command takes the
            knowledgebase’s name or id.
          </p>
          <code className={CODE}>
            {
              'liveknowledge auth login\nliveknowledge context Handbook\nliveknowledge search Handbook when do we deploy'
            }
          </code>
        </Way>
        <Way icon={<TokenIcon />} title="API Token">
          <p className={text}>
            Make a token in Settings and send it as a Bearer token to the API. A read-only token
            only reads, whatever is allowed here.
          </p>
          <Button variant="secondary" size="xs" className="w-fit" onClick={onOpenTokens}>
            Open API Tokens
          </Button>
        </Way>
      </div>
      <DialogFooter>
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
