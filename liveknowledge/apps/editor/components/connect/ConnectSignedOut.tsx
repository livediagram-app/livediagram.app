'use client';

// Connect for someone not signed in (docs/specs/030-knowledgebase/mcp-connect.md "The tab"): connecting an AI app
// makes a token for an account, so there is nothing to connect without one. Drawn in the gate's dialog over the
// knowledgebase (AskGate, `bare`) and in the view for its address followed from a link.
import { EmptyState, buttonClassName } from '@liveknowledge/ui';
import { useAuthHrefs } from '@/components/chrome/auth-shared';
import { STATE_ACTIONS, StateShell } from '@/components/ask/AskStates';
import { SignInIcon } from '@/components/ask/ask-icons';

export function ConnectSignedOut({ bare = false }: { bare?: boolean }) {
  const { signInHref } = useAuthHrefs();
  return (
    <StateShell bare={bare}>
      <EmptyState
        compact={bare}
        icon={<SignInIcon />}
        title="Sign In to Connect an AI App"
        description="Connecting an AI app makes a token for your account, so it can read and write as you. Sign in first; a share link's visitor too."
      >
        <div className={STATE_ACTIONS} data-connect-state="signed-out">
          <a href={signInHref} className={buttonClassName({ variant: 'primary', size: 'sm' })}>
            Sign In
          </a>
        </div>
      </EmptyState>
    </StateShell>
  );
}
