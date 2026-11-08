// What an account adds, as the guest's Learn More lists it (liveworkspace/docs/specs/010-site/site.md "Guests"), in
// the Explorer's words for the app's kind. Pure, so each app's rows are tested without a dialog. The rows are the same
// for every app but the one about agents: an app with an MCP server offers AI assistants over it, and livehuddle, which
// has none (livehuddle/docs/specs/002-project-scope/not-in-livehuddle.md), offers the API to scripts instead.

import type { App } from '@liveworkspace/index-client';
import type { Words } from '../words';

export type SignInReason = { title: string; body: string };

// The apps with no MCP server: their agents row names the API alone.
const APPS_WITHOUT_MCP: ReadonlySet<App> = new Set<App>(['livehuddle']);

export function signInReasons(app: App, words: Pick<Words, 'lowerMany'>): SignInReason[] {
  return [
    {
      title: `Keep your ${words.lowerMany} safe`,
      body: `A guest's ${words.lowerMany} are tied to this browser, so clearing its data can lose them. Signing in keeps them with your account.`,
    },
    {
      title: 'Open them anywhere',
      body: `Your ${words.lowerMany} wait for you on your laptop, desktop and phone.`,
    },
    {
      title: 'Work as a team',
      body: 'Make teams, invite people by email, and share a library everyone can open, in every app.',
    },
    APPS_WITHOUT_MCP.has(app)
      ? {
          title: 'Use the API',
          body: `Make API tokens, so your own scripts can read and build your ${words.lowerMany}.`,
        }
      : {
          title: 'Connect AI tools',
          body: 'Make API tokens and connect AI assistants over MCP, so they can read and build your work.',
        },
    {
      title: 'Use your real name',
      body: 'Shared work, cursors and comments show your name, so people know who did what.',
    },
  ];
}
