# Slack and Teams blueprint

Implements [chat-apps.md](../chat-apps.md) over the platform's `@liveworkspace/chat`
([liveworkspace/docs/specs/023-chat-apps](../../../../../liveworkspace/docs/specs/023-chat-apps/chat-apps.md)).

## Where it lives

- **The api Worker's `src/chat/`** answers Slack and Teams, before identity (their own signatures, never a person),
  and the account link page's two calls, after it (a signed-in account).
- **`ChatWorkspace`**, a new SQLite Durable Object class (binding `CHAT_WORKSPACE`, migration `v3`), one instance a
  workspace, named `slack:<team id>` or `teams:<tenant id>`, holds that workspace's install, linked people, pending
  links, kept answers, seen request keys and queued work. A Teams connect code is its own instance, `code:<CODE>`,
  holding the one code; a knowledgebase's list of what it is connected to is its own instance too, `kb:<id>`, holding
  `connections`. Nothing in any of them is a knowledgebase's content, so the room's schema does not change.
- **The knowledgebase's room** answers the chat's reads through its own routes, as the linked person: Ask
  (`POST .../ask`, the route the editor calls) and a page's preview (`GET .../pages/<tab>` and its `health`).

## Domain and naming

| Term         | Identifier                                                    |
| ------------ | ------------------------------------------------------------- |
| platform     | `ChatPlatform`: `'slack' \| 'teams'`                          |
| workspace    | a Slack team id (`T…`) or a Teams tenant id (a GUID)          |
| install      | the `install` row of a `ChatWorkspace`                        |
| connection   | a `connections` row of the knowledgebase's `kb:<id>` instance |
| chat user    | a Slack user id (`U…`) or a Teams `aadObjectId`               |
| link         | a `links` row: chat user to liveworkspace account (`user_…`)  |
| connect code | a Teams code, `XXXX-XXXX` (no 0, O, 1, I or L)                |
| link code    | the `/chat/link?code=` value, signed                          |

## Secrets and settings (`Env`)

All are set with `wrangler secret put` on the api Worker (production and `--env staging`), so the public
`wrangler.toml` names none of them.

| Name                   | What                                                                  |
| ---------------------- | --------------------------------------------------------------------- |
| `CHAT_KEY`             | 32 bytes, base64: seals bot tokens, signs states and link codes       |
| `SLACK_CLIENT_ID`      | the Slack app's client id                                             |
| `SLACK_CLIENT_SECRET`  | the Slack app's client secret, for `oauth.v2.access`                  |
| `SLACK_SIGNING_SECRET` | Slack's signing secret                                                |
| `TEAMS_APP_ID`         | the Azure bot's Microsoft App ID                                      |
| `TEAMS_APP_PASSWORD`   | the bot's client secret                                               |
| `TEAMS_APP_TENANT`     | optional: the bot's tenant for its token; unset is `botframework.com` |
| `TEAMS_APP_LINK`       | optional: where **Open Teams** goes (an `https://` Teams deep link)   |

