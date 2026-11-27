# Chat apps

Status: **built, not yet seen in a real Slack or Teams workspace** (Work Tracker 1342). The payloads are rendered
from the builders in tests and a local preview; the apps' registration is the owner's.

A **chat app** is a Slack app or a Microsoft Teams bot that an app's item can be connected to, so people ask it
questions and paste its links where they already talk. It is not a [connection](../004-index/webhooks.md): a
connection is an address an item's rules post _to_; a chat app is installed in a Slack workspace or a Teams tenant,
hears commands, mentions and links _from_ it, answers as the person who asked, and needs that person's own access.
The two share their message formatting and their escaping, which live once in `@liveworkspace/chat`.

liveknowledge is the first app with one ([liveknowledge/docs/specs/030-knowledgebase/chat-apps.md](../../../../liveknowledge/docs/specs/030-knowledgebase/chat-apps.md)):
ask the knowledgebase from chat. What every app's chat app holds to is here; what it answers is the app's.

## What the platform gives

`@liveworkspace/chat`, pure, Web APIs only, no app's words:

- **Slack's request check**: the `v0` signature, an HMAC-SHA256 of `v0:<timestamp>:<raw body>` under the app's
  signing secret, compared in constant time, and a timestamp more than **5 minutes** from now refused, so a captured
  request cannot be sent again later. A request that fails says only that it failed, and logs which check.
- **Teams' request check**: the Bot Framework's bearer token, an RS256 JWT verified against the Bot Framework's
  published keys (kept for a day, fetched again for a key it does not know), with the issuer
  `https://api.botframework.com`, the audience the app's id, its `serviceurl` claim the activity's own `serviceUrl`,
  and its times within **5 minutes** of skew. Nothing else in the activity is trusted until it passes.
- **Replay**: inside the window a request can still arrive twice (Slack retries, a captured request sent at once).
  Each request names a key (Slack's `event_id`, a command's `trigger_id`, an interaction's `trigger_id`, a Teams
  activity's `id`), and the app keeps the keys it has seen for twice the window; a key seen before is answered
  `200` and does nothing.
- **Escaping**: Slack's three control characters (`&`, `<`, `>`) in every text Slack reads as markup, and text cut
  at a whole character, never inside an escape (`slackEscape`, `slackCut`, which the connections' Slack messages use
  too). Teams text is a plain `TextRun` in a `RichTextBlock`, which Teams never reads as Markdown.
- **No outside links**: an answer is other people's writing and a model's. Its text is sent with Slack's
  `verbatim: true`, so an address in it is never turned into a link, and the only links in a message are the
  ones the app builds (its own pages, on its own origin).
- **The builders**: an answer (the question, the answer with its citation numbers, its sources with their trust,
  what it did not cover, and what answered), a link's preview, a notice, and the prompt to connect an account, each
  as Slack blocks and as a Teams Adaptive Card. Slack's limits are held: at most 50 blocks, a section's text at
  most 3,000 characters, a button's value at most 2,000.
- **The calls out**: Slack's `oauth.v2.access`, `chat.postEphemeral`, `chat.postMessage`, `chat.unfurl`,
  `auth.revoke` and a `response_url`; the Bot Framework's token (client credentials) and its
  `v3/conversations` routes. Each with a 10-second bound, no redirect followed, and only to Slack's
  (`slack.com`, `hooks.slack.com`) or the activity's own checked `serviceUrl`.
- **Signed state**: an install's `state` and an account link's code are signed with a key derived from the app's
  chat key, carry an expiry, and are checked in constant time.

## What each app holds to

- **One install per workspace.** A Slack workspace (its team id) or a Teams tenant is connected to at most one of the
  app's items at a time. Connecting it to another is refused until it is disconnected there.
- **Answers as the asker.** A chat user is nobody to liveworkspace until they **link** their account once: the first
  time they ask, the app answers only with a private **Connect Your Account** prompt, whose link opens a page of the
  app where they sign in and confirm. After that every answer uses that account's own access to the item, read from
  the index for each question (the account's teams read fresh from accounts), never the access of the person who
  connected the workspace. Someone who cannot open the item is told so and given nothing from it.
- **Private by default.** Whatever is drawn from the item goes only to the asker: Slack's ephemeral messages, a
  Teams personal chat. Putting an answer where others read it is the asker's own choice (Share in Channel), as
  copying it would be. A link's preview is drawn with the access of whoever pasted it, and only when they are
  linked and can open it.
- **Disconnect forgets.** Disconnecting removes the install, the bot token (revoked at Slack), every linked account
  and everything waiting; a disconnected workspace answers nothing from the item. Uninstalling the app from Slack
  does the same.
- **Tokens are secrets.** A bot token is sealed at rest (AES-GCM under the app's chat key, the workspace bound in as
  additional data, `@liveworkspace/api-kit/sealed`), never logged, never sent to a browser.
- **Fast acknowledgement.** Slack wants an answer to a command in 3 seconds and Teams in 15: the request is checked,
  acknowledged and the work queued; the answer follows from the app's own background work, never inside the
  request.
- **Costs follow the app's AI rules.** A chat question is a question from the linked person, under the app's own
  limits and its AI key rules for a request made without the person's own sign-in token.

## Not built

- Automations posting through a connected chat app (a rule's Post to Slack through the bot rather than an
  incoming webhook).
- Enterprise Grid org-wide installs; Slack Connect channels shared from another organisation answer nothing.
- The apps' listings in the Slack App Directory and the Teams store: owner steps.
