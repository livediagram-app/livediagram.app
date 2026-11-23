'use client';

// One connection in Connected Agents (docs/specs/030-knowledgebase/insights.md "Connected agents"): its name,
// how it connects, when it was last seen, what it may do here as chips from the scopes the room answers, its reads,
// and, for an Editor, a menu to allow it to write or to stop it.
import { useRef, type ReactNode } from 'react';
import type { KnowledgeAgent } from '@liveknowledge/api-schema';
import { MENU_PANEL, Tooltip, useClickOutside, useMenu, useMenuButton } from '@liveknowledge/ui';
import {
  agentDoor,
  agentScopeChips,
  agentWriteChoice,
  lastSeenText,
  readsText,
  type AgentDoor,
} from '@/lib/knowledge-ask/overview-words';
import {
  AgentIcon,
  AllowWritingIcon,
  CliIcon,
  McpIcon,
  MoreIcon,
  StopWritingIcon,
  TokenIcon,
} from './insights-icons';
import { INSIGHTS_CHIP, INSIGHTS_MUTED } from './InsightsSection';

const DOOR_ICON: Record<AgentDoor, ReactNode> = {
  mcp: <McpIcon />,
  cli: <CliIcon />,
  token: <TokenIcon />,
  named: <AgentIcon />,
};
// A page it read most: a small chip that opens the page.
const PAGE_LINK =
  'block max-w-full cursor-pointer truncate rounded-md bg-slate-100 px-2 py-0.5 text-left text-xs text-slate-800 transition-colors hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 phone:min-h-11 phone:py-2 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
const MORE_BUTTON =
  'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-default disabled:opacity-60 phone:h-11 phone:w-11 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';
const MENU_ROW =
  'flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 phone:min-h-11 dark:text-slate-200 dark:hover:bg-slate-800';

export type AgentWriteAsk = { agent: KnowledgeAgent; kind: 'allow' | 'stop'; tokenId: string };

export function AgentCard({
  agent,
  canGrant,
  busy,
  now,
  onOpenPage,
  onAskWrite,
}: {
  agent: KnowledgeAgent;
  // An Editor of the whole knowledgebase: the menu is drawn only for one.
  canGrant: boolean;
  busy: boolean;
  now: number;
  onOpenPage: (tab: string) => void;
  onAskWrite: (ask: AgentWriteAsk) => void;
}) {
  const { door, how } = agentDoor(agent);
  const choice = canGrant ? agentWriteChoice(agent) : { kind: 'none' as const, why: null };
  return (
    <li
      data-agent={agent.name}
      className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-700"
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
          <p className={`line-clamp-2 text-xs ${INSIGHTS_MUTED}`}>{how}</p>
          {/* Connected, then when it was last seen, on one line under how it connects. */}
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-emerald-800 dark:text-emerald-300">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Connected</span>
            </span>
            {agent.lastSeenAt ? (
              <>
                <span aria-hidden className={INSIGHTS_MUTED}>
                  ·
                </span>
                <span className={INSIGHTS_MUTED}>{lastSeenText(agent.lastSeenAt, now)}</span>
              </>
            ) : null}
          </p>
        </div>
        {choice.kind === 'none' ? null : (
          <AgentMenu
            name={agent.name}
            kind={choice.kind}
            busy={busy}
            onChoose={() => onAskWrite({ agent, kind: choice.kind, tokenId: choice.tokenId })}
          />
        )}
      </div>
      <ul aria-label="What it may do" className="mt-3 flex flex-wrap gap-1.5">
        {agentScopeChips(agent).map((scope) => (
          <li key={scope} className={INSIGHTS_CHIP}>
            {scope}
          </li>
        ))}
      </ul>
      {choice.kind === 'none' && choice.why ? (
        <p className={`mt-2 text-xs leading-5 ${INSIGHTS_MUTED}`}>{choice.why}</p>
      ) : null}
      <p className="mt-3 text-[13px] font-medium text-slate-900 dark:text-slate-100">
        {readsText(agent.readsThisWeek)}
      </p>
      {agent.topPages.length > 0 ? (
        <ol className="mt-1.5 flex flex-wrap gap-1.5" aria-label="The pages it read most">
          {agent.topPages.slice(0, 3).map((page) => (
            <li key={page.tab} className="min-w-0 max-w-full">
              <button type="button" onClick={() => onOpenPage(page.tab)} className={PAGE_LINK}>
                {page.title || 'Untitled Page'}
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  );
}

// The card's menu (docs/specs/004-interface-design/menus.md): one verb, its icon at the left.
function AgentMenu({
  name,
  kind,
  busy,
  onChoose,
}: {
  name: string;
  kind: 'allow' | 'stop';
  busy: boolean;
  onChoose: () => void;
}) {
  const { open, close, trigger, triggerProps } = useMenuButton();
  const wrap = useRef<HTMLDivElement>(null);
  useClickOutside(wrap, close, open);
  const label = `More for ${name}`;
  return (
    <div ref={wrap} className="relative shrink-0">
      <Tooltip label={label}>
        <button
          type="button"
          aria-label={label}
          disabled={busy}
          className={MORE_BUTTON}
          {...triggerProps}
        >
          <MoreIcon />
        </button>
      </Tooltip>
      {open ? (
        <AgentMenuPanel name={name} trigger={trigger} onClose={close}>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={MENU_ROW}
            onClick={() => {
              close();
              onChoose();
            }}
          >
            {kind === 'allow' ? <AllowWritingIcon /> : <StopWritingIcon />}
            {kind === 'allow' ? 'Allow Writing' : 'Stop Writing'}
          </button>
        </AgentMenuPanel>
      ) : null}
    </div>
  );
}

function AgentMenuPanel({
  name,
  trigger,
  onClose,
  children,
}: {
  name: string;
  trigger: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
}) {
  const { attach, surfaceProps } = useMenu({ onClose, trigger, label: `${name} actions` });
  return (
    <div
      ref={attach}
      {...surfaceProps}
      className={`${MENU_PANEL} absolute right-0 top-full z-10 mt-1 w-44 outline-none`}
    >
      {children}
    </div>
  );
}
