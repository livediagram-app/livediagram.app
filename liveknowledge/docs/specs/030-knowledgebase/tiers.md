# Tiers in liveknowledge

What Pro changes in a knowledgebase ([blueprint](blueprints/tiers.md)), on the platform's tiers
([subscription.md](../../../../liveworkspace/docs/specs/019-subscription/subscription.md) "Tiers and limits"). It applies
only with Pro on (`PRO_ENABLED`). With Pro off, every limit and every screen is as it is today.

A knowledgebase follows its **owner's** tier, or its team's for a team's knowledgebase (019 "Who pays for an item").
A guest's knowledgebase has Free's limits, and nobody is offered an upgrade. A knowledgebase that is nobody's yet
has the limits that apply with Pro off.

| Limit                 | Pro off  | Free    | Pro     | Pro for Teams          |
| --------------------- | -------- | ------- | ------- | ---------------------- |
| Knowledgebase Pages   | 500 each | 500     | 10,000  | 5,000 a member, pooled |
| AI Knowledge History  | 90 days  | 30 days | 1 year  | 1 year                 |
| Built-in AI           | caps     | credits | credits | credits                |
| AI Credits, a month   | none     | 50      | 1,000   | 500 a member, pooled   |
| Public Knowledgebases | none     | 1       | 10      | none                   |

The caps on built-in AI and on Ask ([Search and Ask](search-and-ask.md) "Built-in AI") hold on every tier. They are
abuse bounds, set beside the tier's limits and never replaced by them.

## Knowledgebase Pages

