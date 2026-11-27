# Slack and Teams blueprint

Implements [chat-apps.md](../chat-apps.md) over the platform's `@liveworkspace/chat`
([liveworkspace/docs/specs/023-chat-apps](../../../../../liveworkspace/docs/specs/023-chat-apps/chat-apps.md)).

## Where it lives

- **The api Worker's `src/chat/`** answers Slack and Teams, before identity (their own signatures, never a person),
  and the account link page's two calls, after it (a signed-in account).
- **`ChatWorkspace`**, a new SQLite Durable Object class (binding `CHAT_WORKSPACE`, migration `v3`), one instance a
  workspace, named `slack:<team id>` or `teams:<tenant id>`, holds that workspace's install, linked people, pending
  links, kept answers, seen request keys and queued work. A Teams connect code is its own instance, `code:<CODE>`,
  holding the one code. Nothing in it is a knowledgebase's content.
- **The knowledgebase's room** keeps which workspaces it is connected to (`chat_connections`, step V47), for the
  dialog to list and disconnect, and answers the chat's two reads: Ask (`POST .../ask`, the route the editor calls)
  and a page's preview (`chatPreview`, an RPC).

## Domain and naming

| Term            | Identifier                                                   |
| --------------- | ------------------------------------------------------------ |
| platform        | `ChatPlatform`: `'slack' \| 'teams'`                          |
| workspace       | a Slack team id (`T…`) or a Teams tenant id (a GUID)         |
| install         | the `install` row of a `ChatWorkspace`                       |
| connection      | a `chat_connections` row of the knowledgebase's room         |
| chat user       | a Slack user id (`U…`) or a Teams `aadObjectId`              |
| link            | a `links` row: chat user to liveworkspace account (`user_…`) |
| connect code    | a Teams code, `XXXX-XXXX` (Crockford base32, 10 characters)  |
| link code       | the `/chat/link?c=` value, signed                            |

## Secrets and settings (`Env`)

