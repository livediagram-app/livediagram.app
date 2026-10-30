# Community

**Community** is livedocuments's public gallery of documents people are proud of. A signed-in owner **publishes** a document to
Community with a title, a description, a category and a few tags; anyone can browse the gallery, filter it, open a
post's document read-only, like it, and make their own copy of it. It lives in its own app, `apps/community`, served at
`/community`, and in the landing page's **From the Community** section.

## Where it lives

The **listings** (posts, tags, likes, copies, reports, hidden) are kept by liveworkspace, in its Community service at
`liveworkspace.app/api/community`, shared by every liveworkspace app and described in
[liveworkspace's Community](../../../../liveworkspace/docs/specs/007-community/community.md), which also sets what every
app's Community has in common and the shared pieces it is built from. livedocuments keeps the **documents**: who owns one,
whether it may be published, its community link, and the link's doors (the read-only view, the card image and
copying). Its pages read the gallery, posts, likes and reports straight from the service, for `livedocuments.app` posts
only; its api publishes, edits and removes a post on the owner's behalf, answers My Shares, and tells the service
where each published document stands (public, closed, away or gone) right after a change and from the document's own room
every ten minutes. A post hidden after reports closes its link here within those ten minutes.

livedocuments had a Community of its own until October 2026, removed while the products split into their own sites. This
is its return, on the platform's service: nothing from before was carried over.

## Why

A team that has written a good report, a deck that landed or an infographic people keep asking for has nowhere to show it beyond sending a link, and a visitor has no way to see what people make with livedocuments beyond our own templates. Community is both, and copying a post is a better start than a blank page.

## Terms

- **Community**: the feature as a whole; the app at `/community`. Its name in copy is always Community. The
  **gallery** is its browsing page, the landing page **showcases** it and invites people to **Explore the
  Community**.
- **Post**: one document published to Community. A document has at most one post.
- **Author**: the signed-in owner who published the post, shown by their name and colour, or as "Anonymous" when
  they chose to share anonymously. Their owner id is never exposed.
- **Category**: exactly one per post, from livedocuments's closed set (below). **Tag**: zero to five per post, normalised
  as the platform spec says.
- **Like**: one per browser per post. **Copy count**: distinct people who copied the post's document.
- **Report**: a visitor flags a post. **Hidden**: a post taken out of Community by reports, for good.

## Categories

livedocuments's closed set, in display order (the platform spec's "Categories"). The id is stored; the label is shown; the
line beside it is the description the publish dialog shows for the chosen category.

| id             | Label                 | For                                        |
| -------------- | --------------------- | ------------------------------------------ |
| `articles`     | Articles & Reports    | Reports, articles, write-ups, white papers |
| `decks`        | Slide Decks           | Talks, pitches, reviews, lessons           |
| `infographics` | Infographics          | Posters, charts and explainers             |
| `guides`       | Guides & How-Tos      | Handbooks, onboarding, step-by-step guides |
| `proposals`    | Proposals & Briefs    | Proposals, briefs, plans, one-pagers       |
| `newsletters`  | Newsletters & Updates | Newsletters, announcements, team updates   |
| `learning`     | Learning & Teaching   | Explainers, lessons, study notes           |
| `other`        | Something Else        | Anything that fits nowhere above           |

## What a post shows

A post is **live**: it always shows the document's latest saved state, never a snapshot taken at publish time, every
one of its pages. Editing the document after publishing changes what Community shows on the next load; an open
viewer does not stream changes. The publish dialog says so plainly.

## Publishing

- **Who**: the document's owner, signed in. A guest sees the Community tab with a one-line explanation and **Sign In to
  Share** (the editor itself never asks anyone to sign in; only publishing does). A team library's document
  ([Team shared documents](../013-workspace/team-shared-documents.md)) cannot be published: it is not one person's to give away. A
  post its document's current owner did not make (it came with the document from a team library) is not theirs: their Share
  dialog shows none, and publishing replaces it with their own.
- **Share roles**: only the owner publishes, edits a listing or removes it. An Editor, Participant or Viewer of a
  shared document sees no Community tab (the Share dialog's Passes are the owner's too). Through a community link everyone,
  the author included, is a Viewer of a content-only pass (below).
- **Where**: the **Community** tab of the shared Share dialog, beside Passes, the same everywhere it opens: the
  editor's Share, livedocuments's Explorer, and the Explorer on liveworkspace.app. Unpublished, it invites the owner to share
  the document with the Community; published, it shows the post (title, category, likes, copies), a link to it, **Edit
  Listing** and **Remove From Community**; hidden, it says **Hidden after reports** with neither.
- **Something to show**: its first tab's first page has at least one element (counted, never rendered): that page is the post's card picture. When the editor holds that tab and it is empty, the tab holds **Share to
  Community** and says why beside it: "Add something to your first page before sharing: it is the picture on your Community card." Elsewhere the server's refusal says it.
