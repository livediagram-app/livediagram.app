'use client';

// A chat user's account link (docs/specs/030-knowledgebase/chat-apps.md "Linking an account"): the Connect button the
// Slack or Teams app sends opens this page with its code. Opening it changes nothing; the signed-in person presses
// Connect, and from then on their answers in that chat use the pages their account can open. Signed out, it asks
// them to sign in and comes back here.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ChatLinkPreview } from '@liveknowledge/api-schema';
import { Button } from '@liveworkspace/ui';
import { useAuthHrefs } from '@liveworkspace/workbench/components/chrome/auth-routes';
import { useDeferredAuth } from '@liveworkspace/workbench/components/providers/deferred-auth';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { apiChatLinkPreview, apiCompleteChatLink } from '@/lib/api/chat-apps';
import { track } from '@/lib/telemetry';

const noSubscribe = () => () => {};
const browserQuery = () => window.location.search;
const builtQuery = () => null;

const NAMES = { slack: 'Slack', teams: 'Microsoft Teams' } as const;

type Api = { preview: typeof apiChatLinkPreview; complete: typeof apiCompleteChatLink };
const API: Api = { preview: apiChatLinkPreview, complete: apiCompleteChatLink };

type State =
  | { kind: 'loading' }
  | { kind: 'expired' }
  | { kind: 'error' }
  | { kind: 'ready'; preview: ChatLinkPreview }
  | { kind: 'linking'; preview: ChatLinkPreview }
  | { kind: 'linked'; preview: ChatLinkPreview };

const gone = (err: unknown) =>
  err instanceof ApiError && (err.status === 410 || err.status === 404);

export function ChatLinkView({ api = API }: { api?: Api }) {
  const query = useSyncExternalStore(noSubscribe, browserQuery, builtQuery);
  const code = useMemo(
    () => (query === null ? undefined : new URLSearchParams(query).get('code')),
    [query],
  );
  const auth = useDeferredAuth();
  const { signInHref } = useAuthHrefs();
  const [read, setState] = useState<State>({ kind: 'loading' });
  // A link with no code is one copied in part: nothing to read.
  const state: State = code === null || code === '' ? { kind: 'expired' } : read;

  useEffect(() => {
    if (!code) return;
    let live = true;
    api
      .preview(auth.userId ?? '', code)
      .then((preview) => live && setState({ kind: 'ready', preview }))
      .catch((err: unknown) => live && setState({ kind: gone(err) ? 'expired' : 'error' }));
    return () => {
      live = false;
    };
  }, [api, code, auth.userId]);

  const connect = async () => {
    if (state.kind !== 'ready' || !code || !auth.userId) return;
    setState({ kind: 'linking', preview: state.preview });
    try {
      await api.complete(auth.userId, code);
      track('UI', 'Used', 'ChatAccountLinked');
      setState({ kind: 'linked', preview: state.preview });
    } catch (err) {
      setState(gone(err) ? { kind: 'expired' } : { kind: 'ready', preview: state.preview });
    }
  };

  const preview = 'preview' in state ? state.preview : null;
  const platform = preview ? NAMES[preview.platform] : 'chat';
  const signedOut = auth.authLoaded && !auth.isSignedIn;
  let title: string;
  let body: string;
  if (state.kind === 'expired') {
    title = 'This Link Has Expired';
    body =
      'Each link works once, for 30 minutes. Ask the app again in Slack or Teams and use the new link.';
  } else if (state.kind === 'error') {
    title = 'Something Went Wrong';
    body = "liveknowledge couldn't read this link. Try again in a moment.";
  } else if (state.kind === 'linked') {
    title = 'Your Account Is Connected';
    body = `Go back to ${platform} and ask again. Answers there now use the pages your liveknowledge account can open.`;
  } else {
    title = `Connect ${platform} to liveknowledge`;
    body = preview
      ? `${preview.userName ? `${preview.userName} in ` : ''}${preview.workspace} will get answers from the pages your liveknowledge account can open, and nothing else.`
      : 'Checking the link…';
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-16 dark:bg-slate-950">
      <div
        className="flex w-full max-w-md flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-10 text-center shadow-lg shadow-slate-900/10 sm:px-8 dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/30"
        data-chat-link={state.kind}
      >
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
        <p
          aria-live="polite"
          className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300"
        >
          {body}
        </p>
        {state.kind === 'ready' || state.kind === 'linking' ? (
          signedOut ? (
            <a
              href={signInHref}
              className="mt-6 inline-flex h-9 cursor-pointer items-center rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              Sign In to Connect
            </a>
          ) : (
            <Button
              className="mt-6"
              busy={state.kind === 'linking'}
              disabled={!auth.userId}
              onClick={() => void connect()}
            >
              Connect My Account
            </Button>
          )
        ) : null}
        {state.kind === 'ready' && !signedOut ? (
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            You can disconnect any time: send &ldquo;unlink&rdquo; to the app.
          </p>
        ) : null}
      </div>
    </main>
  );
}
