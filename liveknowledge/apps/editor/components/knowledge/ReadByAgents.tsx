'use client';

// Read by Agents, behind Read This Week's "N by Agents" (owner 2026-11-22; docs/specs/030-knowledgebase/insights.md
// "AI Context on a page"): pressing the count opens a small pointer popover listing each agent that read the page this
// week and how often, most first. It reads nothing of its own: the agents ride Page Health's one read.
import { useState, type ReactNode } from 'react';
import type { PageAgentReads } from '@liveknowledge/api-schema';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { AgentsIcon } from './knowledge-icons';

const POPOVER_WIDTH = 264;

export function ReadByAgentsButton({
  agents,
  children,
}: {
  agents: readonly PageAgentReads[];
  /** The stat the button draws (Read This Week's "N by Agents"). */
  children: ReactNode;
}) {
  // The button the popover hangs from while open; null while closed.
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={anchor !== null}
        data-read-by-agents-toggle=""
        onClick={(event) => {
          const button = event.currentTarget;
          setAnchor((was) => (was ? null : button));
        }}
        className="block w-full cursor-pointer rounded-lg text-left transition hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        {children}
      </button>
      {anchor ? (
        <AnchoredPopover
          anchor={anchor}
          name="Read by Agents"
          width={POPOVER_WIDTH}
          pointer
          onClose={() => setAnchor(null)}
        >
          <div data-read-by-agents="" className="p-3 text-[13px] leading-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Read by Agents This Week
            </p>
            <ul className="mt-1.5 flex flex-col">
              {[...agents]
                .sort((a, b) => b.reads - a.reads || a.agent.localeCompare(b.agent))
                .map((a) => (
                  <li key={a.agent} data-page-agent="" className="flex min-h-8 items-center gap-2">
                    <span className="flex text-slate-400 dark:text-slate-400/60" aria-hidden>
                      <AgentsIcon />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-200">
                      {a.agent}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {a.reads.toLocaleString('en')} {a.reads === 1 ? 'read' : 'reads'}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        </AnchoredPopover>
      ) : null}
    </>
  );
}
