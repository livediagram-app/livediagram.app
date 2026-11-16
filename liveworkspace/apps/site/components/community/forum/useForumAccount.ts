'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ForumAuthor } from '@liveworkspace/community';
import { appAccount } from '@/lib/explorer/app-session';
import { pageApp } from '@/lib/explorer/page-app';
import { workspaceIdentity } from '@/lib/explorer/token';
import { useSession } from '@/lib/session';

// Who is writing in the Forum (liveworkspace/docs/specs/007-community/community.md "The Forum", "Who can do what"):
// the page's own account. On an app's address that is the app's session (the one its header shows, asked only when
// its signed-in hint is set); on liveworkspace.app this site's, with the workspace token for the service. A guest is
// not an account here: they read, and are asked to sign in to write.

export type SignedIn = {
  status: 'in';
  /** How the page shows them on what they write: their name and colour (null: Automatic), never an id. */
  author: { name: string; color: string | null };
  /** A fresh access token, or null if the session ended. */
  getToken: () => Promise<string | null>;
};

export type ForumAccount = { status: 'checking' } | { status: 'out' } | SignedIn;

const CHECKING: ForumAccount = { status: 'checking' };
const OUT: ForumAccount = { status: 'out' };

async function appToken(): Promise<string | null> {
  return (await appAccount())?.token ?? null;
}

async function workspaceAccountToken(): Promise<string | null> {
  const identity = await workspaceIdentity();
  return identity?.kind === 'account' ? identity.token : null;
}

/** The app's account, on its address. */
function useAppForumAccount(): ForumAccount {
  const [account, setAccount] = useState<ForumAccount>(CHECKING);
  useEffect(() => {
    let live = true;
    void appAccount().then((found) => {
      if (!live) return;
      setAccount(
        found?.sub
          ? { status: 'in', author: { name: found.name, color: found.colour }, getToken: appToken }
          : OUT,
      );
    });
    return () => {
      live = false;
    };
  }, []);
  return account;
}

/** This site's account, on liveworkspace.app: the session the header reads, and the workspace token. */
function useWorkspaceForumAccount(): ForumAccount {
  const session = useSession();
  return useMemo<ForumAccount>(() => {
    if (session.state === 'checking') return CHECKING;
    if (session.state === 'out') return OUT;
    return {
      status: 'in',
      author: { name: session.name, color: session.colour },
      getToken: workspaceAccountToken,
    };
  }, [session]);
}

/** The page's account. Which session that is depends only on the address, fixed for the page's life, so one of the
 *  two is chosen once: this site's session is never asked on an app's address, where it isn't the page's. */
export const useForumAccount: () => ForumAccount =
  typeof window !== 'undefined' && pageApp() !== null
    ? useAppForumAccount
    : useWorkspaceForumAccount;

/** The author a write sends: a colour the service can keep, or none for it to pick one from the account. */
export function authorOf(account: SignedIn): ForumAuthor {
  const color = account.author.color;
  return {
    name: account.author.name,
    color: color && /^#[0-9a-f]{6}$/i.test(color) ? color : '',
  };
}
