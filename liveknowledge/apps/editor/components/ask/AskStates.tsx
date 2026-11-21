'use client';

// What the Ask view shows when this session cannot ask (docs/specs/030-knowledgebase/search-and-ask.md "Bring your
// own key", "Share roles"): no key yet, nobody signed in, or a knowledgebase kept Offline. Each says why in plain
// words and what to do next; search needs no key and is always one press away.
import type { ReactNode } from 'react';
import { Button, EmptyState, buttonClassName } from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { useAuthHrefs } from '@/components/chrome/auth-shared';
import { knowledgeSearch } from '@/lib/knowledge/search-open';
import { showKnowledgeView } from '@/lib/knowledge-ask/knowledge-view';
import { openAiSettingsFrom } from './AiSettingsButton';
import { KeyIcon, OfflineIcon, SearchIcon, SignInIcon } from './ask-icons';

/** Search the pages: Pages shows again and the search dialog opens over it. */
export function searchThePages(): void {
  showKnowledgeView('pages');
  knowledgeSearch.open();
}

export function SearchPagesButton({ variant = 'secondary' }: { variant?: 'secondary' | 'ghost' }) {
  return (
    <Button variant={variant} size="xs" onClick={searchThePages}>
      <SearchIcon />
      <span className={variant === 'ghost' ? '' : 'phone:sr-only'}>Search the Pages</span>
    </Button>
  );
}

function StateShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-xl px-4 py-10">{children}</div>
    </div>
  );
}

const ACTIONS = 'flex flex-wrap items-center justify-center gap-2';

export function AskNoKey({ manageAi }: { manageAi: boolean }) {
  return (
    <StateShell>
      <EmptyState
        icon={<KeyIcon />}
        title="Ask Needs Your Team's AI Key"
        description={
          manageAi
            ? "Ask runs on your team's own key: your team pays its provider for what it uses. Add your team's AI key, from Anthropic or OpenAI, and Ask answers from these pages. Search works without one."
            : "Ask runs on your team's own AI key, which an Editor adds. Ask an Editor to add one. Search works without it."
        }
      >
        <div className={ACTIONS} data-ask-state="no-key">
          {manageAi ? (
            <Button variant="primary" size="sm" onClick={openAiSettingsFrom}>
              Open AI Settings
            </Button>
          ) : null}
          <SearchPagesButton variant="ghost" />
        </div>
      </EmptyState>
    </StateShell>
  );
}

export function AskSignedOut() {
  const { signInHref } = useAuthHrefs();
  return (
    <StateShell>
      <EmptyState
        icon={<SignInIcon />}
        title="Sign In to Ask"
        description="Ask spends this team's own AI key, so it is off for anyone who is not signed in, a share link's visitor included. Search works as it is."
      >
        <div className={ACTIONS} data-ask-state="signed-out">
          <a href={signInHref} className={buttonClassName({ variant: 'primary', size: 'sm' })}>
            Sign In
          </a>
          <SearchPagesButton variant="ghost" />
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
        <div className={ACTIONS} data-ask-state="offline">
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