- **The Publish dialog** asks for a **Title** (3 to 80 characters, prefilled with the document's name), a
  **Description** (20 to 500, with a live counter and a prompt: what it shows, how you made it, how someone could
  reuse it), one **Category** (compact chips, the chosen one's description beneath) and up to five **Tags** (chips,
  with suggestions from the most used). **Share Anonymously** is on by default. A preview shows the card as it will
  appear, and the consequences in plain words: anyone can view and copy it, it stays in step with your edits,
  comments are not shown, you can remove it at any time.
- The publish dialog takes the Share dialog's place while it is open; closing it brings the Share dialog back, so two
  modals never stack. Focus follows the controls that leave, as livediagram's does.
- **Edit Listing** updates the title, description, category, tags and anonymity; likes, copies and the publish date
  stay. **Remove From Community** asks in place (**Keep It**, **Remove**) and deletes the post with its likes, copies
  and reports; copies people already made are theirs.
- A share password and a post exclude each other: a document with a password can't be published ("Remove the share
  password to share it to the Community."), and a listed post locks Password Protection ("Remove it from the
  Community to set a password.").
- **Public**: while the post is listed, the document's visibility badge reads **Public** in the editor header and on every
  Explorer row and card (it wins over Private, Shared and Team; only This Browser beats it). A post that is not
  public gives no badge.
- An owner can have at most 50 posts in livedocuments's Community.

## The gallery

`apps/community` is a static export (`basePath: '/community'`), a thin shell on the shared Community pages
(`@liveworkspace/community-site`). It behaves as every app's gallery does, as livediagram's
[Community app](../../../../livediagram/docs/specs/025-community/community.md#the-community-app) describes, in
livedocuments's words:

- **Gallery** (`/community/`): the welcome header with **Share Your Own** into Explorer Home; one search box holding
  the whole query in words (`#tag`, `category:<id>`, `sort:loved|copied`, `is:mine`) with Category, Tags, Sort and
  My Shares inside its right edge; a grid of cards (the post's live image, title, category, up to three tags, the
  author, when it was shared, likes and copies) that cascade in; Load More (24 per page); the query in the URL;
  skeleton, empty and error states.
- **Post** (`/community/post/?id=<postId>`): an interactive read-only preview of the document (its embed), the title
  block, and the actions: **Make a Copy** and **Open Document** side by side, then Like, the copy count and Report;
  **More Like This** below. A missing, removed or hidden post shows a friendly not-found.
- **Search engines**: the small Worker in front of the pages gives each post's page its own title, description,
  canonical and JSON-LD, answers a missing post 404, and serves `/community/sitemap.xml`.

## Viewing a post's document

A post opens its document through a dedicated **community link**: a view-role share link the post owns, never expiring,
covering every tab, not listed among the owner's share links. Visitors never join the document's room (no presence, no
cursors, no live stream), are not asked their name, are not added to "Shared with you", and the author is not
emailed. It is a **content-only pass**: it reads the document, its tabs and images, and copies it; no other door answers
it, including any added later. What it shows is redacted for strangers: comment threads and their authors, who actions are assigned to and by, and presenter notes stay out; the document carries no owner
name, colour, folder or origin, and every card image and per-tab image is drawn from the redacted document. While the post
is not public the link grants nothing and answers only "not found". The viewer shows the slim **Community bar**
("Shared to the Community by <author>", **Back to Community**, **Make a Copy**; the author gets **Edit Your Document**).

Making a copy works as for any view link, signed in or not, and the copy carries exactly what the viewer shows. A
copy through a Community link is named after the post. Each distinct person who copies counts once.

## Document lifecycle

- **Trash**: the post is not listed and its page shows not-found; restoring the document lists it again.
- **Permanent delete** deletes the post. **Moving into a team library** stops it being listed.
- **Deleting an account** deletes its posts with its documents, and the copies it took stop counting.
- **Copying** a published document does not publish the copy.

## Likes, reports and moderation

As the platform spec sets for every app: one like per browser, counted at most five per network; a report with a
reason (Spam, Offensive, Personal Information, Copyright, Something Else) and an optional note; three browsers on
three networks hide a post, and **hidden is final**. Nobody reviews posts by hand.

## My Shares

A signed-in author narrows the gallery to their own posts with **My Shares** (`is:mine`), hidden ones included and
marked **Hidden**, with **Your Shares** above them totalling posts, likes and copies. The api answers
`GET /api/community/mine` (signed in, never cached).

## Featured on the home page

The landing page carries a **From the Community** section, like livediagram's: six documents, the most liked over the
last three months, topped up with the best of all time. Placeholder cards hold their space while they load; with
nothing to show it says the Community is just getting started. **Explore the Community** leads to the gallery, with
**How the Community Works** beside it. The service answers
`GET liveworkspace.app/api/community/featured?app=livedocuments.app`, from Cloudflare's edge cache for a minute.

## Where Community is linked from

- The Explorer panel's footer row of links, the shared site footer and the marketing sitemap (`/community/`).
- The Share dialog's **Community** tab, and the help articles **Sharing to the Community** and **Finding Documents in
  the Community** under Collaboration, Sharing.

## Telemetry

Category `Community`, as livediagram's: `Community·Shared|Changed·<Category>` and `Community·Removed·Post` from the
Share dialog; `Community·Opened|Liked|Unliked|Copied·Post`, `Community·Reported·<Reason>`,
`Community·Searched·Query` and `Community·Selected·<Category|Tag|Sort|Mine>` from the gallery. `<Category>` is the
category's type (its id in PascalCase).

## Turning the Community off

Setting the api Worker's `COMMUNITY_ENABLED` to `false` (or `0`, `off`) switches it off with no redeploy:
`GET /api/capabilities` reports `communityEnabled: false`, every Community route and community link answers 404, and
it disappears from every interface (the footer links, the landing section, the Share dialog's tab, the Public
badge). Nothing is deleted. Until the capabilities answer, the pages assume it is on.

## Configuration

The api Worker needs `COMMUNITY_KEY` (the same value as the service's `COMMUNITY_KEY_LIVEDOCUMENTS`) and
`COMMUNITY_URL`; the pages `NEXT_PUBLIC_COMMUNITY_API`. Without the key, livedocuments has no Community.

## Out of scope

- Hand-picked featured posts; author profile pages; comments on posts; following authors.
- Publishing a single tab or page; frozen snapshots.
