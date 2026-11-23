# Publish to the Web

Owner, 2026-11-21, picking it from the lead's suggestions: "Yes - remember when we tackle pro later that we might
make that a pro feature". Work Tracker 1339.

Status: **built, verified in a browser locally** ([blueprint](blueprints/publishing.md)). The details below were
decided by the builder and stand until the owner overturns them; each is marked "(decided)".

Teams keep external writing in a knowledgebase: product help, policies for customers, a handbook for candidates.
Sharing reaches only people who open the knowledgebase in the editor. **Publish to the Web** makes the whole
knowledgebase, or one section of it, a public, read-only site that anyone can read and search engines can find,
with no account and no editor.

## Domain language

| Term                   | Means                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **public site**        | What publishing makes: the published pages at `/kb/<site>/`, read by anyone, written by no one.                     |
| **site address**       | The `<site>` part of the address, the knowledgebase's own, chosen by its Editor.                                    |
| **page address**       | The `<page>` part (`/kb/<site>/<page>`), made from the page's title, kept when the page is renamed.                 |
| **section**            | One page and its subpages, published on their own instead of the whole knowledgebase.                               |
| **published snapshot** | What the public site reads: the published pages as the publish wrote them, kept in the knowledgebase's own storage. |

"Public" stays the Explorer's Space word ([Knowledgebases and pages](knowledgebases-and-pages.md#domain-language)):
the interface says "Publish to the Web", "public site" and "Published", never "Public" for this.

## Who may publish

| Action                                                   | Editor | Participant | Viewer | Agent | Anyone |
| -------------------------------------------------------- | ------ | ----------- | ------ | ----- | ------ |
| See whether the knowledgebase is published, and its link | yes    | no          | no     | no    | no     |
| Publish, change what is published, Unpublish             | yes    | no          | no     | no    | no     |
| Read the public site, search it                          | yes    | yes         | yes    | yes   | yes    |

- An Editor of the whole knowledgebase, in person, signed in, on a knowledgebase saved to the server. A
  knowledgebase kept Offline has no server to publish from; a guest has no account to publish as; an agent's token
  is refused (`needs_a_person`), as Verify is: a person decides what goes public (decided).