Owner, 2026-11-22: the pages an owner holds are counted over **every knowledgebase they own** (a team's over the
team's), a standing count like Automation Rules: Free 500, Pro 10,000, Pro for Teams 5,000 a member, pooled. One
knowledgebase still holds at most 500 pages (`MAX_KNOWLEDGEBASE_PAGES`), a fixed bound on every tier and with Pro off.

- **Counted** as the page tree counts them (`pageCount`): every page and subpage. Rows for connected items and pages
  in the Trash are not counted. Each knowledgebase tells the subscription service its own count, which sums them for
  the owner; when a knowledgebase changes owner its count moves with it.
- **On an add** (a new page saved, an agent's or the MCP's add, a changeset that makes a page, Automations' Add Tab
  step, a restore from the Trash, and a knowledgebase made with its pages) the new count is told first and refused
  past the owner's limit. A guest's knowledgebase and one that is nobody's are not counted: the fixed bound is all
  they meet. With the service out of reach the add goes through, uncounted; when the service refuses the request
  the add is refused as `unavailable` (503), to be tried again.
- **On a delete** (a page to the Trash) the new count is told in the background, never refused.
  A knowledgebase removed for good (its purge) takes all its pages, and its rules, off its owner's counts.
- **The room's relay** of a tree op checks the fixed bound only (it cannot wait on the service): the save that stores
  the page meets the owner's limit.
- **The editor asks first.** Every page add in the editor (New Page, Add Subpage, Duplicate, a structure picked on the
  start or by link, Describe to Set Up) is held to the room the owner's limit leaves as well as to the fixed bound, as
  soon as the owner's usage has come: New Page and the row menu's adds are disabled with the notice's words ("You have
  500 pages, the most Free holds across your Knowledgebases."), a structure picked that would pass it makes nothing
  and says so ("Free holds 500 pages across your Knowledgebases, so Team Handbook’s 11 pages don’t fit."), and
  Describe to Set Up's Review asks to untick pages ("Free holds 500 pages across your Knowledgebases, and these would
  pass that. Untick some pages to make room."). A picked structure waits a moment for the usage before it is weighed. Nothing is put on the page that the
  save would then refuse.
- **A new knowledgebase when they are full.** It starts with a page, so its create is refused at the owner's limit,
  and `/new` says so instead of blaming the connection: "No room for another knowledgebase", "Your Knowledgebases hold
  500 pages, the most your plan keeps, and a new one starts with a page. Delete pages you no longer need to make room.
  Pro holds 10,000." with Back to Explorer.
- **Over the limit already** (an owner moved down a tier): every page stays, and none can be added until there are
  fewer than the limit. Moving, renaming, editing and deleting pages work as always.
- **The refusals:** the fixed bound is `page_limit` (409) with no tier fields, as with Pro off. The owner's limit is
  `page_limit` with `limit: 'knowledgebasePages'`, `used` (the owner's total), `max`, and `guest` where it applies.
- **The editor learns the figures** from the document's read (`knowledgeTier: { pagesMax, pagesLimit?, historyDays,
owner?, guest? }`, absent with Pro off): `pagesMax` is the fixed bound, `pagesLimit` the owner's limit (absent for a
  guest's and nobody's). What the owner used is theirs alone (019 "What a collaborator is told"): the owner and the
  owning team read it from their own subscription.
- **In the page tree**, from 80% of what bounds the knowledgebase, a meter closes the sidebar (and the phone's Pages
  sheet, over New Page), its label over the bar. For the owner or the
  owning team, where their pages over all their knowledgebases leave less room than the fixed bound: "Knowledgebase
  Pages", the bar, "420 of 500"; at the limit a notice, "You have 500 pages, the most Free holds across your
  Knowledgebases. Pro holds 10,000." (a team reads "This team has 5,000 pages, the most Pro for Teams holds across its
  Knowledgebases."), with Upgrade to Pro for the owner or a team admin and Ask an Admin for a team's other members.
  Otherwise "Pages", "420 of 500", and at the bound "This Knowledgebase holds 500 pages, the most one can." with no
  offer.
- **Import over the limit.** The room an import has is the fixed bound less the pages already there, or, for the
  owner or the owning team, their limit less what their other knowledgebases hold (`limit - (used - this
knowledgebase's count)`), whichever is less. When a file holds more pages than fit, the import panel says so before
  anything is made: "42 more pages fit on Free", then "Free holds 500 pages across your Knowledgebases. We'll import
  the first 42, in the export's order, and leave out the other 42. Pro holds 10,000." Its buttons are Cancel, Upgrade
  and Import All (for someone who may upgrade), and Import First 42. Full already, it imports nothing: "You have 500
  pages, the most Free holds across your Knowledgebases." When it finishes, its last step says "Imported 42 of 84
  pages. The other 42 were left out: your Knowledgebases are full on Free." with Upgrade to Pro. Against the fixed
  bound the words are "A Knowledgebase holds 500 pages." and "this Knowledgebase is full.", with no offer.
- **Cost:** one call to the subscription service per page add (a create with pages, a restore and an import's page
  each count once), and one in the background per page delete.

## Built-in AI on AI credits

Owner, 2026-11-22: built-in AI stays on every tier. With Pro on, each built-in AI operation spends **AI credits**
from the owner's month, what the platform's table says it costs
([subscription.md](../../../../liveworkspace/docs/specs/019-subscription/subscription.md) "What an AI operation
costs"), shown before it starts. Your own Claude or OpenAI key, set on a knowledgebase in your own work or a team's, never spends a credit.

- **What each costs:** an Ask question 1 (Draft a Page is one), a conflict check 1 (whatever pairs it reads), and a
  Describe to Set Up suggestion 2 (it may write twice as much; its second ask, when the first cannot be read, is free).
- **Charged to the owner by someone else, at most 20 a day** (owner's AI credits, per knowledgebase): an Ask or a
  setup by anyone who is not the owner (or, for a team's knowledgebase, one of its members) first passes a daily cap
  of 20 such operations, as livediagram's photo reads by others do, so a share link is never a way to spend the
  owner's month (019 "Who pays for an item"). Past it Ask and Set Up are refused (`ai_by_others_limit`, 429): "Built-in
  AI here has had its fill for today. Try again tomorrow, or add your own AI key." Conflict checks an edit starts keep
  their own daily cap.
- **Spent after the caps pass and before the model is asked**, so a credit is never spent on a call a cap refuses.
  It is not given back when the call fails. A guest's knowledgebase and one that is nobody's spend nothing; the caps
  are all they have.
- **When the month's credits are used**, Ask and Describe to Set Up are refused (`ai_credits_used`, 429, with
  `limit: 'aiCreditsPerMonth'`, and `used` and `max` for the owner or the owning team alone). The conflict check skips that check, says nothing, and is owed again
  after the next edit. When the subscription service refuses the api's own request (its key), the call is refused as
  "AI credits could not be checked" (503), with no upgrade offered.
- **AI Settings says so.** With Pro on, Built-In AI reads "No key to add. Uses AI credits." and its note "Questions,
  conflict checks, drafted pages and Describe to Set Up run on built-in AI, each spending AI credits from the owner's
  month (a question 1, Describe to Set Up 2), within daily limits. Your own key never spends a credit." Your Own Key
  is offered on every tier, with no Pro mark.
- **What people see.** Under the Ask box and beside Set Up, a quiet line says what the next one costs: "Uses 1 AI credit" under
  Ask, "Uses 2 AI credits" beside Set Up. Conflict checks start themselves after an edit, so AI Knowledge's Conflicts
  card says "Each check after an edit uses 1 AI credit." on built-in AI. Once an answer has
  told the owner (or a member of the owning team; nobody else is sent the figures, 019 "What a collaborator is told") their month, the line adds "· 962 left this month" (the Ask stream's
  `X-AI-Credits: <used>/<limit>` header, and the setup answer's `credits`). On a key, the line reads as it does
  today. When the credits are used, a notice replaces the line: "This month's AI credits are used. They start again
  on 1 December. Add your own Claude key to ask now, or Pro gives 1,000 a month." (in Describe to Set Up, "...to set
  up now..."). Add a Key opens AI Settings for an Editor. Upgrade to Pro follows the shared action rules. A
  collaborator who may not act reads "The owner's AI credits for this month are used." The notice takes the line's
  place (no "Uses 1 AI credit" under it); its button is the upgrade offer, else Add a Key, and with both Add a Key
  follows its sentence. The refused question's own card says "This Month's AI Credits Are Used", "They start again on
  1 December.", never that something went wrong.

## AI Knowledge History

- **Kept for the tier's days:** page reads (`page_reads`) and the agents seen (`agent_seen`) are pruned past the
  owner's AI Knowledge History. That is 30 days on Free and a year on Pro, and 90 days, as today, with Pro off.
  Questions nobody could answer keep their count cap (500) on every tier.
- **Not Read asks only about days kept.** AI Knowledge's Not Read card asks about 90 days, or the days the tier keeps
  where fewer: on Free it is "Not Read in 30 Days", since a read past them is gone and its page would look unread.
- **A period on Most Read**, with Pro on: 30 Days, 90 Days and 1 Year (`GET .../overview?days=30|90|365`, clamped to
  what is kept). The default is 30 Days. A period longer than the tier keeps carries the Pro mark, and choosing it
  opens the upgrade offer rather than the period. Under the card sits the quiet ProNote: "Free keeps 30 days of what
  agents read and asked. Pro keeps a year." with See Pro. A collaborator who cannot act on the owner's tier reads
  "History here is kept for 30 days." With Pro off the card stays as today (7 days, no period).

## Public Knowledgebases

Owner, 2026-11-22 (in place of the earlier ruling that publishing was not part of Pro): the knowledgebases an owner
has published to the web at once, over all their knowledgebases, are limited by the owner's tier. Free publishes 1,
Pro 10 and Pro for Teams any number. Everything else about Publish to the Web works on every tier, and a published
site's readers and searches are never limited. The rule in full is [Publish to the Web](publishing.md) "Tiers".

- **Counted** by the subscription service's `publicKnowledgebases` gauge, one entry per published knowledgebase, its
  document id. Publish asks for one before anything goes public; Unpublish, the knowledgebase's purge and a move to
  another owner give it back.
- **At the limit** Publish is refused (`publish_limit_reached`, 409, with `limit: 'publicKnowledgebases'`, `used` and
  `max`), and the dialog says "You have 1 public Knowledgebase, the most Free publishes. Unpublish one to publish
  this, or publish up to 10 with Pro." with Upgrade to Pro for the owner or a team admin, Ask an Admin for a team's
  other members (the offer's words dropped), and the plain limit for anyone else.
- **Sites from before** (published before Pro, or while the service could not be reached) keep answering until
  their first count, as roadmaps do.
- **A guest's knowledgebase** has Free's 1, counted in the knowledgebase itself, and nobody is offered an upgrade.

## Share roles

The limits are the knowledgebase's, and the same for everyone who uses it. Only the owner, and the owning team's
admins, are offered an upgrade. A team's other members are offered Ask an Admin. Viewers and Participants see the
meters and notices with no offer.

## Telemetry

`KnowledgePageLimit` (an add refused at the tier's limit), `KnowledgeImportTrimmed` (an import that left pages out)
and `KnowledgeAiCreditsUsed` (a built-in call refused for the month), each counted, with no item or person named.
