# Subscription

Status: being built, local only (owner's direction, 2026-11-20). Billing is the mock, with Stripe (Managed Payments) built and not yet tried against Stripe.

## What

liveworkspace's hosted service has three tiers: **Free**, **Pro** (one person) and **Pro for Teams** (one team). A
tier sets limits on a handful of features across the apps. Nothing is a Pro-only feature: everything works on Free, with smaller limits.
Every limit is the account's (a person's or a team's), over everything it owns in every app: none is per item
(owner, 2026-11-22).

The settings category and every label say **Subscription**, never "Pro plan": a plan is a liveplanner item.

## The flag

Pro is **off by default**. A self-hoster who sets nothing gets no Pro badge, no Subscription settings, no pricing
page, no upgrade prompts and no tier limits: every app behaves exactly as it did before Pro existed, and no app
calls the subscription Worker, which need not be deployed.

- Workers read the var `PRO_ENABLED`. `true`, `1` or `on` (any case) is on; anything else, or unset, is off.
- Browser builds read `NEXT_PUBLIC_PRO_ENABLED` with the same rule, so a page built with it off renders no Pro UI and
  makes no subscription request.
- The Worker var is the one that counts. A browser build with the flag on against Workers with it off shows Free
  everywhere and limits nothing.

With the flag off the limits that existed before Pro stay as they were (1,000 automation runs a day, 50 rules,
10 MB images, 10 minute walkthroughs, five snapshots and so on). They are safety caps, not tiers. They are the
**legacy** values below.

## Who pays for an item

Usage is charged to the item's **owner**, never to the person acting.

- An item in a person's library is the person's. It gets that person's tier: Pro if they subscribe, otherwise Free.
- An item in a team's library is the team's. It gets the team's tier: Pro for Teams if the team subscribes, otherwise
  Free. A member's own Pro never applies to a team's item.
- A collaborator on a shared item spends the owner's limits at the owner's tier. Nothing counts against the
  collaborator's own account.
- Only the owner (or, for a team, a team admin) is offered an upgrade. Anyone else who meets a limit is told the
  limit was reached and nothing more. A team member who is not an admin sees **Ask an Admin**.

Whether a person or a team subscribes is shown only to that person or that team's members. A collaborator is told
the limits they meet by the item's own app, and never the owner's tier.

An owner is written as the index writes a scope: `p:<accountId>` for a person, `t:<teamId>` for a team.

**A guest's item.** An item whose owner has no account (someone who has not signed in yet) has nobody to charge. One
rule holds in every app, from one helper (`itemPayer` in `@liveworkspace/subscription`):

- It gets **Free's limits**, held to that one item, since there is no account to count them against: Automation Rules
  and Knowledgebase Pages for that one item, Public Roadmaps for that one plan and Public Knowledgebases for that one
  knowledgebase are enforced there against Free's figure. The monthly counts (Automation Runs, Email to Board, Form
  Responses) are not counted for it: the fixed per-item bounds (1,000 runs a day, the hourly form and email caps)
  are all it has.
- It is **never sent to the subscription service**: no entitlement is read for it, nothing is spent, no gauge is
  added and no count is reported. A guest id is made by a browser, so a scope built from one would give every fresh
  guest an allowance and a meter of its own.
- **Call Minutes** for a guest's Space are counted by the Space's own room, against Free's monthly figure for that
  one Space.
- **AI Credits** are not counted for it: the caps that existed before Pro (livediagram's reads a day, liveplanner's
  AI steps a day per plan) are all it has.
- **A person without an account is never charged to an owner for AI** either: a signed-out visitor's photo read in
  livediagram spends nobody's credit, whatever they read into, and a Space counts at most ten people without an
  account in any one minute ([call-minutes.md](../../../../livehuddle/docs/specs/012-collaboration/call-minutes.md)
  "What counts"). A share link is never a way to spend its owner's month unbounded.
- **Nobody is offered an upgrade** there. Where a limit is met the notice says to sign in to keep the item, which
  makes it the person's own.
- An item whose head names no owner at all is not counted anywhere.

**What a collaborator is told.** An owner's scope is their account or team id, and their numbers are their usage:

- The **owner's scope** is sent only to a signed-in caller, who needs it to ask which action they may take (Upgrade,
  Ask an Admin, or nothing). A signed-out visitor is never sent it.