- A Participant is an Editor minus the knowledgebase's settings, style and automations
  ([Share roles](knowledgebases-and-pages.md#share-roles)); what goes public is the knowledgebase's to decide, so it
  is an Editor's, like the style (decided). A Participant, a Viewer, a link visitor and an embed are never offered
  it, and the api refuses them (`forbidden`).
- **One capability check** decides whether publishing is offered at all (`publishingOffered`, the blueprint's
  P1). It answers yes for every knowledgebase on every tier. The editor hides the menu row and the api refuses
  (`publishing_unavailable`) when it is off. How many knowledgebases an owner publishes at once is the tier's
  ("Tiers" below), never this check.

## Publishing

- **Publish to the Web** is a row of [the knowledgebase's menu](knowledgebases-and-pages.md#the-knowledgebases-menu),
  after Export, for the Editors above. It opens the **Publish to the Web** dialog (the centred dialog, a bottom
  sheet on a phone).
- The dialog shows, top to bottom:
  - **The state**: "Not Published", or "Live on the Web" with the site's link, **Copy Link** and an open-the-site
    button, and when it was last published. On a phone the two buttons sit on a row of their own under the link.
  - **What to Publish**: Whole Knowledgebase, or one section ("Onboarding and Its Subpages"), picked from the page
    tree in its order. A section's first page is the site's front page.
  - **Address**: `liveknowledge.app/kb/` and the site address, filled from the knowledgebase's name the first time.
    3 to 48 lowercase letters, digits and single hyphens, starting and ending with a letter or digit. An address
    another knowledgebase holds, or one the product keeps for itself (`api`, `new`, `search`, `sitemap`, and the
    rest of the blueprint's list), is refused with a line under the field that says why.
  - **Options**: **Hide From Search Engines** (off: the site asks search engines not to index it, and leaves the
    sitemap empty) and **Show Who Wrote Each Page** (off: no person's name is published; on, each page names the
    people who wrote it, as Page Health does).
  - **What Goes Public**: how many pages the site will hold, each named, and the pages left out with why: Pending
    Approval, Rejected, or Empty (a page with no saved writing). It reads the knowledgebase as it stands and changes
    as the section is picked. Under it, the line "Only saved writing goes public: never drafts, comments, Page
    Health or pages waiting for approval. A page's pictures, drawings and cover go public with it."
  - **Unpublish** (only while published), then **Publish** (or **Update Site** while published) as the primary.
- **Publish** writes the published snapshot and answers with the site as it now stands; the link is live at once.
  The dialog stays open on the published state, so the Editor can copy or open the link.
- **Unpublish** asks first: **Unpublish This Site?** "The public site and every page address stop working within a
  minute. You can publish it again." It removes the published snapshot and frees the site's addresses.
- **Telemetry:** `UI` `Used` `PublishSite` on a publish or update, `UI` `Removed` `PublishSite` on an Unpublish;
  never the address, a page or a name.

## Tiers

With Pro off nothing here applies: an owner publishes as many knowledgebases as they hold. With
[Pro on](../../../../liveworkspace/docs/specs/019-subscription/subscription.md) the knowledgebases an owner has
published at once, over all their knowledgebases, are limited by the **owner's tier** (Free 1, Pro 10, Pro for Teams
unlimited; owner, 2026-11-22): a team's for a knowledgebase in a team's library, otherwise the owning person's
([tiers.md](tiers.md) "Public Knowledgebases").

- **Publish** asks the subscription service for one more (its `publicKnowledgebases` gauge, keyed by the
  knowledgebase's id) before anything goes public. At the limit it is refused with **409** `publish_limit_reached`,
  carrying `limit` (`publicKnowledgebases`), `used` and `max`, and nothing is published. If the subscription service
  refuses the api's own request, nothing is published uncounted and the request fails as a server error, never as
  a limit.
- **Changing** a published site (another section, address or option) never counts, and is never refused by a tier.
- **Unpublish**, the knowledgebase's purge and the knowledgebase moving to another owner each give the place back.
  A knowledgebase in the Trash or archived keeps its place: it can come back.
- **A site answers only while it holds a counted place.** The site keeps a mark: counted, not counted, or never
  counted. One whose place was refused holds none: every public address answers the same not-found as any other
  miss, the snapshot and its addresses are kept, and the dialog reads it as not published, with the limit beside it.
  It asks for its place again the next time it is counted (the dialog's read, a Publish, the daily upkeep) and,
  given one, the same addresses answer.
- **Sites from before** (published before Pro, or while the subscription service could not be reached) were never
  counted and keep answering until their first count (the dialog's read, a Publish, the knowledgebase's daily
  upkeep). Each knowledgebase counts its own, so the ones counted first keep their places: within the owner's limit
  none ever comes down; past it the rest hold none until the owner has room (unpublishing one, or a higher tier).
  Nothing is deleted.
- **A knowledgebase that moves** to another owner or team gives its place back and asks the new owner for one by
  the same rule. A move is never a way past a limit.
- **A higher tier takes effect at once:** every Publish asks the service, which reads the owner's tier as it is now.
- **A guest's knowledgebase** (its owner has no account) is held to Free's 1, counted in the knowledgebase itself,
  which its one site always fits. The subscription service is never asked about it, `owner` is absent and
  `guest: true` is sent in its place. Nobody is offered an upgrade there.
- `GET` carries `usage` (`used` when known, and `limit`, null for unlimited) and `owner` (the owner's scope) so the
  dialog can say the limit and ask the subscription service which action to offer. All three are absent with Pro
  off.

### What the dialog shows

Only with Pro on. A knowledgebase not published, while its owner has published every knowledgebase their tier
allows (the state's `usage`, or a refused Publish's own numbers), shows a notice above What to Publish: "You have 1
public Knowledgebase, the most Free publishes. Unpublish one to publish this, or publish up to 10 with Pro." Its
button is **Upgrade to Pro** for the owner or a team admin. A team's other members read the sentence without its
offer, "...Unpublish one to publish this.", with **Ask an Admin**; anyone else reads it with no button (the shared
LimitNotice). On Pro the sentence names Pro and offers nothing more: "You have 10 public Knowledgebases, the most
Pro publishes. Unpublish one to publish this." A guest's knowledgebase holds at most its own one site, so it never
meets the limit. Publish stays on: the numbers may be from before an upgrade, so a press asks the api, which answers with the
limit when it still holds.

## What goes public, and what never does

The public site reads only the published snapshot: nothing of the knowledgebase reaches it except what the publish
wrote there (the coordinator's decision, 2026-11-21: "read from a published snapshot, so nothing unpublished can
reach them").

- **Published:** each page in scope's saved writing (its blocks, tables, contents, footnotes and links), its title,
  its icon when it is an emoji, its place in the tree, the knowledgebase's name and its Style (theme accent, fonts,
  text size, line spacing, heading style), and when each page was last saved.
- **Also published (Work Tracker 1346):** what is placed in a published page's saved writing (its pictures, drawings
  and charts, each drawn where its spot in the writing sits, as a reader of the page sees it) and the page's cover (a
  picture, a gradient, or an animated cover shown still: the public site runs no script). See "Pictures on the public
  site" below for which pictures a reader may fetch.
- **Never published:**
  - drafts: only the saved writing is read ([Reading and editing a page](editing.md));
  - pages Pending Approval or Rejected ([Approval](approval.md)): left out, with their subpages kept in the tree
    under the nearest published ancestor;
  - comments: the threads at a page's foot, margin notes and their marks in the writing, actions;
  - Page Health and verification: owners, Verified, Review Due, reviews, approvals, conflicts, page links' health;
  - Ask, AI Knowledge, AI Settings, agents and their suggestions;
  - people: no name, email, avatar or account id, unless **Show Who Wrote Each Page** is on, and then only the
    names of the people who wrote each page (never an agent's token, an email or an id);
  - the knowledgebase's id, its tab ids, its share links, its owner and team;
  - any other picture: one in no published page's saved writing or cover (the gallery, a picture placed only in a
    draft, on a page left out, or in another knowledgebase), and a picture's own name, owner and id beyond its
    address.
- **Page links** to another published page link to its page address; a link to a page that is not published reads
  as its text, never as a link. Links to the web keep their address (http, https and mailto only).
- **Keeping up:** a save of a published page, a rename, a move, a Style change or an approval decision reaches the
  public site with the next read of it (the snapshot of each changed page is rewritten then), and within a minute
  everywhere (the edge's copy, below). A page that becomes Pending Approval leaves the site the same way.

## Pictures on the public site

Owner's card, Work Tracker 1346: "A published help page with screenshots or diagrams loses them ... Showing them needs
a public, read-only route to just the media a published page uses."

- **Which pictures may be fetched:** a picture is public while, and only while, a page in the published snapshot
  places it: a picture element in the page's saved writing (one standing in one of its spots), or the page's cover
  picture, and the knowledgebase may serve it ([placement grants](../009-elements/images.md#placement-grants)). Nothing else of the
  media service is reachable from the public site: not the gallery, not a picture of the same owner, not one placed
  only in a draft, a left-out page or another knowledgebase (decided).
- **How a request proves it:** a page's pictures are addressed `/kb/<site>/media/<picture>`. The address names the
  site, never a knowledgebase id; the site's knowledgebase answers from its published snapshot, which records each
  page's pictures when the page is drawn. The request carries nothing to trust (no token, cookie or signature): the
  check is the snapshot's alone, made again on every fetch the edge has not kept, so a picture that leaves the page
  (removed, the page left out, Unpublish) stops being served by the next refresh (decided).
- **Drawings and charts** are drawn into the page itself (as an image of what stands in their spot, made when the page
  is drawn), so they need no fetch; a picture inside a drawing is fetched as above.
- **Taken down:** removing a picture from a page, leaving the page out, or **Unpublish** takes its pictures down with
  it, within the same minute as the page (the edge's copy, below).
- **A picture that cannot be read** (the media service down, the picture deleted from its owner's gallery) answers
  404; its spot shows its frame empty.

## The public site

- **Addresses:** `/kb/<site>` is the front page (the section's first page, or the knowledgebase's first top-level
  page); `/kb/<site>/<page>` each page; `/kb/<site>/search?q=` the search; `/kb/<site>/sitemap.xml` the sitemap.
  A page's address is made from its title ("Release Process"
  is `release-process`), made unique in the site with `-2`, `-3`. **Renaming a page keeps it stable**: the old
  address answers a permanent redirect to the new one, and so does a site address an Editor changed, until the site
  is unpublished.
- **A page** shows the knowledgebase's name at the head with the search field, the page tree in a sidebar (the
  current page marked, its ancestors open), the breadcrumb, the icon and title, the writing, when it was updated,
  the writers when chosen, and **Previous** and **Next** in the tree's order. A small "Published with
  liveknowledge" line closes it. There is no editor chrome: no toolbar, no Edit, no comments, no sign-in.
- **The Style** is the knowledgebase's ([Knowledgebase Style](page-surface.md#knowledgebase-style)): the accent
  (held to 4.5:1 on the page in both appearances), the heading and body fonts, size, spacing and heading rule. The
  page follows the reader's light or dark appearance.
- **On a phone** the tree folds into a **Pages** button at the head; the column is the full width with a 16 px
  gutter.
- **Search** finds words in the published pages only (their titles first), from the field at the head; with no
  JavaScript it is a plain form. No result says so and offers the front page.
- **SEO:** each page has its title ("Release Process · Acme Help"), a meta description from its first words (160
  characters), a canonical address, Open Graph and Twitter tags (the page's title and description, with liveknowledge's
  own social image; a card drawn for each page is a later step), and the sitemap lists every published page with its
  last save. **Hide From Search Engines** adds `noindex` to every page (and the `X-Robots-Tag` header) and empties
  the sitemap.
- **Not found:** an address no site holds, a page not in the site and an unpublished site answer 404 with a plain
  page that names nothing of any knowledgebase.

## Caching, limits and abuse

- **At the edge:** every public page is kept by the edge for 60 seconds and revalidated by browsers each time;
  publishing, an update and Unpublish clear the copies the Editor's own edge holds at once, and every other edge's
  copy has gone within the 60 seconds. So a save, and an Unpublish, reach every reader within a minute.
- **Rate limits:** search is limited per visitor's network (it is the one public read the edge cannot keep); a
  publish is limited as every write is. Pages and the sitemap are cached reads. A picture is kept by the edge as a
  page is (60 seconds), and its fetches the edge has not kept are limited per visitor's network too, apart from
  search's, so a page full of pictures never uses a reader's searches (decided). A browser asking again for a
  picture it holds is answered "not changed" without the picture being read again.
- **Limits:** a site holds every page of the knowledgebase at most (500). A search query is 200 characters and 12
  words at most and answers 20 results.
- **No new infrastructure:** the public site is served by the api Worker (the router sends `/kb/` there) from the
  knowledgebase's own Durable Object; each site address is held by its own instance of the same Durable Object
  class, under a name no document can take. Nothing is added to D1, KV or R2. Pictures are read from the media
  service the api already reaches (`MEDIA_URL`, `MEDIA_KEY`), on the same Worker, with the same limiter.
