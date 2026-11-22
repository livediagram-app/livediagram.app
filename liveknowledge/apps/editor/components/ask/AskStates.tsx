'use client';

// What the Ask view shows when this session cannot ask (docs/specs/030-knowledgebase/search-and-ask.md "When Ask is
// off", "Share roles"): no AI here (no built-in AI on this server and no key), nobody signed in, or a knowledgebase
// kept Offline. Each says why in plain words and what to do next; search needs no AI and is always one press away.
import type { ReactNode } from 'react';
import { Button, EmptyState, buttonClassName } from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { useAuthHrefs } from '@/components/chrome/auth-shared';
import { knowledgeSearch } from '@/lib/knowledge/search-open';
import { openAiSettingsFrom } from './AiSettingsButton';
import { KeyIcon, OfflineIcon, SearchIcon, SignInIcon } from './ask-icons';

/** Search the pages: the search opens over the view showing, which stays (owner 2026-11-21); a page picked in it
 *  shows Pages. */
export function searchThePages(): void {
  knowledgeSearch.open();
}

export function SearchPagesButton({
  variant = 'secondary',
  before,
}: {
  variant?: 'secondary' | 'ghost';
  /** Run first: the Ask gate closes before the search opens (AskGate). */
  before?: () => void;
}) {
  return (
    <Button
      variant={variant}
      size="xs"
      onClick={() => {
        before?.();
        searchThePages();
      }}
    >
      <SearchIcon />
      <span className={variant === 'ghost' ? '' : 'phone:sr-only'}>Search the Pages</span>
    </Button>
  );
}

/** A state's frame: the view's scroll column, or nothing extra inside a gate's dialog (`bare`). Connect's states
 *  share it (components/connect/ConnectSignedOut.tsx). */
export function StateShell({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  // Bare: inside the Ask gate's dialog (AskGate), which is its own frame.
  if (bare) return <div className="pb-2">{children}</div>;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-xl px-4 py-10">{children}</div>
    </div>
  );
}

export const STATE_ACTIONS = 'flex flex-wrap items-center justify-center gap-2';

/** No key, and no built-in AI on this server (a fork without the binding): only the team's key can answer. */
export function AskNoAi({
  manageAi,
  bare = false,
  before,
}: {
  manageAi: boolean;
  bare?: boolean;
  /** Run before either action: the gate's dialog closes (AskGate). */
  before?: () => void;
}) {
  return (
    <StateShell bare={bare}>
      <EmptyState
        compact={bare}
        icon={<KeyIcon />}
        title="Built-In AI Is Not Set Up Here"
        description={
          manageAi
            ? "This server has no built-in AI. Add your team's AI key, from Anthropic or OpenAI, and Ask answers from these pages. Search works without one."
            : "This server has no built-in AI, so Ask runs on your team's own key, which an Editor adds. Search works without it."
        }
      >
        <div className={STATE_ACTIONS} data-ask-state="no-ai">
          {manageAi ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                before?.();
                openAiSettingsFrom();
              }}
            >
              Open AI Settings
            </Button>
          ) : null}
          <SearchPagesButton variant="ghost" {...(before ? { before } : {})} />
        </div>
      </EmptyState>
    </StateShell>
  );
}

export function AskSignedOut({
  bare = false,
  before,
}: { bare?: boolean; before?: () => void } = {}) {
  const { signInHref } = useAuthHrefs();
  return (
    <StateShell bare={bare}>
      <EmptyState
        compact={bare}
        icon={<SignInIcon />}
        title="Sign In to Ask"
        description="Every answer runs on an AI with daily limits, so Ask is off for anyone who is not signed in, a share link's visitor included. Search works as it is."
      >
        <div className={STATE_ACTIONS} data-ask-state="signed-out">
          <a href={signInHref} className={buttonClassName({ variant: 'primary', size: 'sm' })}>
            Sign In
          </a>
          <SearchPagesButton variant="ghost" {...(before ? { before } : {})} />
        </div>
      </EmptyState>
    </StateShell>
  );
}

export function AskOffline() {
  return (
    <StateShell>
      <EmptyState
        icon={<OfflineIcon />}
        title="No Ask in an Offline Knowledgebase"
        description="This knowledgebase is kept in this browser, and Ask answers on a server that holds the team's key. Search works here as it is."
      >
        <div className={STATE_ACTIONS} data-ask-state="offline">
          <SearchPagesButton variant="ghost" />
        </div>
      </EmptyState>
    </StateShell>
  );
}

/** The settings could not be read, so whether there is a key is not known. */
export function AskSettingsFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <StateShell>
      <Callout
        tone="error"
        size="md"
        role="alert"
        title="Ask Could Not Be Reached"
        action={{ label: 'Try Again', onSelect: onRetry }}
      >
        Whether this knowledgebase has a key could not be read. Check your connection.
      </Callout>
    </StateShell>
  );
}

/** While the settings are read: the conversation's room, held, so nothing moves when they arrive. */
export function AskLoading() {
  return (
    <div
      role="status"
      aria-label="Loading Ask"
      className="min-h-0 flex-1"
      data-ask-state="loading"
    />
  );
}
