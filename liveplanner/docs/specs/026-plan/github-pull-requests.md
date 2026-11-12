# GitHub pull requests

A plan that builds software links its cards to the **pull requests** that build them. A card shows each linked pull
request's state (open, draft, checks passing or failing, merged, closed), and the board moves the card when its pull
request opens or merges, so nobody moves cards by hand when the code lands. It is liveplanner's first connector to
another tool, brought forward from Later by the owner (2026-11-11, [Product scope](../002-project-scope/product-scope.md#non-goals)).
The engineering detail is [blueprints/github-pull-requests.md](blueprints/github-pull-requests.md).

It is built in parts (Work Item 157):

1. **The Pull Request field kind** and how a card names its pull requests (a Pull Request field, a Link field holding
   a pull request's address, or a pull request naming the card), read in pure code, with no call to GitHub. Built.
2. **The GitHub App's webhook receiver and the repository connection**, off while its secrets are absent.
3. **Pull request state on cards and the board's GitHub rules**, with moves made by GitHub in card history.
4. **The entry points**: the plan's GitHub dialog, the help article and telemetry.

Until a part is built, what it describes below is the design it is built to.

## Why

The Work Tracker links each card to its pull request with a Link field, and someone moves the card when the pull
request merges. Every team that builds software does the same chore. Linking the card to GitHub properly shows the
pull request's state where the team plans, and moves the card the moment the code lands.

## Domain language

| Term                    | Means                                                                                             | Never called                 |
| ----------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------- |
| **pull request**        | One GitHub pull request, named by its repository and number (`acme/web#42`)                       | PR (in copy), merge request  |
| **Pull Request field**  | A card field of kind `pullrequest` holding one pull request's address                             | GitHub field, PR link        |
| **linked pull request** | A pull request a card names: in a Pull Request field, a Link field, or the pull request naming it | attached PR                  |
| **card mention**        | A pull request's title or body naming a card as "{plan name} #{number}" ("Work Tracker #143")     | magic word, keyword          |
| **GitHub connection**   | A plan's link to liveplanner's GitHub App: the installation and the repositories chosen from it   | integration (in copy), sync  |
| **pull request state**  | Draft, Open, Checks Running, Checks Passing, Checks Failing, Merged or Closed                     | status (that is the card's)  |
| **GitHub rule**         | A board move a GitHub connection makes: when a linked pull request opens, or merges               | automation (those are rules) |
| **GitHub**              | Who a GitHub rule's moves are by, in card history                                                 | bot, system, webhook         |

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
`check_suite` and `installation_repositories` events. It writes nothing to GitHub.

The App's settings are the api's secrets and one binding: `GITHUB_APP_ID`, `GITHUB_APP_SLUG`,
`GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET` and the
`GITHUB_LINKS` KV namespace. **Missing any one, the feature is off**: the plan shows no GitHub entry, the webhook
route answers 404, and nothing logs an error. Pull Request fields still read and open as addresses.

### Connecting a repository

- **Who**: a signed-in Editor of the whole plan (the owner, the plan's team, a whole-plan Editor link), as the plan's
  webhooks are. A plan in Browser Storage has no connection (deliveries reach the server, not a browser).
- **How**: the plan's GitHub dialog sends them to GitHub to install the App (or pick an installation they already
  have) and choose its repositories; GitHub returns them with the installation. The api then asks GitHub, as that
  person, once, which installations they can reach (GitHub's user authorisation of the App), and connects the plan
  only when the installation is one of them. The person's GitHub token is used for that one check and dropped: **no
  personal GitHub token is stored**, ever. A repository joins only when the installation can see it.
- **What is kept**: the installation's id, each chosen repository's id and `owner/name`, who connected it and when,
  and the plan's GitHub rules. A plan connects up to 20 repositories (`REPOSITORIES_MAX`); a repository connects to
  up to 20 plans (`PLANS_PER_REPOSITORY_MAX`).
- **Private repositories**: a pull request's title and state reach everyone who can see the card, public share links
  included. Connecting a private repository to a plan that has a public link says so first ("Anyone with this plan's
  link will see these pull requests' titles and states").
- **Disconnecting** (any Editor who may connect) drops the connection, its rules and the state it holds; the cards'
  fields stay as addresses. Removing a repository from the installation on GitHub drops it from every plan.

### Storage

liveplanner has no D1. The **plan's Durable Object** keeps its own connection, rules and the latest state of each
linked pull request: the source of truth. The **`GITHUB_LINKS` KV namespace** keeps only the reverse index a delivery
needs, `repo:{repository id}` → the plans connected to it, rewritten from the plans' objects on every connect and
disconnect. A delivery reads the index, then each plan's object checks the delivery's installation and repository
against its own connection before it acts: a stale or forged index entry moves nothing.

### Deliveries

- Every delivery's `X-Hub-Signature-256` is checked, an HMAC-SHA256 of the raw body under `GITHUB_WEBHOOK_SECRET`,
  compared in constant time, **before** the body is parsed. A missing or wrong signature is refused (401) and read no
  further; so is a body over 1 MB.
- A delivery acts only on plans whose connection names both its installation and its repository. A pull request
  moves only cards of the plans it is linked to, by field or by mention.
- Each delivery id is acted on once (GitHub retries).

## Pull request state on cards

A linked pull request's state is the latest the plan's object has seen from deliveries, never fetched by a
viewer: **Draft**, **Open** (with **Checks Running**, **Checks Passing** or **Checks Failing** once its checks report),
**Merged** or **Closed**. The card face shows it as a chip beside the pull request's short name; the panel shows it
with the title. A pull request no delivery has reported yet shows its short name alone.

## GitHub rules

A connected plan's board has two GitHub rules, each off until an Editor picks a column:

- **When a linked pull request opens** (opened, or marked ready for review), move the card to the chosen column.
- **When a linked pull request merges**, move the card to the chosen column (Implemented, Done).

A move keeps every rule a manual move keeps: a card whose type leaves the column's status out
([The statuses a type uses](item-types.md#the-statuses-a-type-uses)) stays where it is; a card already there, in
the Trash or archived is left alone. Each move is a history entry **by GitHub** ("Moved by GitHub", with the pull
request's short name), never by the person who connected the plan.

## Who may do what

| Role            | The Pull Request field                         | The GitHub connection and rules                                                 |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------------------------- |
| **Editor**      | Sets, changes and clears it; opens it          | Connects, chooses repositories, sets rules, disconnects (signed in, whole plan) |
| **Participant** | Sets, changes and clears it, as any card field | Sees states and GitHub's moves; never connects or sets rules                    |
| **Viewer**      | Sees it and opens it on GitHub                 | Sees states and GitHub's moves                                                  |

A tab-scoped Editor link may set the field on its tab's cards but never connects the plan, since a connection acts
on the whole plan.

## Agents

The plan agents read and set a Pull Request field as its canonical address (`add_field` and `change_card_types` take
the kind `pullrequest`; a value that is not a pull request is refused as `value_invalid` with the field's hint). Part
3 adds each linked pull request's state to a card's listing.

## Limits

| Limit                      | Value  | Why                                                    |
| -------------------------- | ------ | ------------------------------------------------------ |
| `LINKED_PULL_REQUESTS_MAX` | 10     | A card face has room for a few; more is a card too big |
| `MENTION_TEXT_MAX`         | 65,536 | GitHub's own cap on a pull request's body              |
| `MENTIONS_MAX`             | 20     | A pull request that names more is a list, not a link   |
| `REPOSITORIES_MAX`         | 20     | One plan, one team's repositories                      |
| `PLANS_PER_REPOSITORY_MAX` | 20     | Bounds one delivery's fan-out                          |
