# GitHub pull requests

A plan that builds software links its cards to the **pull requests** that build them. A card shows each linked pull
request's state (open, draft, checks passing or failing, merged, closed), and the plan's
[Automations](automations.md#github-triggers) act when a linked pull request opens, merges, closes or its checks finish
(move the card, assign it, comment on it), so nobody moves cards by hand when the code lands. It is liveplanner's first connector to
another tool, brought forward from Later by the owner (2026-11-11, [Product scope](../002-project-scope/product-scope.md#non-goals)).
The engineering detail is [blueprints/github-pull-requests.md](blueprints/github-pull-requests.md).

It is built in parts (Work Item 157):

1. **The Pull Request field kind** and how a card names its pull requests (a Pull Request field, a Link field holding
   a pull request's address, or a pull request naming the card), read in pure code, with no call to GitHub. Built.
2. **The GitHub App's webhook receiver and the repository connection**, off while its secrets are absent. Built
   (the server side; the dialog that drives it is part 4).
3. **Pull request state on cards**, and moves made by GitHub in card history. Built.
4. **GitHub in Automations**: the GitHub triggers, connecting and managing the connection from the Automations screen,
   the help article and telemetry. Built. It replaced part 3's two fixed column rules (the owner, 2026-11-12: "surface
   the GitHub Integration via the Automation screen instead of the settings"): no screen ever set them, so nothing was
   migrated.

Until a part is built, what it describes below is the design it is built to.

## Why

The Work Tracker links each card to its pull request with a Link field, and someone moves the card when the pull
request merges. Every team that builds software does the same chore. Linking the card to GitHub properly shows the
pull request's state where the team plans, and moves the card the moment the code lands.

## Domain language

| Term                    | Means                                                                                             | Never called                |
| ----------------------- | ------------------------------------------------------------------------------------------------- | --------------------------- |
| **pull request**        | One GitHub pull request, named by its repository and number (`acme/web#42`)                       | PR (in copy), merge request |
| **Pull Request field**  | A card field of kind `pullrequest` holding one pull request's address                             | GitHub field, PR link       |
| **linked pull request** | A pull request a card names: in a Pull Request field, a Link field, or the pull request naming it | attached PR                 |
| **card mention**        | A pull request's title or body naming a card as "{plan name} #{number}" ("Work Tracker #143")     | magic word, keyword         |
| **GitHub connection**   | A plan's link to liveplanner's GitHub App: the installation and the repositories chosen from it   | integration (in copy), sync |
| **pull request state**  | Draft, Open, Checks Running, Checks Passing, Checks Failing, Merged or Closed                     | status (that is the card's) |
| **GitHub trigger**      | An Automations trigger a linked pull request starts: opened, merged, closed, checks finished      | GitHub rule, hook           |
| **GitHub**              | Who a GitHub-triggered rule's changes are by, in card history, with the rule's name beside it     | bot, system, webhook        |

## The Pull Request field

A **Pull Request** field (kind `pullrequest`) holds one pull request's address. It is in the type editor's Add Field
gallery under **Links and Images**, after Link, described as "A GitHub pull request, with its state". A card that
builds in several pull requests uses several fields, or a Pull Request field and Link fields
([below](#how-a-card-names-its-pull-requests)).

- **Stored** as the pull request's canonical address, `https://github.com/{owner}/{repo}/pull/{number}`, keeping
  the owner's and repository's case as given.
- **Typed or pasted**, the field takes any address of the pull request: with or without `https://` or `http://`,
  `www.`, a page after the number (`/files`, `/commits`, `/checks`), a query, a `#` fragment or a trailing slash.
  Each is kept as the canonical address. An owner is 1 to 39 letters, digits and hyphens; a repository 1 to 100
  letters, digits, `.`, `-` and `_` (never `.` or `..` alone); a number a whole number from 1, at most 10 digits,
  with no leading zero. Anything else is refused ("Paste a pull request's address, like
  https://github.com/acme/web/pull/42"), as a Link that is not `https://` is: the panel puts the box back, Add
  Field's Try It says why, and an agent is told the same.
- **Read** as its short name, `{owner}/{repo}#{number}` (`acme/web#42`), on the card face, its spoken label and
  images. The CSV download and agents carry the canonical address, so a file read back in links the same
  pull request (an import reads any address of one, as the panel does).
- **The card panel** edits it in an address box (`type="url"`, placeholder
  `https://github.com/owner/repo/pull/123`) with an **Open on GitHub** button after it (a new tab, no referrer),
  for anyone who can see the card.
- **The card face** shows the short name with the field's glyph, as any custom value pill (part 3 adds the state).
- It may be [required](item-types.md#required-fields); like Link, it neither sorts a board nor lays swimlanes.
- **Changing kind** keeps a value only when it is a pull request: a Text or Link holding a pull request's address
  becomes the field's canonical value; a Pull Request field changed to Text or Link keeps the address.
- **No form question** fills it, as Link to Card has none.
- **It calls nothing.** The field is an address until the plan has a GitHub connection: nothing reaches GitHub
  from a viewer, the editor or the api because a card holds one.

## How a card names its pull requests

A card's **linked pull requests** are, in this order, with each pull request counted once (by owner, repository and
number, case aside), up to 10 (`LINKED_PULL_REQUESTS_MAX`):

1. every Pull Request field's value, in the type's field order;
2. every Link field whose value is a pull request's address (so the Work Tracker's existing Link fields link without
   being retyped);
3. once the plan is connected, every pull request from a connected repository whose title or body holds a
   **card mention**.

A **card mention** is the plan's name, then spaces or none, an optional `#`, then the card's number, with no letter
or digit on either side: "Work Tracker #143", "work tracker 143" and "(Work Tracker #143)" name card 143 of the plan
called Work Tracker; "Work Trackers #143" and "Work Tracker #1430" do not name card 143. The name compares as names
do (case and repeated spaces aside). Only the first 65,536 characters of a body are read (`MENTION_TEXT_MAX`), and
a pull request names at most 20 cards (`MENTIONS_MAX`). A mention matches only in plans connected to that
pull request's repository, never in another plan of the same name.

## The GitHub connection

### The App

liveplanner has its **own GitHub App** (the owner's answer, 2026-11-11: an App owned by liveplanner alone, not one
shared by the platform). It asks for the narrowest permissions the feature needs, all read-only: **Pull requests:
Read**, **Checks: Read** and **Metadata: Read** (GitHub's mandatory one). It subscribes to `pull_request`,
`check_suite` and `installation_repositories` events (GitHub sends every App its `installation` events too). It writes nothing to GitHub.

The App's settings are the api's secrets and one binding: `GITHUB_APP_ID`, `GITHUB_APP_SLUG`,
`GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET` and the
`GITHUB_LINKS` KV namespace. **Missing any one, the feature is off**: the plan shows no GitHub entry, the webhook
route answers 404, and nothing logs an error. Pull Request fields still read and open as addresses.

### Connecting a repository

- **Who**: a signed-in Editor of the whole plan (the owner, the plan's team, a whole-plan Editor link), as the plan's
  webhooks are: never an API token, a workbench session, a guest, a Participant, a Viewer or a link to one tab. A
  plan in Browser Storage has no connection (deliveries reach the server, not a browser).
- **Where**: the Automations screen's **GitHub** view ([Automations](automations.md#github-triggers)), reached from
  the screen's header, from the GitHub group of Pick a Trigger, and from a GitHub trigger's panel in the builder.
- **How**: the GitHub view asks the api to start a connection, and the api answers the App's install page
  with a one-time **state** naming the plan (kept by the plan, as a hash, for 10 minutes, `CONNECT_STATE_TTL_MS`).
  On GitHub the person installs the App (or opens an installation they already have) and chooses its repositories;
  GitHub sends them back to the api's callback with the installation and a code. The state is spent first, once,
  whatever follows. The api then asks GitHub, as that person, once, which of the installation's repositories they
  can reach (GitHub's user authorisation of the App), and connects the plan only when the installation is one they
  can reach. It asks GitHub, as the App, that the installation is the App's own and not suspended. The person's
  GitHub token is used for those calls and revoked at GitHub straight after: **no personal GitHub token is
  stored**, ever. The callback sends the person back to the plan (`#github=connected`, `#github=failed`, or
  `#github=requested` when an organisation's owner must approve the install first).
- **Which repositories**: the plan keeps the repositories the person could reach in the installation, every one of
  them, read from GitHub 100 a page (`INSTALLATION_REPOSITORIES_LISTED`) up to 10 pages
  (`REPOSITORY_PAGES_MAX`, 1,000 repositories). When there are at most 20 (`REPOSITORIES_MAX`), every one of them
  connects; with more, none does until an Editor chooses. An Editor may change the chosen ones later, from that
  list only, up to 20; each choice is checked against the installation again (as the App, with an installation
  token made for that one call and never kept), so a repository the installation no longer sees never joins. A
  repository already connected to 20 plans (`PLANS_PER_REPOSITORY_MAX`) is not chosen.
- **What is kept**: the installation's id and account name, each repository the person could reach (its id,
  `owner/name` and whether it is private) and whether it is chosen, who connected it (as a card's history names a
  person) and when. (Part 3 kept two column rules here; part 4 dropped them: the `rules` column stays empty.)
- **Private repositories**: a pull request's title and state reach everyone who can see the card, public share links
  included. Connecting a private repository to a plan that has a public link says so first ("Anyone with this plan's
  link will see these pull requests' titles and states").
- **Disconnecting** (any Editor who may connect, after an in-app **Disconnect GitHub?** confirm) drops the connection
  and the state it holds; the cards' fields stay as addresses, and the plan's GitHub-triggered rules stay, hearing
  nothing until it connects again. Removing a repository from the installation on GitHub drops it from every plan;
  uninstalling the App drops every plan's connection to it.

### Storage

liveplanner has no D1. The **plan's Durable Object** keeps its own connection and the latest state of each
linked pull request: the source of truth. The **`GITHUB_LINKS` KV namespace** keeps only the reverse index a delivery
needs, one key per pair so two plans connecting at once never overwrite each other: `repo:{repository id}:{plan id}`
for each chosen repository and `installation:{installation id}:{plan id}` for the installation, written from the
plan's object on every connect, choice and disconnect. A delivery lists the keys under its repository (or
installation), then each plan's object checks the delivery's installation and repository against its own connection
before it acts: a stale or forged index entry moves nothing, and an entry a plan disowns is deleted.

### Deliveries

- Every delivery's `X-Hub-Signature-256` is checked, an HMAC-SHA256 of the raw body under `GITHUB_WEBHOOK_SECRET`,
  compared in constant time, **before** the body is parsed. A missing or wrong signature is refused (401) and read no
  further; so is a body over 1 MB (413, `WEBHOOK_BODY_MAX`), declared or read. A missing or malformed signature is
  refused before a byte of the body is read.
- Refused signatures are limited per network (an IPv4 /24 or IPv6 /56): each refusal counts against the network's
  share of the api's write limit, and a network over it is turned away (429 `github_rate_limited`) for a minute
  (`REFUSED_NETWORK_TURNED_AWAY_MS`) before its body is read or hashed. Only refusals count, never a delivery that
  signs right, and GitHub's own webhook addresses are never turned away, so someone else's misconfigured hook
  pointed at the api cannot stop the App's deliveries.
- A delivery acts only on plans whose connection names both its installation and its repository. A pull request
  moves only cards of the plans it is linked to, by field or by mention.
- Each delivery id (`X-GitHub-Delivery`) is acted on once by each plan, which keeps the ids it has seen for 3 days
  (`DELIVERY_KEEP_MS`): GitHub's redelivery of one changes nothing twice. A delivery a plan failed to act on is
  not kept as seen, so GitHub's retry, or a Redeliver from the App's Recent Deliveries, acts on it then.
- What each event does: `ping` (sent when the App is made) is answered and nothing more; `pull_request` and
  `check_suite` reach the plans connected to their repository (part 3 acts on them);
  `installation_repositories` with repositories removed drops them from every plan; `installation` deleted drops
  every plan's connection to it (up to 100 plans, `INSTALLATION_PLANS_MAX`). Any other event is accepted and
  ignored (202). When a plan's object fails, the answer is 502, so GitHub's redelivery reaches it, and the plans that
  took it ignore it.

## Pull request state on cards

A linked pull request's state is the latest the plan's object has seen from deliveries, never fetched by a viewer or
the editor:

| State              | Means                                                                  |
| ------------------ | ---------------------------------------------------------------------- |
| **Draft**          | Open as a draft                                                        |
| **Open**           | Open and ready for review, its checks not reported (or none)           |
| **Checks Running** | Open (or a draft) and a check suite on its newest commit has not ended |
| **Checks Passing** | Open (or a draft) and every check suite on its newest commit passed    |
| **Checks Failing** | Open (or a draft) and a check suite on its newest commit failed        |
| **Merged**         | Merged                                                                 |
| **Closed**         | Closed without merging                                                 |

- **What a delivery keeps.** A `pull_request` delivery from a connected repository keeps the pull request's number,
  title (its first 256 characters), whether it is a draft, open, merged or closed, its newest commit, the cards its
  title or body names ([card mentions](#how-a-card-names-its-pull-requests)), and GitHub's `updated_at`. A
  `check_suite` delivery keeps that suite's result for its commit: running while it has not completed; passing when it
  completed as success, neutral or skipped; failing otherwise (failure, cancelled, timed out, action required, stale).
  A pull request's checks are its newest commit's suites together: Failing when any failed, else Running when any
  runs, else Passing. A new commit starts with no checks until its suites report.
- **Every pull request from a connected repository is kept**, linked to a card or not, so a pull request pasted into
  a field after its delivery shows its state at once. A plan keeps its 500 most recent (`PULL_REQUESTS_KEPT`) and
  the check suites of the last 2,000 commits it heard of (`CHECK_SUITES_KEPT`).
- **Out of order.** GitHub may deliver an older event after a newer one. A pull request keeps its latest `updated_at`:
  a delivery older than what the plan holds changes nothing and moves nothing, so a card never moves backwards. A
  check suite keeps its own latest `updated_at` the same way. A redelivery of a delivery already acted on changes
  nothing ([Deliveries](#deliveries)).
- **The card face** draws each Pull Request field (and each Link field holding a pull request's address) that the
  type's Display places as a pull request pill: the state's GitHub mark in the state's colour, the short name, and,
  for an open pull request whose checks reported, the checks' mark (a tick, a cross, or a dot while running). A
  linked pull request no pill shows (one that names the card, or a field the Display leaves off) shows as its state's
  mark beside the title's flags, up to 3, so a card linked by its mention alone still says where its code stands.
  Each says its short name and state in words to a screen reader and in its tooltip ("acme/web#42: Merged").
- **The card panel** shows the state beside each Pull Request field (a chip in the state's colour, the pull
  request's title after it), and lists under **Pull Requests**, after the fields, every linked pull request a field
  does not hold, each with its mark, short name, state, title and **Open on GitHub**.
- A pull request no delivery has reported (an unconnected plan, a repository not connected, or one that has not
  changed since the plan connected) shows its short name alone, as part 1 drew it.
- **Disconnecting**, or a repository leaving the plan, drops the states it held; every screen drops them at once.

## GitHub triggers

A connected plan's linked pull requests start the plan's [Automations](automations.md#github-triggers): four triggers in
Pick a Trigger's **GitHub** group, each an ordinary rule with any conditions and actions. "Move to In Review when a pull
request opens" and "Move to Done when it merges" are two rules, so a team picks its own columns, adds a label or a
comment, and turns either off, with the Audit Trail saying what each did.

| Trigger                 | Starts when a linked pull request                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| **Pull Request Opened** | opens ready for review, is reopened, or a draft is marked ready for review (a draft is not) |
| **Pull Request Merged** | is closed as merged                                                                         |
| **Pull Request Closed** | is closed without merging                                                                   |
| **Checks Finished**     | has its checks turn Failing (or, picked instead, Passing), open or a draft                  |

- **The cards**: the rule runs once on each card the pull request links ([How a card names its pull
  requests](#how-a-card-names-its-pull-requests)): its Pull Request fields, its Link fields, and the cards its title
  or body names, up to 50 cards a delivery (`RULE_MOVES_MAX`).
- **Once, never backwards**: each delivery is acted on once ([Deliveries](#deliveries)), and a run's id is the
  delivery's and the card's, so GitHub's redelivery runs nothing twice. A delivery older than the state the plan holds
  ([Out of order](#pull-request-state-on-cards)) starts no rule, so a late "opened" never follows a "merged". Checks
  Finished fires when the pull request's checks change into Failing (or Passing), not on each suite that agrees.
- **Which repositories**: a trigger may name some of the repositories the plan hears (none named: every one), so a
  plan connected to several runs a rule for one alone ([Automations](automations.md#github-triggers)).
- **Its values**: a GitHub rule's text may hold `{{pull_request.title}}`, `{{pull_request.number}}` and
  `{{pull_request.url}}`. A private repository's title fills in only in the outgoing messages (Slack, Teams, Your Own
  Service); in anything the plan keeps or emails, it reads the short name, so no copy of it outlives the live state
  ([What a share link sees](#who-may-do-what)).
- **By GitHub**: a GitHub-triggered rule's writes are by **GitHub** in card history (GitHub's mark, "GitHub · Move on
  Merge"), the item panel's footer reads "Edited by GitHub · Move on Merge" with the same mark, and its Who Did It
  (`{{person}}`) reads "GitHub". Nobody is behind it, so it can't check Who Did It or
  assign or email whoever triggered it, as a time trigger can't.
- **Templates**: the Templates gallery's **GitHub** category holds six ready-made GitHub rules
  ([Automations](automations.md#the-automations-screen)): to Review when a pull request opens, to Done when it merges,
  flag failing checks, tell the assignee when checks pass, back to In Progress when one closes unmerged, and post
  merged work to Slack.
- **Off when the App is**: with the App's settings missing, Pick a Trigger shows no GitHub group, the Templates gallery
  no GitHub category and the screen no GitHub entry. A GitHub rule saved before stays, and hears nothing. A plan that is not connected may save one too:
  its trigger panel says to connect first.

## Who may do what

| Role            | The Pull Request field                         | The GitHub connection and rules                                                          |
| --------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Editor**      | Sets, changes and clears it; opens it          | Connects, chooses repositories, disconnects (signed in, whole plan); writes GitHub rules |
| **Participant** | Sets, changes and clears it, as any card field | Sees states and GitHub's moves; never connects or writes rules                           |
| **Viewer**      | Sees it and opens it on GitHub                 | Sees states and GitHub's moves                                                           |

A tab-scoped Editor link may set the field on its tab's cards but never connects the plan, since a connection acts
on the whole plan.

**What a share link sees.** Anyone who can see a card sees its linked pull requests' short names, states and titles,
a public share link's visitor and a Viewer included: that is the warning connecting a private repository gives. A link
to one tab sees the states of its tab's cards' pull requests alone. A Community visitor sees none: a Community post
shows the plan's cards, never what GitHub holds. Nothing else of GitHub reaches a reader: no body, commit, author or
check name. A rule never copies a private repository's title into the plan: its `{{pull_request.title}}` reads the
short name in a comment, a card or an email, so the title shows only while the live state does, and leaves with it on a
disconnect.

## Agents

The plan agents read and set a Pull Request field as its canonical address (`add_field` and `change_card_types` take
the kind `pullrequest`; a value that is not a pull request is refused as `value_invalid` with the field's hint). The
rule tools take the GitHub triggers as any other (`pull_request_opened`, `pull_request_merged`, `pull_request_closed`,
`pull_request_checks` with `result`). Connecting stays a person's, in the browser. The api's `GET /items` answers the
states with the cards.

## Telemetry

From the existing vocabulary: `Plan · Started · GithubConnect` (Connect GitHub pressed), `Plan · Linked · Github`
(back connected), `Plan · Ended · GithubConnectFailed` (back failed), `Plan · Ended · GithubConnectRequested` (an
organisation's owner must approve), `Plan · Unlinked · Github` (disconnected), and `Plan · Created ·
AutomationRuleGithub` beside `AutomationRule` when a new rule with a GitHub trigger is saved. None carries a
repository, a pull request or a title.

## Limits

| Limit                              | Value  | Why                                                       |
| ---------------------------------- | ------ | --------------------------------------------------------- |
| `LINKED_PULL_REQUESTS_MAX`         | 10     | A card face has room for a few; more is a card too big    |
| `MENTION_TEXT_MAX`                 | 65,536 | GitHub's own cap on a pull request's body                 |
| `MENTIONS_MAX`                     | 20     | A pull request that names more is a list, not a link      |
| `PULL_REQUESTS_KEPT`               | 500    | A plan's recent pull requests; older ones show no state   |
| `CHECK_SUITES_KEPT`                | 2,000  | Several suites for each recent commit                     |
| `PULL_REQUEST_TITLE_MAX`           | 256    | GitHub's own cap on a pull request's title                |
| `RULE_MOVES_MAX`                   | 50     | Bounds the cards one delivery's GitHub triggers run on    |
| `REPOSITORIES_MAX`                 | 20     | One plan, one team's repositories                         |
| `PLANS_PER_REPOSITORY_MAX`         | 20     | Bounds one delivery's fan-out                             |
| `INSTALLATION_REPOSITORIES_LISTED` | 100    | One page of GitHub's repository list                      |
| `INSTALLATION_PLANS_MAX`           | 100    | Bounds an uninstall's fan-out                             |
| `REPOSITORY_PAGES_MAX`             | 10     | Pages of repositories read: 1,000, a connect bounded      |
| `REFUSED_NETWORK_TURNED_AWAY_MS`   | 1 min  | A network over its refused signatures is turned away      |
| `REFUSED_NETWORKS_KEPT`            | 1,000  | The turned-away networks a worker remembers at once       |
| `WEBHOOK_BODY_MAX`                 | 1 MB   | GitHub caps a delivery's payload at 25 MB; ours are small |
| `CONNECT_STATE_TTL_MS`             | 10 min | Long enough to install the App on GitHub                  |
| `DELIVERY_KEEP_MS`                 | 3 days | GitHub redelivers deliveries up to 3 days old             |