Slack is offered when `CHAT_WORKSPACE`, `CHAT_KEY`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` and
`SLACK_SIGNING_SECRET` are set; Teams when `CHAT_WORKSPACE`, `CHAT_KEY`, `TEAMS_APP_ID` and `TEAMS_APP_PASSWORD` are
(`slackOffered`, `teamsOffered`). Unset, the routes answer `503 chat_unavailable` and the dialog's row says "Not set
up on this server".

## Files

| File                                           | Holds                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| `apps/api/src/chat/chat-config.ts`             | what is offered, the derived keys (once a secret), sealing, signing, link codes |
| `apps/api/src/chat/chat-routes.ts`             | `handleChatHooks` (Slack, Teams), `handleChatLink` (the link page's calls)      |
| `apps/api/src/chat/chat-slack.ts`              | `/ask`, events, Share in Channel, the install's callback, `forgetWorkspace`     |
| `apps/api/src/chat/chat-teams.ts`              | a Teams activity: connect, help, unlink, a question, a link to preview          |
| `apps/api/src/chat/chat-as-person.ts`          | `callAsPerson`: the index's grant for the person, then the room's own route     |
| `apps/api/src/chat/chat-answer.ts`             | `askAsPerson`, `previewAsPerson`, `pageOfLink`, the refusals' words             |
| `apps/api/src/chat/chat-jobs.ts`               | the queued work the alarm runs, and the prompt to connect                       |
| `apps/api/src/chat/chat-workspace.ts`          | the `ChatWorkspace` class: its RPC and its alarm                                |
| `apps/api/src/chat/chat-workspace-store.ts`    | its tables and statements                                                       |
| `apps/api/src/chat/chat-test-kit.ts`           | the tests' kit: the instances on node:sqlite, signed requests, a test bot key   |
| `apps/api/src/routes/knowledge-chat-routes.ts` | `GET chat`, `POST chat/slack`, `POST chat/teams`, `DELETE chat/<platform>`      |
| `packages/api-schema/src/chat-apps.ts`         | the routes' answers                                                             |
| `apps/editor/components/chat-apps/*`           | the dialog, its rows, the Teams code card, the art, `?chat=`'s watcher          |
| `apps/editor/lib/chat-apps/chat-apps-open.ts`  | the dialog's open state and what Slack's install came back with                 |
| `apps/editor/lib/api/chat-apps.ts`             | the api client                                                                  |
| `apps/editor/app/chat/link/*`                  | the account link page                                                           |

## The ChatWorkspace's tables

```sql
install (id INTEGER PRIMARY KEY CHECK (id = 1), platform TEXT, workspace TEXT, name TEXT,
         knowledgebase TEXT, connected_by TEXT, connected_at INTEGER, token TEXT, bot_user TEXT,
         service_url TEXT)
links (user TEXT PRIMARY KEY, person TEXT NOT NULL, user_name TEXT, linked_at INTEGER NOT NULL)
pending_links (user TEXT PRIMARY KEY, nonce TEXT NOT NULL, user_name TEXT, expires INTEGER NOT NULL)
answers (id TEXT PRIMARY KEY, user TEXT NOT NULL, body TEXT NOT NULL, expires INTEGER NOT NULL)
seen (key TEXT PRIMARY KEY, at INTEGER NOT NULL)
jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, body TEXT NOT NULL, at INTEGER NOT NULL,
      tries INTEGER NOT NULL DEFAULT 0)
code (id INTEGER PRIMARY KEY CHECK (id = 1), knowledgebase TEXT, person TEXT, expires INTEGER)
connections (platform TEXT PRIMARY KEY, workspace TEXT, name TEXT, connected_by TEXT, connected_at INTEGER)
```

- `token` is `seal(chatKey, '<platform>:<workspace>', botToken)`; Teams keeps no token (the bot's is minted from the
  app's credentials) but keeps `service_url`, the last checked activity's.
- `pending_links.nonce` is the SHA-256 of the link code's nonce: the code itself is never stored.
- Bounds: `links` and `pending_links` at most `CHAT_LINKS_MAX` (5,000) rows each, the oldest pending going first and
  a link past the cap refused (`chat_links_full`); `answers` at most 200, `seen` at most 5,000 (oldest first), `jobs`
  at most 200 waiting (a question past it is told "Too many questions are waiting. Try again in a minute.").

### Its RPC

- `install()`, `connectInstall(install)`: `ok`, or `taken` (another knowledgebase's); `forget()`: everything but
  the seen keys; `noteServiceUrl(url)` (Teams).
- `seen(key, now)`: true when seen inside `REPLAY_KEEP_MS` (and records it either way).
- `linkOf(user)`, `startLink(user, userName, now)` → the nonce; `pendingLink(user, nonce, now)`,
  `completeLink(user, nonce, person, now)`: `ok`, `expired`, `full`; `unlink(user)`.
- `queue(kind, body, now)`: `queued` or `full`, and arms the alarm at once.
- `keepAnswer(id, user, body, now)`, `takeAnswer(id, user, now)` (the answer's JSON, once, its asker's alone).
- `putCode(knowledgebase, person, expires)`, `takeCode(now)` (the `code:` instances).
- `connections()`, `writeConnection(row)` (answers the connection it replaced on that platform, for the caller to
  forget), `dropConnection(platform, workspace?)` (the `kb:` instances).
- `previewLink({knowledgebase, tab, person})`: a page's preview, for Teams, which waits for it in the invoke.
- `alarm()`: runs up to `CHAT_JOBS_A_TURN` (3) jobs, oldest first, each with up to 2 tries (`CHAT_JOB_TRIES`),
  then sweeps expired rows, and arms itself again while work waits. A workspace with no install answers nothing:
  its questions and previews are dropped; only its notices are sent.

## The api's routes

Before identity (index.ts, beside `hooks`), each body read through the 64 KiB cap (`CHAT_BODY_MAX`):

- `POST /api/chat/slack/commands`: the signature on the raw body, then the replay key (`trigger_id` with the team,
  user and text), then: no install for `team_id` → the not-connected notice; `help` or empty → help; `unlink` →
  forgets the link; else `queue('slack-ask', …)` and the ephemeral "Looking that up in the knowledgebase…". The job
  answers an unlinked person with the Connect prompt alone.
- `POST /api/chat/slack/events`: the signature first, then `url_verification` answers its `challenge`;
  `event_callback` is de-duplicated by `event_id`, then: `app_mention` (the app's mention taken out) and a direct
  `message` (`channel_type: 'im'`, no `bot_id`, no `subtype`) are questions as above, answered by
  `chat.postEphemeral`, or by `chat.postMessage` in a direct message; `link_shared` queues `slack-unfurl`;
  `app_uninstalled` and `tokens_revoked` drop the connection and forget the workspace. Always `200`.
- `POST /api/chat/slack/interactions`: the signature, then `block_actions` with `share_answer`:
  `takeAnswer(value, user)` posts it through the interaction's `response_url` as `in_channel`, headed "Shared by
  <@user>", and deletes the private copy; gone or someone else's, an ephemeral "This answer can no longer be shared".
- `GET /api/chat/slack/oauth?code&state`: the state (signed, 10 minutes, `{k: 'slack-install', kb, person}`),
  `oauth.v2.access` (an Enterprise Grid org-wide install refused), `connectInstall`, then the `kb:` instance's
  `writeConnection` (a workspace it replaces is forgotten, its token revoked). Redirects to
  `<app>/document/<kb>?chat=connected|taken|failed|denied`, which opens the dialog with that word.
- `POST /api/chat/teams/messages`: the Bot Framework token (its `serviceurl` the activity's own, on a Teams host),
  then the replay key (the activity's `id`), then by type: `message` (its `<at>` mention and markup taken out):
  `connect <code>` (the code's instance taken once, `connectInstall`, `writeConnection`, "Connected."), `help`,
  `unlink`, a question (`queue('teams-ask', …)`; a channel or group question is answered in the personal chat and
  the channel told "I sent you the answer in a private chat."); `invoke` `composeExtension/queryLink`: the preview
  (or, unlinked, an `auth` answer with the Connect link) in the response; anything else `200` with nothing.

After identity:

- `GET /api/chat/link?code=`: `{platform, workspace, userName}` (`ChatLinkPreview`) or `410 link_expired`. Anyone
  holding the code may read it, as the page shows it before signing in.
- `POST /api/chat/link {code}`: a signed-in account's (a guest, a token or a workbench session is `401
sign_in_required`): `completeLink` → `{platform, workspace}`, `410 link_expired`, `409 links_full`.

### The knowledgebase's routes (room, Editor of the whole knowledgebase, signed in, not an API token)

- `GET /api/documents/{id}/chat` → `KnowledgeChatApps`: `{slack: {offered, connection}, teams: {offered, connection,
appLink}}`, `connection` `{name, connectedAt}` or null.
- `POST /api/documents/{id}/chat/slack` → `{url}`, Slack's authorize address with the signed state.
- `POST /api/documents/{id}/chat/teams` → `{code, expiresAt}`, the code's instance written.
- `DELETE /api/documents/{id}/chat/<platform>` → the new `KnowledgeChatApps`: the connection dropped, the workspace
  forgotten (Slack's token revoked first).
- A Participant, a Viewer, a token or a link is `403 forbidden`; `503 chat_unavailable` unconfigured.

## Asking (chat-answer.ts, chat-as-person.ts)

1. The person's teams now (`createTeamAccess().currentTeams`), then the index's grant for them on the knowledgebase,
   asked with this app's key as the person (`requestGrant` with the delegate caller, then `verifyGrant`); none is
   "can't open".
2. The room's `route(new Request('/api/documents/<kb>/ask', {POST, {question}}), identity)`, the identity
   `{accountUserId: person, verifiedUserId: person, owner: person, token: null, workbench: null, teams: null,
bearer: null, grant}`. With no bearer, `askerOf` is null, so only the knowledgebase's key or built-in AI answers
   (search-and-ask.md "Which key answers"), and Sources read nothing. A grant confined to one page is refused by Ask
   itself (it reads the whole knowledgebase).
3. A JSON refusal is said in its `message`; the stream is read with `readEvents` to its `done` or `error`.
4. `done` becomes a `ChatAnswer`: `answerParts(text, cited)`, each page source's link
   (`<app>/document/<kb>#t=<tab>`), its trust and health, the trust line, the gaps and their note, which AI.
5. A preview reads `GET .../pages/<tab>?maxChars=1200` and `.../health` as the paster: title, the first 300
   characters as plain text, the owner's name, the trust. Only the connected knowledgebase's links are previewed.

## Constants

| Constant              | Value     | Why                                                                     |
| --------------------- | --------- | ----------------------------------------------------------------------- |
| `CHAT_STATE_TTL_MS`   | 600,000   | an install takes a minute or two at Slack                               |
| `CHAT_LINK_TTL_MS`    | 1,800,000 | spec: 30 minutes                                                        |
| `CHAT_CODE_TTL_MS`    | 900,000   | spec: 15 minutes                                                        |
| `CHAT_ANSWER_KEEP_MS` | 1,800,000 | spec: Share in Channel for 30 minutes (Slack's `response_url` lasts 30) |
| `CHAT_LINKS_MAX`      | 5,000     | a large company's Slack                                                 |
| `CHAT_JOBS_MAX`       | 200       | ten minutes of a busy workspace                                         |
| `CHAT_JOBS_A_TURN`    | 3         | each may wait on the model 60 s                                         |
| `CHAT_JOB_TRIES`      | 2         | one retry for a dropped room call                                       |
| `CHAT_BODY_MAX`       | 65,536    | Slack's and Teams' requests are a few KiB                               |
| `CHAT_SEEN_MAX`       | 5,000     | `REPLAY_KEEP_MS` of a busy workspace                                    |
| `CHAT_ANSWERS_MAX`    | 200       | the answers kept for Share in Channel                                   |
| `CHAT_UNFURLS_MAX`    | 5         | links previewed in one message                                          |
| `TEAMS_POLL_MS`       | 5,000     | the dialog's look while a code shows                                    |

## Security and trust

- Every Slack and Teams request is checked before its body is parsed for anything but its signature's needs; a
  failed check is `401` with no body, logged `[chat] refused` with the platform and the check's name.
- A knowledgebase id from a request is never trusted: it is the install's, and a link's preview is refused for any
  other knowledgebase.
- Only the install's callback and the Teams code write a connection; no route takes one from a request.
- A chat user's identity is the workspace's word for it (Slack's signed `user_id`, Teams' verified activity), never
  a name. A link binds `(workspace, user)` to the account that completed it with a code only that user was shown.
- Nothing from a page goes anywhere but the asker unless they press Share; a preview is the paster's access.
- Logs carry the platform, the outcome and counts; never a token, a question, a name or an id but the knowledgebase's.

## Observability

`[chat] refused {platform, check}`, `[chat] ask {platform, outcome, cited, gaps}`, `[chat] connect {platform,
outcome}`, `[chat] disconnect {platform}`, `[chat] link {platform, outcome}`, `[chat] unfurl {platform, outcome}`,
`[chat] job failed {kind, tries}`.

## Tests

- `@liveworkspace/chat`: its blueprint's list.
- The api, `chat/*.test.ts`: a Slack command with a bad, stale, missing and replayed signature refused or ignored;
  an unlinked user gets only the Connect prompt; `/ask unlink` forgets; the OAuth callback with a forged, expired or
  non-Editor state refused, a taken workspace refused; Teams activities with a bad token refused, `connect` with a
  wrong, expired and good code; a linked **Viewer** answered only from pages a Viewer reads (a page confined away
  from them is never a source), a person with no access told so, a **disconnected** workspace answering nothing;
  the answer's blocks carry sources, trust and links and no raw Markdown link; a gap reaches `knowledge_questions`;
  the preview's owner, excerpt and trust, and none for an unlinked paster or another knowledgebase.
- The room's chat routes: an Editor lists, starts and disconnects; a Participant and a Viewer are refused.
- The editor: the dialog's rows (unconfigured, ready, connected), Connect Slack's redirect, the Teams code and its
  Copy, Disconnect's confirm, a failure's words; the link page signed out, ready, connected and expired.