- The **owner's numbers** (what is used of a limit that is theirs over everything they own, and that limit: every
  limit in "Tiers and limits") are sent only to the owner or a member of the owning team.
- Everyone else, a signed-out visitor included, gets the **state** alone: what is paused and until when. Nothing
  that goes to everyone at once (a room's broadcast) carries an owner or a number.
- Anyone else who meets a limit inside an item (a rule refused, a run skipped, a form closed for the month) is told
  what happened and when it starts again, never what the owner has used. The fixed per-item bounds (1,000 runs a
  day, 50 rules, the hourly caps) are the item's own and told to anyone who may use that part of it.

**Pictures and walkthroughs are the uploader's.** A picture lives in the gallery of whoever uploaded it, and a
walkthrough belongs to whoever recorded it, in every app, so their storage counts against that person, not the item.

- **What they keep is their own tier's, always.** Image Storage and Walkthroughs Stored follow the uploader's own
  tier, whatever item the upload is for. A guest is Free. A grant on someone else's item never makes a person's own
  gallery bigger: it would be theirs to fill in every app, charged to nobody.
- **What one upload may be is the better of two tiers.** Walkthrough Length is the larger of the uploader's own and,
  when the upload is for an item, that item's owner's: a Free person working in a Pro for Teams item records thirty
  minutes there, and a Pro person keeps their own in a Free owner's item. Largest Image is weighed the same way, but
  it is 25 MB on every tier (owner, 2026-11-23: no point gating Pro on it), so nothing is lent.
- **Only someone who may add to the item is lent its owner's limit:** an Editor or a Participant, by the owner's or
  team's own grant or by a share link the owner made at that level. A Viewer is lent nothing, and so is anyone who
  came by a Community post's public link, which only ever views. An item in the Trash lends nothing.
- The offer at Image Storage or Walkthroughs Stored is for the uploader's own account. The offer at Walkthrough
  Length is for whichever tier set it. Largest Image makes no offer: no tier takes more.
- **Walkthrough Length is also weighed.** The service cannot time a recording, so it holds the media to the bytes
  that length makes ([walkthroughs.md](../006-media/walkthroughs.md) "Length, checked by size").

## Tiers and limits

A limit of "none" means unlimited. Days are UTC days and months are UTC calendar months.

| Limit                              | Legacy (flag off)  | Free    | Pro    | Pro for Teams          |
| ---------------------------------- | ------------------ | ------- | ------ | ---------------------- |
| Automation Runs, a month           | not counted        | 500     | 10,000 | 5,000 a member, pooled |
| Automation Rules                   | not counted        | 25      | 500    | 250 a member, pooled   |
| Email to Board, a month            | not counted        | 500     | 10,000 | 5,000 a member, pooled |
| Form Responses, a month            | not counted        | 500     | 10,000 | 5,000 a member, pooled |
| Public Roadmaps                    | not counted        | 1       | 10     | none                   |
| Public Knowledgebases              | not counted        | 1       | 10     | none                   |
| AI Credits, a month                | not counted        | 50      | 1,000  | 500 a member, pooled   |
| Image Storage                      | 1 GiB              | 500 MB  | 50 GB  | 250 GB                 |
| Largest Image                      | 10 MB              | 25 MB   | 25 MB  | 25 MB                  |
| Version History and Snapshots kept | 30 days, five kept | 7 days  | none   | none                   |
| Walkthrough Length                 | 10 minutes         | 5 min   | 30 min | 30 min                 |
| Walkthroughs Stored                | 50                 | 5       | none   | none                   |
| Call Minutes, a month              | not counted        | 1,000   | 5,000  | 2,500 a member, pooled |
| Knowledgebase Pages                | not counted        | 500     | 10,000 | 5,000 a member, pooled |
| AI Knowledge History               | 90 days            | 30 days | 1 year | 1 year                 |
| Bring Your Own AI                  | free               | free    | free   | free                   |

- **Account-wide** (owner, 2026-11-22): every count is the owner's over everything they own in every app, never an
  item's. **Automation Runs** counts each run that does something (a No Match costs nothing) and each message a run
  sends through a connection (Slack, Teams, Send to Webhook), so Free's 500 cover what Webhook Deliveries counted
  before. **Automation Rules** and **Knowledgebase Pages** are standing counts: what every item holds now.
- **Fixed per-item bounds** stay on every tier, beside the account's counts and never on the pricing page: 1,000 runs
  a day and 50 rules an item (the legacy caps), the pages one knowledgebase holds, and the hourly form and email
  caps. They are abuse bounds, and their refusals carry no upgrade.
- **Per member, pooled:** the team's limit is the per-member figure times its seats, shared by everyone. Seats are
  the team's joined members, never fewer than 3 and never more than 200, the most people a team holds.
- **Bring Your Own AI** is free on every tier (owner, 2026-11-22): your own Claude or OpenAI key, set in your own
  work or a team's, runs the AI that takes one and spends no AI credits.
- **An AI operation costs what its work does** ("What an AI operation costs" below): most cost one credit, the
  heavier ones more, and every screen says the cost before anyone starts the operation.
- **liveknowledge's built-in AI** (owner, 2026-11-22) stays on every tier: with Pro on, each built-in question,
  conflict check, page draft or setup suggestion spends the owner's AI credits, and a team's own key spends none
  (liveknowledge/docs/specs/030-knowledgebase/tiers.md).
- **Public Knowledgebases** (owner, 2026-11-22): the knowledgebases an owner has published to the web at once,
  counted as Public Roadmaps are (liveknowledge/docs/specs/030-knowledgebase/publishing.md "Tiers"). Every other
  part of Publish to the Web works on every tier.
- **A credit spend sits beside an app's own hourly and daily caps**, never in place of them (liveknowledge's Ask and
  conflict check caps, liveplanner's AI steps a day). Those are abuse bounds and hold on every tier.
- **A call minute** is one person in a call for one minute. Nobody limits how many people join a call. Pro has
  5,000 (owner, 2026-11-22, down from 10,000) so the smallest team, three members pooling 7,500, never has fewer
  than one person on Pro.
- **Largest Image** and the per-day safety caps that existed before Pro (100 AI steps a day per plan, the hourly form
  and email caps) stay in force beside the tier limits.
- An owner over a new limit keeps what they have: an owner with 30 rules on Free keeps all 30 running and cannot
  add another until they hold fewer than 25. While they hold more rules than their tier allows, a rule that is off cannot
  be switched on (owner, 2026-11-22): the refusal says how many they hold and how many the tier allows. At the limit
  exactly, any rule may be on. Nothing is ever deleted because a tier changed, except history older than
  the tier keeps.
- **Snapshots** keep the latest five for 7 days each on Free and the latest 50 with no age limit on Pro and Pro for
  Teams ([snapshots.md](../014-snapshots/snapshots.md)). While an item's owner's tier cannot be learnt, five are kept
  and nothing is dropped for its age. **Version History** (livedocuments) keeps automatic versions
  for 7 days on Free and with no age limit on Pro and Pro for Teams, where a tab still keeps at most 500 versions and
  64 MiB as a safety cap; named versions are never pruned. Both follow the item's owner's tier.
- **Walkthrough Length** on Pro is recorded at a lower video bit rate, so thirty minutes fits one upload
  ([walkthroughs.md](../006-media/walkthroughs.md) "Thirty minutes in one upload"). **Walkthroughs Stored** counts a
  person's own, in every app; an item still takes at most 50.
- GitHub in automations is free on every tier. Automation runs are the gate.

### What an AI operation costs

Owner, 2026-11-22: an operation that asks more of the model costs more credits, and the person sees the cost before
they start it, so they can choose. A cost is fixed by the most work the operation can do (what the model may be
handed and write), never by what one run happened to use, so it is known before the model is called. The servers
spend these amounts and the screens say them from one table (`AI_CREDIT_COSTS` in `@liveworkspace/subscription`).

| Operation                                              | Credits              | Its work, at most                                   |
| ------------------------------------------------------ | -------------------- | --------------------------------------------------- |
| liveknowledge: Ask a question, Draft a Page (built-in) | 1                    | 8,000 tokens of passages read, 2,000 written        |
| liveknowledge: a conflict check after an edit          | 1                    | five pairs of passages, 2,000 tokens written        |
| liveknowledge: Describe to Set Up (built-in)           | 2                    | 4,000 tokens written; a second ask, if needed, free |
| Automations: one run of a Summarise step               | 1                    | 300 tokens written                                  |
| Automations: Describe a Rule                           | 1                    | 1,500 tokens written                                |
| liveplanner: Describe a Plan, Describe a Form          | 1                    | 2,000 tokens written                                |
| livediagram: read a photo's notes                      | 1 for every 24 notes | six notes a request, 2,000 tokens written a request |

- **Said before, in the words the operation's own screen uses:** "Uses 2 AI credits" beside the button that starts
  it, "Each run of this step uses 1 AI credit." in a step's panel, and for a photo, "Read 60 notes with AI · Uses 3
  AI credits" beside reading them on this device, which uses none.
- **An operation that starts itself** (a conflict check, an automation's run) says its cost where it is set up, and
  is never more than the table says.
- **A refused spend costs nothing**, and an operation the model then fails is not given back (each app's own
  caps bound retries).

## Price

Monthly only, no annual price. Pro is £8 a month. Pro for Teams is £6 a member a month, for 3 members or more.

Every price shown comes from the subscription Worker, in the visitor's currency:

- The Worker maps the visitor's country (Cloudflare's `cf.country`) to a currency and falls back to GBP.
- Each currency has its own set amount, a round local figure, never a live conversion.
- A subscriber is shown the currency their subscription was taken in, wherever they are.
- The browser formats the amount for the visitor's locale with `Intl.NumberFormat`.

| Currency | Pro | Pro for Teams, a member |
| -------- | --- | ----------------------- |
| GBP      | 8   | 6                       |
| USD      | 10  | 8                       |
| EUR      | 9   | 7                       |
| CAD      | 14  | 11                      |
| AUD      | 15  | 12                      |

The amounts other than GBP are placeholders for the owner to set. With Stripe each tier is one Price holding these
per-currency amounts, which the Worker reads so the page and the charge match.

## The subscription Worker

`apps/subscription` is the one place a subscription is read or written. It has its own D1 database. No app keeps
its own copy of who is subscribed.

- **A person's browser** (the site and every app) reads its own subscription, usage and teams, and starts a checkout
  or opens the billing portal, with the account's access token.
- **An app's Worker** asks for an owner's entitlement, spends from a meter and reports gauges, with that app's own
  key, over a service binding. A browser can never call these routes.
- With `PRO_ENABLED` off every route answers 404.

### Entitlement

What an app's Worker gets for an owner: the tier and that tier's limits as numbers, with a team's pooled limits
already multiplied by its seats.

- Every gated feature is checked **on the server**, from the entitlement the app's Worker fetched. No request from a
  browser carries a tier, and no limit is enforced in the browser alone. The browser's meters and prompts only show
  what the server decided.
- An app caches an entitlement for 60 seconds. If the subscription Worker cannot be reached it uses the last answer
  it had, for up to a day, and otherwise Free.
- **Out of reach is not refused.** When the subscription Worker cannot be reached (no answer in time, a failure on the
  way, an error of its own), a spend or a gauge add is allowed and nothing is counted: an outage never stops
  anyone's work. When it answers and **refuses the request** (a wrong or rotated key, a request it will not take),
  nothing is allowed: the spend or add is refused, the owner is treated as Free and the last answer is not used, and
  the refusal is logged. Nothing that deletes (snapshot and version history) acts on either: it waits for an answer.
  A person is then told the thing could not be checked, never that a limit was reached, and is offered no upgrade.
- **An app with Pro on and no key** asks nothing: every owner is Free, and everything is allowed at Free's numbers
  without being counted.

### States

| State        | Meaning                                                                                              | Tier while in it |
| ------------ | ---------------------------------------------------------------------------------------------------- | ---------------- |
| `active`     | Paid and renewing. Stays Pro for up to **3 days** past the period's end while the renewal is settled | Pro              |
| `cancelling` | Cancelled. Pro until the period ends, exactly                                                        | Pro              |
| `past_due`   | A renewal failed. Pro until the **later** of the paid period's end and 7 days from the failure       | Pro              |
| `ended`      | The period ended after a cancel, grace ran out, or no renewal came                                   | Free             |

- **"Renews" means renews.** A subscription shown as renewing on a date never quietly ends on it. The billing
  provider says, within hours of the period ending, that the renewal was paid (the period moves on a month) or
  failed (grace starts). Until it says, and for no more than 3 days, the subscription stays `active` and Pro. If
  nothing is heard in that time it ends.
- **A renewal keeps its day of the month.** A subscription taken on the 31st renews on the 28th of February and the
  31st of March: a short month never moves the day for good.
- **A renewal is only taken near the period's end** (from 3 days before it), so months never stack.
- **Grace never ends Pro early.** Grace is 7 days from the failed renewal, and Pro lasts until the later of that and
  the end of the period already paid for. The day shown, in Settings and on the billing page, is that later day.
- **Cancel works while past due.** Pro then ends on the day it would have ended anyway (the later of the two above),
  nothing more is charged, and Resume goes back to past due, never to paid.

**Messages a rule sends** to Slack, Teams or a webhook are Automation Runs too (owner, 2026-11-22): each message a
run sends through a connection costs one run beside the run's own, spent by the item's room before it hands the
message to the index, which sends what rules tell it and nothing by itself
([webhooks.md](../004-index/webhooks.md)). A connection's Test send costs nothing: the index, which sends it, holds no subscription client, and a test is one
message to the person's own connection. There is no
Webhook Deliveries limit any more: a counter of it left in the service is read by nothing.

Going back to Free deletes nothing at once. Limits apply from then on, and history older than Free keeps is pruned
on its usual sweep.

### Meters

- **Spend meters** live in the Worker, per owner and month: Automation Runs (each run, and each message it sends, spent
  by the item's room), Email to Board, Form Responses, AI Credits and
  Call Minutes. An app's Worker spends before it does the work; the Worker refuses, atomically, once the owner's limit is
  reached.
- **Gauges** are counts the Worker holds per owner: Public Roadmaps (one entry per published roadmap) and Public
  Knowledgebases (one entry per knowledgebase published to the web, keyed by its document id).
- **Image Storage and Walkthroughs Stored** are counted by media, live, from the same rows it enforces them on. The
  Worker keeps no copy: when a person reads their usage it asks media for every owner in one call, so the figure
  shown can never drift from the one enforced, whatever changed it (an upload, a delete, a release, a sweep, a
  copy, a guest signing up, an account deleted). If media cannot answer, those two figures are left out.
- **Item counts** (Automation Rules, Knowledgebase Pages) are counted where each item lives and told to the Worker,
  one count an item, which sums them over everything the owner holds. A count that grows because someone adds (a
  rule, a page, an import) is refused, in the one statement that writes it, when it would take the owner's total past
  their limit; any other (a delete, an item that moved to another owner, a count told again) is recorded whatever the
  total. An item that moves owner takes its counts with it. Walkthrough Length is still weighed where the media is.

## Billing

Billing sits behind one provider interface, chosen by `BILLING_PROVIDER`: **stripe** in production, **mock** in
development and staging (which can also be pointed at Stripe's test mode).

**The mock provider never exists in production**, whatever the Worker is configured with: it would give Pro away.
A provider that is named but not fully configured (Stripe without its key, its webhook secret or its two Prices)
does not exist either: checkout and the portal answer that billing is unavailable, the page says so plainly, and the
mock's own pages are not there.

- **Subscribe** opens the mock checkout: a page that names the tier, the owner, the price and the seats, with
  **Pay and Subscribe** and **Cancel**. Paying makes the subscription `active` for a month.
- **Manage Billing** opens the mock portal: cancel, resume, and test controls that simulate a failed renewal, a
  recovered payment, grace running out, the period ending, a renewal and a change of seats.
- Both pages say **Test Mode** and exist only with the mock provider.
- The mock behaves as a real provider does: a subscription renews by itself when its period ends (the hourly sweep
  moves it on a month), and the controls are bounded by the same rules (a renewal only near the period's end, seats
  from 3 to 200).

Only a team's admins may subscribe a team or manage its billing. Who is an admin is asked of accounts **at that
moment**, for the checkout, for the portal and for every change made in the mock portal: a sign-in's word on it can
be fifteen minutes old, and a billing page stays open longer than a role may last. If accounts cannot answer, the
request is refused to be tried again, never let through. Stripe's portal is Stripe's page: it is opened only for
whoever is an admin at that moment, and what it allows (below) is done there without asking again.

### Stripe

There are never card forms of our own: Subscribe opens **Stripe Checkout** and Manage Billing opens **Stripe's
billing portal**, both hosted by Stripe.

**Stripe is the seller.** Checkout runs with Stripe's **Managed Payments**, so Stripe is the merchant of record: it
works out, collects and files VAT and sales tax in every country it covers, handles disputes and fraud, and sends the
receipts and invoices. Every price **includes tax**: £8 is what a person pays, wherever they are. Card statements
read `LINK.COM* LIVEWORKSPACE`.

**Products and Prices.** Pro and Pro for Teams are a Product each, with an eligible software tax code, and one
monthly Price each whose per-currency amounts are the table in "Price", tax included. Pro for Teams is per member.
The amounts stay in the contract (`PRICES`), so the pricing page never waits on Stripe; a check compares them with
Stripe's and fails on any difference, so the page and the charge always match. Checkout is given the currency the
page showed.

**Checkout.**

- One Stripe customer per owner: a person, or a team (whose admins share it). It is made by the first checkout and
  kept, so a team that subscribes again has its invoices in one place.
- An owner has at most one checkout open: starting another expires the last, so paying twice in two tabs can't make
  two subscriptions.
- A team's checkout is for its joined members now, never fewer than 3.
- Coming back from a paid checkout lands on the page it left with `?subscribed=1`; a cancelled one lands on the page
  without it.

**The portal** lets a subscriber cancel (at the period's end), resume, change their card and read their invoices.
It never changes the plan or a team's seats: seats follow the team's joined members.

**Stripe's word is the truth.** Its webhooks (`checkout.session.completed`, `customer.subscription.created`,
`.updated` and `.deleted`, `invoice.paid`, `invoice.payment_failed`) only say that something changed. For each, the
Worker checks the event's signature, reads the subscription fresh from Stripe and writes the owner's row from it, so
an event that comes twice, late or out of order writes the same thing. The hourly sweep also reads a few subscriptions
it has not heard of in a day, so a missed webhook is put right within a day.

| Stripe says                                    | The state  |
| ---------------------------------------------- | ---------- |
| `active` (or `trialing`)                       | active     |
| `past_due`                                     | past_due   |
| either of those, cancelled at the period's end | cancelling |
| `canceled` or `unpaid`                         | ended      |
| `incomplete`, `incomplete_expired`, `paused`   | not used   |

- Grace is ours: 7 days from the first failed renewal, Pro until the later of that and the period's end, whatever
  Stripe's retries do. Stripe's retries are set to give up after 7 days and cancel.
- A subscription for an owner who already holds a live one (which the one-open-checkout rule makes nearly
  impossible) is cancelled at once and logged, for the owner of the service to refund.
- A team's seats: when the sweep finds its joined members changed, it sets the Stripe subscription's quantity, and
  the change is charged for the rest of the month on the next invoice. The row changes once Stripe has taken it.

**To confirm in Stripe's test mode before going live**, as Stripe's Managed Payments pages do not say: that a
Price's own per-currency amounts are charged as they are rather than converted (Adaptive Pricing is always on with
Managed Payments), that a subscription's quantity can be changed with proration, and that the billing portal works
for these subscriptions.

**Setting up a Stripe account** (test mode first, then live): `corepack pnpm --filter
@liveworkspace/subscription-service stripe:setup` makes what is missing and checks the rest, and prints the ids the
Worker's vars take. It makes the two Products and Prices (found again by their lookup keys), the portal's
configuration and, given `--webhook-url`, the webhook endpoint for the events above. With `--check` it only checks,
failing on any amount or tax setting that differs from "Price". In Stripe's dashboard, by hand: accept the Managed
Payments terms, set the statement descriptor to LIVEWORKSPACE, and set failed-payment retries to end after 7 days by
cancelling the subscription.

### Trying a limit locally

Free's real limits take hours to meet by hand. In development only, the subscription Worker's var `DEV_FREE_LIMITS`
(JSON, for example `{"automationRunsPerMonth":5,"automationRules":3}`) lowers Free's numeric limits, so every limit's
notice can be met in a minute. It is off unless set: `.dev.vars.example` carries it commented out, so a local run
shows Free's real figures (owner, 2026-11-22). Staging and production ignore it. The comparison still shows the real figures; the
meters and notices show what the server enforced.

## What people see

Designed on the owner's canvas (2026-11-20). All of it is absent with the flag off.

- **The Pro badge:** an ink pill holding the small liveworkspace logo and PRO. Solid means you have Pro, outline
  means the thing is part of Pro, and the mark alone is used where space is tight. It is the same in every app.
- **The quiet line (ProNote)** under a list a tier trims: the sentence, then See Pro (or Ask an Admin for a team's
  member) wearing the Pro mark in the button itself, so a badge and a button never sit side by side (owner,
  2026-11-22). With no button (nobody who can act), the outline badge leads the sentence instead. Once the owner's
  tier is past Free it goes at once, though the item has not been read again (an upgrade from the line itself, or in
  another tab).
- **Settings, Subscription:** your tier with its price and renewal date, your teams (Manage Billing, Upgrade Team or
  Ask an Admin), and your usage of every limit. A team's member who is not one of its admins sees its tier, state,
  seats, limits and how much is used: what the team pays, when it renews or lapses and the names of its items are
  its admins' to see. The rail's Subscription row names your tier at its right (Free or Pro) once the service has
  answered. A team on Free is counted in members, as accounts has them at most 30 seconds ago, so someone who just
  joined is counted on the next read; a subscribed team in the seats it pays for. In Your Usage every
  row's bar and figures keep their own columns, so the bars line up.
- **A team's page in the Explorer** (owner, 2026-11-22): its card carries the team's plan as a row under its header,
  so the way to upgrade is where the team is run. The row reads the team's tier: "Free Plan", or "Pro for Teams" with its badge
  and seats on a subscribed team, and on Free a quiet line, "Pro for Teams raises the team's limits.", for whoever can act.
  Its button follows Settings' rules: Upgrade Team (the upgrade dialog on A Team, this team chosen) for an admin on
  Free, Manage Billing for an admin of a subscribed team, Ask an Admin for a member of a Free team, and nothing for a
  member of a subscribed team. It loads with the team card, never in the first load, and is absent with Pro off or
  until the service answers.
- **The upgrade dialog:** Subscribe For Just Me or A Team, and the comparison of every limit by tier beside your
  usage now, grouped (Automation; Publishing; AI; Storage and History; Recording and Calls; Knowledgebases),
  each row with the logos of the apps it applies to and an explanation. A limit shared by several apps shows each of
  their logos, a small block of them, never liveworkspace's own; each logo names its app in a tooltip, and the line
  under the row's name says "Every app", "Every app but livehuddle", or the apps by name (owner, 2026-11-22). Its header reads badge, title and sentence at every width; the
  price sits at the header's right on a wide screen, and on a phone in the footer, beside the button that buys it.
- **The pricing page** on liveworkspace.app: the three tiers and the same comparison, with your usage when signed in.
  It opens with an illustrated hero (the shared marketing PageHero, its art beside the words: three tiers rising,
  each a step up from the last, every app's tile on the first): "Pricing", "Free for Everyone. Pro When You Need
  More.", the lede, and See Limits, which scrolls to the comparison. The tier cards sit in the same hero band, under the words and art, with no rule
  between them: one hero. Both Pro cards, for Individuals and for Teams, carry the solid Pro badge beside their name. Every Limit,
  Side by Side is a section of its own below them, in a band of its own with its own heading and lede, so the
  comparison reads apart from the hero and the cards. Its lede is "What each tier includes. The limits are the same in
  every app." (own keys are not its subject, owner 2026-11-23), and signed in, the line beside it says "Comparing your
  personal usage", with no name.
  Under the comparison, **Everything Else Is Completely Free** says that anything the table does not list is free for everyone,
  on every tier (owner, 2026-11-22), with a closed **See Some Examples** accordion (the shared FaqItem) of a few
  examples, never the whole list: unlimited documents in every app (no tier counts them), working together live with share roles, every template, import and export, Offline,
  Google Drive, comments, the MCP server and CLI, Community, and Publish to the Web.
  Its cards name the paid tiers Pro (for Individuals) and Pro (for Teams), so the difference reads in the heading;
  everywhere else they are Pro and Pro for Teams. The page sells limits, not webhooks: an app's own webhooks are
  retired in favour of automations, whose Send to Webhook, Slack and Teams steps spend Automation Runs.
  A subscriber's line under the cards says where their own subscription stands (the day it renews or ends, in amber
  while a renewal has failed) in place of the visitor's line, so the page does not move when it is read. A row with
  nothing to count (Walkthrough Length) leaves its usage cell quiet. Largest Image is left out of the comparison: it
  is the same on every tier (owner, 2026-11-23). In development the page hands a `?currency=` of its
  own on to the service (`/pricing?currency=USD`), so each currency can be looked at; a production build has none
  of that.
- **Meters and prompts in each app**, where a limit is met: a meter that turns amber at the limit, what happened in
  one sentence, and Upgrade to Pro for the owner only.
- **Billing states:** a banner in Subscription while `past_due` (with the day Pro ends unless the payment is
  recovered, and Update Payment) and while `cancelling` (with the day Pro ends, and Keep Pro). Both buttons open the
  billing portal.
- **Back from the checkout:** "You're on Pro" (or "<Team> Is on Pro for Teams") is said once, and only for what that
  checkout gained: the owner this browser left to subscribe, now paid. Where that cannot be known nothing is said.
  It is a card at the foot of the page, never a dialog: the tier, the three things it changed in the contract's own
  figures (automation runs, AI credits, and image storage and history), and See Limits. It leaves
  by itself after twenty seconds, waiting while the pointer rests on it or the keyboard is inside it, or when
  dismissed, and does not come back on a reload.
- **You're Back on Free:** when a person opens Subscription within 30 days of their paid tier ending, a card over
  their tier says Pro has ended and nothing was deleted, and lists what works differently now with where each
  stands: Automation Runs (Lower Limit), Image Storage (Uploads Paused when over Free's storage,
  otherwise Lower Limit) and Version History and Snapshots (Lower Limit). Go Pro Again opens the upgrade dialog;
  Dismiss ends it for good. The service says it: the summary of an owner whose paid tier ended in the last 30 days
  carries when it ended (`endedAt`) and the tier it was, from the subscription's own row, so every browser says the
  same and nothing is kept in a browser. Dismiss is kept on that row, for that ending: another browser says nothing
  after it, and a paid tier that ends again later is said again. A team's ending is for its admins alone (a member
  is told only that the team is on Free), and one admin's Dismiss is the team's.
- **Ask an Admin:** a member of a team on Free who meets a limit, or presses Ask an Admin under Your Teams, opens a
  dialog with a note to the team's admins (naming the limit when there is one). **Send Request** sends it; **Copy
  Note** stays, to send it some other way. The request is kept by the subscription service and shown to the team's
  admins in Settings, under Subscription, on the team's row: "Bea Lee asked for Pro for Teams" or "3 members have
  asked for Pro for Teams", opening on the newest five with who, the limit that prompted it, the day and their note.
  - Only someone accounts says is a joined member of that team at that moment may send one (the token's word can
    be fifteen minutes old). Nothing is sent for a team that already subscribes, and a team that subscribes forgets
    its requests.
  - One request per member, team and UTC day. Asking again that day is answered plainly, "You asked on 21
    November", and the member's row says so too. Each account's requests share the service's rate limit.
  - Nothing tells the member who the admins are: no name, no address. A note is the member's own words, at most 500
    characters. A request is kept 30 days.
  - It is shown in Settings only, not in the Inbox or by email. The Inbox lists rows of items (threads, actions,
    forms, access requests), and a request is about a team, not an item; email would need the subscription service
    to send mail, which it cannot. Either can come later on the same record.
- **The mock checkout and billing pages** name a person's own subscription by the name accounts shows for them ("For
  Ada Byron, your personal library"), and by their email when they have set none or accounts cannot say.
- **The mock billing page's status line** says the one thing an action did, in the tone of where it left the
  subscription (a failed renewal is a warning, a cancel is plain information, a recovered payment is a success), and
  never repeats the card under it.
- **A feature whose owner already pays** says "Your subscription includes this. It turns on within a minute." while
  the item's app catches up, never that the tier does not include it.