| Name                   | Kind   | What                                                                 |
| ---------------------- | ------ | -------------------------------------------------------------------- |
| `CHAT_KEY`             | secret | 32 bytes, base64: seals bot tokens, signs states and link codes      |
| `SLACK_CLIENT_ID`      | var    | the Slack app's client id (public)                                   |
| `SLACK_CLIENT_SECRET`  | secret | the Slack app's client secret, for `oauth.v2.access`                 |
| `SLACK_SIGNING_SECRET` | secret | Slack's signing secret                                               |
| `TEAMS_APP_ID`         | var    | the Azure bot's Microsoft App ID (public)                            |
| `TEAMS_APP_PASSWORD`   | secret | the bot's client secret                                              |
| `TEAMS_APP_TENANT`     | var    | the bot's tenant for its token; unset is `botframework.com`          |
| `TEAMS_APP_LINK`       | var    | where **Open Teams** goes (the app's Teams deep link); unset: no link |

Slack is offered when `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` and `CHAT_KEY` are set; Teams
when `TEAMS_APP_ID`, `TEAMS_APP_PASSWORD` and `CHAT_KEY` are (`chatConfigured(env, platform)`). Unset, the routes
answer `503 chat_unavailable` and the dialog's row says "Not set up on this server".

## Files

| File                                            | Holds                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| `apps/api/src/chat/chat-config.ts`              | `chatConfigured`, `chatKeysOf(env)` (the derived keys, once an isolate)               |
| `apps/api/src/chat/chat-routes.ts`              | `handleChatHooks` (Slack, Teams), `handleChatLink` (the link page's calls)            |
| `apps/api/src/chat/slack-commands.ts`           | `/ask`: verify, parse the form, help, unlink, the prompt or the queued question       |
| `apps/api/src/chat/slack-events.ts`             | `url_verification`, `app_mention`, `message.im`, `link_shared`, `app_uninstalled`     |
| `apps/api/src/chat/slack-interactions.ts`       | the Share in Channel button                                                           |
| `apps/api/src/chat/slack-oauth.ts`              | the install's start (`slackInstallUrl`) and its callback                              |
| `apps/api/src/chat/teams-messages.ts`           | a Teams activity: connect, help, unlink, a question, a link to preview                |
| `apps/api/src/chat/chat-questions.ts`           | `askAsLinked`: grant, the room's Ask, the stream read into a `ChatAnswer`             |
| `apps/api/src/chat/chat-preview.ts`             | `pageLinkOf(url, origin)` and `previewAsLinked`                                       |
| `apps/api/src/chat/chat-access.ts`              | `linkedAccess(env, person, kb)`: the person's teams now, then the index's grant       |
| `apps/api/src/chat/chat-words.ts`               | every sentence the chat apps say                                                      |
| `apps/api/src/chat/chat-workspace.ts`           | the `ChatWorkspace` class: its RPC and its alarm                                      |
| `apps/api/src/chat/chat-workspace-store.ts`     | its tables and statements                                                             |
| `apps/api/src/chat/chat-jobs.ts`                | the queued work the alarm runs: `ask`, `unfurl`, `teams-ask`                          |
| `apps/api/src/knowledge/chat-connections.ts`    | the room's `chat_connections` step and statements, `chatPreviewOf`                    |
| `apps/api/src/routes/knowledge-chat-routes.ts`  | `GET chat`, `POST chat/{platform}`, `DELETE chat/{platform}`                          |
| `apps/editor/components/chat-apps/*`            | the dialog, its rows, the Teams code card, the art, the words                         |
| `apps/editor/lib/chat-apps/*`                   | the dialog's open state, the api client                                               |
| `apps/editor/app/chat/link/*`                   | the account link page                                                                 |

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
```

- `token` is `seal(chatKey, '<platform>:<workspace>', botToken)`; Teams keeps no token (the bot's is minted from the
  app's credentials) but keeps `service_url`, the last checked activity's.
- `pending_links.nonce` is the SHA-256 of the link code's nonce: the code itself is never stored.
- Bounds: `links` and `pending_links` at most `CHAT_LINKS_MAX` (5,000) rows each, the oldest pending going first and
  a link past the cap refused (`chat_links_full`); `answers` at most 200, `seen` at most 5,000 (oldest first), `jobs`
  at most 200 waiting (a question past it is told "Too many questions are waiting. Try again in a minute.").

### Its RPC

- `install()`, `connect(row)`: `ok`, `taken` (another knowledgebase); `disconnect(knowledgebase)`: forgets
  everything when the install is that knowledgebase's (revoking Slack's token first), else nothing.
- `seen(key, now)`: true when already seen (and records it).
- `linkOf(user)`, `startLink(user, userName, now)` → the nonce; `previewLink(user, nonce, now)`,
  `completeLink(user, nonce, person, now)`: `ok`, `expired`, `full`; `unlink(user)`.
- `queue(kind, body, now)`: `queued` or `full`, and arms the alarm at once.
- `keepAnswer(id, user, body, now)`, `takeAnswer(id, user, now)`.
- `putCode(row)`, `takeCode(now)` (the `code:` instances).
- `alarm()`: runs up to `CHAT_JOBS_A_TURN` (3) jobs, oldest first, each with up to 2 tries
  (`CHAT_JOB_TRIES`), then sweeps expired rows, and arms itself again while work waits.

## The api's routes

Before identity (index.ts, beside `hooks`), each body read through the 64 KiB cap (`CHAT_BODY_MAX`):

- `POST /api/chat/slack/commands`: the signature on the raw body, then the replay key (`trigger_id`), then:
  no install for `team_id` → the not-connected notice; `help` or empty → help; `unlink` → forgets the link; not
  linked → the prompt (`startLink`); else `queue('ask', {responseUrl, user, channel, question, via: 'command'})` and
  the ephemeral "Looking in <kb>…". Always `200` with an ephemeral body.
- `POST /api/chat/slack/events`: the signature first, then `url_verification` answers its `challenge`;
  `event_callback` is de-duplicated by `event_id`, then: `app_mention` (the bot's mention taken out) and a direct
  `message` (`channel_type: 'im'`, no `bot_id`, no `subtype`) are questions as above, answered by
  `chat.postEphemeral` in the thread (`thread_ts`), or by `chat.postMessage` in a direct message; `link_shared`
  queues `unfurl`; `app_uninstalled` and `tokens_revoked` disconnect. Always `200`.
- `POST /api/chat/slack/interactions`: the signature, the replay key, `block_actions` with `share_answer`:
  `takeAnswer(value, user)` posts it through the interaction's `response_url` as `in_channel`, headed "Shared by
  <@user>"; gone, an ephemeral "This answer has expired. Ask again to share it.".
- `GET /api/chat/slack/oauth?code&state`: the state (signed, 10 minutes, `{kb, person, nonce}`), the person still
  an Editor of the whole knowledgebase (the index's grant for them), `oauth.v2.access`, `connect`, then the room's
  `recordChatConnection`. Redirects to `<app>/document/<kb>?chat=connected|taken|failed|denied` (`denied` when Slack
  sent `error`), which opens the dialog with that word.
- `POST /api/chat/teams/messages`: the Bot Framework token, then the replay key (the activity's `id`), then by type:
  `message` (the bot's `<at>` mention taken out): `connect <code>` (the code's instance taken, its person still an
  Editor, `connect`, `recordChatConnection`, the answer "Connected to <kb>."), `help`, `unlink`, a question
  (`queue('teams-ask', …)` and `200` at once; a channel or group question is answered in the personal chat);
  `invoke` `composeExtension/queryLink`: the preview answered in the response, within the request; anything else
  `200` with nothing.

After identity (a signed-in account; a guest, a token or a link visitor is `401 sign_in_required`):

- `GET /api/chat/link?c=<code>`: `{platform, workspaceName, userName, knowledgebaseName}` or `410 link_expired`.
- `POST /api/chat/link {code}`: `completeLink` → `{platform, workspaceName, knowledgebaseName}`, `410
  link_expired`, `409 chat_links_full`. Under the write limiter as any write.

### The knowledgebase's routes (room, Editor of the whole knowledgebase, signed in, not an API token)

- `GET /api/documents/{id}/chat` → `KnowledgeChatApps`: `{slack, teams}`, each `{configured, connection: {workspace,
  name, connectedAt} | null}`.
- `POST /api/documents/{id}/chat/{platform}`: Slack → `{url}`, Slack's authorize address with the signed state; Teams
  → `{code, expiresAt, teamsUrl}` (the code's instance written). `409 chat_connected` when that platform is already
  connected; `503 chat_unavailable` unconfigured.
- `DELETE /api/documents/{id}/chat/{platform}` → `204`: the row removed, then the workspace's `disconnect(kb)`.
- A Participant, a Viewer, a token or a link is `403 forbidden`.

### The room's RPC

- `recordChatConnection(kb, {platform, workspace, name, connectedBy, connectedAt})`: upserts the row.
- `chatPreview(kb, access, tab)`: `access` is the linked person's grant level and tab scope as the worker read it;
  answers `{title, excerpt, owner, trust, url}` for a page they can read, else null. The excerpt is the page's
  writing as plain text, first `CHAT_PREVIEW_EXCERPT_MAX` characters.

## Asking (chat-questions.ts)

1. `linkedAccess(env, person, kb)`: `currentTeams(accountsTeamReader(credentials), person, null)`, then
   `resolveItemGrant` with the delegate caller `{person, teams}`; null is "can't open".
2. The room's `route(kb, new Request('<app>/api/documents/<kb>/ask', {POST, {question}}), identity)`, the identity
   `{accountUserId: person, verifiedUserId: person, owner: person, token: null, workbench: null, teams, bearer:
   null, grant}`. With no bearer, `askerOf` is null, so only the knowledgebase's key or built-in AI answers
   (search-and-ask.md "Which key answers"); with `bearer` null, Sources read nothing.
3. A JSON refusal is said in its `message`; the stream is read with `readEvents` to its `done` or `error`.
4. `done` becomes a `ChatAnswer`: `answerParts(text, cited)`, each source's page link
   (`<app>/document/<kb>#t=<tab>`), its trust and health, the gaps, the AI's name.

## Constants

| Constant                   | Value     | Why                                                  |
| -------------------------- | --------- | ---------------------------------------------------- |
| `CHAT_STATE_TTL_MS`        | 600,000   | an install takes a minute or two at Slack            |
| `CHAT_LINK_TTL_MS`         | 1,800,000 | spec: 30 minutes                                     |
| `TEAMS_CODE_TTL_MS`        | 900,000   | spec: 15 minutes                                     |
| `CHAT_ANSWER_KEEP_MS`      | 1,800,000 | spec: Share in Channel for 30 minutes (Slack's `response_url` lasts 30) |
| `CHAT_LINKS_MAX`           | 5,000     | a large company's Slack                              |
| `CHAT_JOBS_MAX`            | 200       | ten minutes of a busy workspace                      |
| `CHAT_JOBS_A_TURN`         | 3         | each may wait on the model 60 s                      |
| `CHAT_JOB_TRIES`           | 2         | one retry for a dropped room call                    |
| `CHAT_BODY_MAX`            | 65,536    | Slack's and Teams' requests are a few KiB            |
| `CHAT_SEEN_MAX`            | 5,000     | `REPLAY_KEEP_MS` of a busy workspace                 |
| `TEAMS_CODE_POLL_MS`       | 5,000     | the dialog's look while a code shows                 |

## Security and trust

- Every Slack and Teams request is checked before its body is parsed for anything but its signature's needs; a
  failed check is `401` with no body, logged `[chat] refused` with the platform and the check's name.
- A knowledgebase id from a request is never trusted: it is the install's, and a link's preview is refused for any
  other knowledgebase.
- Only the room writes `chat_connections`, from the RPC the worker calls after `connect`; no route takes one.
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
