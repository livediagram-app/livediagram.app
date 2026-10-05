# Community

**Community** is the public gallery of documents people are proud of. A signed-in owner **publishes** a document to
Community with a title, a description, a category and a few tags; anyone can browse the gallery, filter it, open a
post's document read-only, like it, and make their own copy of it. It lives in its own app, `apps/community`, served at
`/community`.

## Why

[Purpose](../001-project-vision/purpose.md) makes the growth model distribution: every shared document is a way in. Two
things are missing today. A visitor who has never used livediagram has no way to see what people actually make with it
beyond our own templates, and a person who has made something good has nowhere to show it beyond sending a link. Community
is both: inspiration for the first, recognition for the second, and a starting point for anyone (copying a post is a
better start than a blank canvas).

## Terms

- **Community**: the gallery as a whole; the app at `/community`. Never "gallery", "showcase" or "explore" in copy or code.
- **Post** (`CommunityPost`): one document published to Community. A document has at most one post.
- **Author**: the signed-in owner who published the post. Shown by their participant name, colour and picture
  ([Profile picture](../014-identity/profile-picture.md)); their owner id is never exposed.
  An author may share anonymously, and is then shown as "Anonymous".
- **Category**: exactly one per post, from a closed set (below). The coarse filter.
- **Tag**: zero to five per post, free-form but normalised (below). The fine filter.
- **Like**: one per browser per post. **Copy count**: distinct people who copied the post's document.
- **Report**: a visitor flags a post. **Hidden**: a post taken out of Community by reports or by an operator.
- **Operator**: a person whose user id is listed in the api worker's `COMMUNITY_OPERATOR_IDS`; may hide and restore
  posts. Not a team role and not a product tier.

## What a post shows

A post is **live**: it always shows the document's latest saved state, never a snapshot taken at publish time. Editing the
document after publishing changes what Community shows, on the next load (cards refresh with the
[document snapshot](../006-document/document-snapshots.md) cache; an open viewer does not stream changes). The publish
dialog says so plainly.

A post shows every tab of the document. A document that is empty (no snapshot renders) cannot be published.

## Publishing

- **Who**: the document's owner, signed in. A guest sees the Community option with a one-line explanation and a
  **Sign in to share** button ([Auth + guest access](../014-identity/auth-and-guest-access.md): the editor itself never
  asks anyone to sign in; only publishing does). Team-library documents
  ([Team shared documents](../013-workspace/team-shared-documents.md)) cannot be published: they are not one person's to
  give away.
- **Where**: the Share dialog carries a **Community** section beneath the share links. Unpublished, it invites the owner
  to share the document with the Community; published, it shows the post (title, category, likes, copies), a link to it,
  **Edit Listing** and **Remove From Community**.
- **The Publish dialog** asks for:
  - **Title**: 3 to 80 characters, prefilled with the document name.
  - **Description**: 20 to 500 characters, with a live counter. A prompt suggests what makes a description useful
    ("what it shows, how you made it, how someone could reuse it").
  - **Category**: one, chosen from compact chips that wrap; the chosen category's description shows once beneath them.
  - **Tags**: up to five, typed as chips, with suggestions from the most used tags.
  - **Share Anonymously**: on by default. The post then shows "Anonymous" (no name, no picture) wherever its
    author would appear: cards, the post page, the Community bar. The author still owns and manages it. Edit Listing
    can switch it either way. Posts published before this option existed stay named.
  - A preview of the card as it will appear, and the consequences in plain words: anyone can view and copy it, it
    stays in step with your edits, comments are not shown, you can remove it at any time.
- Publishing again on a published document (**Edit Listing**) updates the title, description, category and tags; the
  likes, copies and publish date stay.
- **Remove From Community** deletes the post, its likes, copies and reports. Copies people already made are theirs and
  are untouched.
- An owner can have at most 50 posts.

## Categories

The closed set, in display order. The id is stored; the label is shown.

| id             | Label               | For                                           |
| -------------- | ------------------- | --------------------------------------------- |
| `architecture` | Architecture        | Systems, cloud, infrastructure, software      |
| `flows`        | Flows & Processes   | Flowcharts, processes, journeys, state        |
| `planning`     | Planning            | Roadmaps, kanban, timelines, gantt            |
| `workshops`    | Workshops           | Retrospectives, event storming, brainstorming |
| `mindmaps`     | Mind Maps           | Mind maps, concept maps, notes                |
| `design`       | Design & Wireframes | Wireframes, mockups, layouts                  |
| `data`         | Data & Databases    | Entity diagrams, schemas, tables              |
| `learning`     | Learning & Teaching | Explainers, lessons, study notes              |
| `infographics` | Infographics        | Illustrate pages and articles                 |
| `art`          | Drawing & Art       | Sketches, illustrations, Draw mode            |
| `other`        | Something Else      | Anything that fits nowhere above              |

## Tags

A tag is normalised before it is stored or matched: trimmed, lowercased, inner whitespace and underscores become a single
hyphen, any character other than `a-z`, `0-9` and `-` is dropped, repeated and edge hyphens collapse. After normalisation
it is 2 to 24 characters, or it is rejected. Duplicates on one post collapse. The same function runs in the editor (as you
type) and on the worker (authoritative).

## The Community app

`apps/community` is a static export (`basePath: '/community'`) like Help and Telemetry. It talks to the api at
`/api/community/*` from the browser; it carries no sign-in. Pages:

### Gallery (`/community/`)

- A welcoming header: the heading, one line on what Community is, and a **Share Your Own** call to action into
  Explorer Home (`/explorer/home`), where the person's documents are: sharing starts from a document they already have.
- **One search box holds the whole query in words.** Plain words search titles, descriptions and tags; each
  `#tag` is a tag the document must have (all of them); one `category:<id>` keeps to one category; one `sort:loved`
  or `sort:copied` orders the results (All and Newest, the defaults, need none). Anything can be typed; three
  controls inside the box's right edge write the same words, each applied at once:
  - **Category**: All Categories, then each category with its count of documents. A category with none is left out
    unless it is the one chosen. Choosing one writes its `category:` word (All removes it).
  - **Tags**: the most used tags with their counts. Choosing one adds its `#tag`; choosing it again takes it out.
    The button shows how many tags the search holds.
  - **Sort**: Newest, Most Loved (likes), Most Copied. Choosing one writes its `sort:` word (or removes it for
    Newest).
  - Each control shows an icon and its current value; on phones only the icon, so all three fit beside the text.
- A responsive grid of **cards**: the post's live image, title, category, up to three tags, the author (picture or
  initial in their colour, and name) with when it was shared beneath ("2 days ago", whole months after the first
  month, whole years after the first year; the full date on hover), likes and copies. The card opens the post page; the heart likes it in place.
- **Load More** pages through results (24 per page).
- The whole query lives in the URL as `q` (with its `#tag`, `category:` and `sort:` words), so a filtered view can be
  shared and survives a reload. Older `tag`, `category` and `sort` parameters are read into the search.
- States: a skeleton grid while loading; an empty state per cause (nothing published yet, inviting the person to share one from Explorer Home; no match for these filters
  with a Clear Filters button); an error state with Try Again.

### Post (`/community/post/?id=<postId>`)

- An **interactive preview** of the document (the read-only [embed](../013-workspace/embeds.md) in a frame, so it pans,
  zooms and switches tabs). If the frame has not loaded after 15 seconds, the card image shows instead.
- Title, author, publish date, category, tags (each opens the gallery with its `#tag` in the search), and the full
  description.
- **Like** (toggles), **Make a Copy** (opens the document in the editor and copies it into the visitor's own documents in
  one step), **Open Document** (the read-only viewer, full screen) and **Report**.
- **More Like This**: up to six other posts in the same category, most loved first.
- A post that does not exist, was removed or is hidden shows a friendly not-found with a way back to the gallery.

## Viewing a post's document

Opening a post's document uses a dedicated **community link**: a view-role share link the post owns. It differs from an
ordinary view link in exactly these ways:

- It never expires, covers all tabs, and is not listed among the owner's share links (the Community section manages it).
- Visitors never join the document's realtime room: no presence, no cursors on the author's document, no live stream. They
  see the latest saved state on load.
- Visitors are not asked their name, are not added to "Shared with you", and the author is not emailed that someone
  joined.
- It is a **content-only pass**: it reads the document, its tabs and images, and copies it. Nothing else a view link
  can reach answers it: not comments or their authors' pictures, not the document's timeline, not agent changeset
  history, not the Q&A board, and not any door added later (it fails closed). Comment threads are left out of the
  tabs it reads, and assigned actions keep their text and status but not who they are assigned to or by.
- Visits and copies through it are not recorded in the author's timeline (the copy count stands in for copies).
- While the post is hidden the link grants nothing, its image included, except to an operator reviewing it.
- The viewer shows a slim **Community bar**: "Shared to the Community by <author>", **Back to Community** and **Make a
  Copy**.
- It is read-only for **everyone, the author included**: the post page's preview and Open Document never open the document
  for editing. The author's Community bar offers **Edit Your Document** (their own document) in place of Make a Copy.

Making a copy works as for any view link ([Auth + guest access](../014-identity/auth-and-guest-access.md)), signed in or
not, and the copy carries exactly what the viewer shows: no comments, no people on its actions. Each distinct person
who copies a post's document counts once toward its copy count. The post page's Make a Copy opens the viewer with
`?copy=1`; that parameter copies only through a Community link, never through any other share link.

A share password ([Share password](../013-workspace/share-password.md)) and a post exclude each other: a document with a
password cannot be published, and a published document cannot be given a password (the Share dialog explains why).

## Document lifecycle

- **Trash**: a post whose document is in the Trash is not listed, and its post page shows not-found. Restoring the
  document lists it again.
- **Permanent delete**: deletes the post with it.
- **Moving into a team library**: the post stops being listed, since team documents cannot be published.
- **Deleting an account**: deletes the account's posts with its documents, and the record of copies it took of other
  people's posts (their copy counts drop by one).
- **Copying** a published document does not publish the copy.

## Likes

One like per browser per post, keyed by a random **community key** the Community app keeps in the browser. It is not the
guest owner id: liking must never put an owner credential on the wire from a public page. Liking again is idempotent;
unliking removes it.

## Reports and moderation

- Anyone can report a post with a reason (Spam, Offensive, Personal Information, Copyright, Something Else) and an
  optional note of up to 300 characters. One report per browser per post.
- A post is **hidden automatically** once reports have come from three distinct browsers on three distinct networks.
  The network is recorded only as a one-way hash of the address salted with the post id, so it cannot be compared across
  posts.
- Operators see a **Moderation** page in the editor (`/moderation`, signed in, operator only) listing reported and hidden
  posts with their reports, can open a hidden post's document to review it, and can **Hide** or **Restore** a post. Restoring clears its reports. An operator's decision
  sticks: a restored post is hidden automatically again only by three new reports.
- An author is not told their post was hidden; the Community section in their Share dialog shows it as hidden.
- With `COMMUNITY_OPERATOR_IDS` unset (a fresh self-host) automatic hiding still works and nobody can moderate by hand.

Hiding takes effect at once at the api. What browsers and caches may still hold is short: a post, a list or a card
image for at most 30 seconds, the home page's six for a minute. An operator's view of a hidden post is never stored.

## My Shares

A signed-in author can narrow the gallery to their own posts, to review them and see how they are doing.
**My Shares**, a toggle inside the search box (beside Category, Tags and Sort; an icon only on phones), writes
`is:mine` into the search, so it combines with every other search word and stays in the address like them.

- It lists the author's own posts, **hidden ones included** (marked **Hidden**; a hidden post's card opens the
  document in the editor, since its public page is gone). Trashed documents' posts are not listed.
- Above the grid, **Your Shares** totals all their posts, likes and copies, whatever the search narrows to.
- Signed out, it says **Sign in to see your shares.** with a Sign In button that returns to the same view; with
  nothing shared yet, **You haven't shared anything yet.** with Share Your Own.
- The rest of the Community needs no identity, so the Community app loads Clerk only once My Shares is on, and a
  build without a Clerk key does not offer it. The api answers `GET /api/community/mine` (Clerk session
  required, never cached); the public list ignores `is:mine`.
- Turning it on is tracked as `Community·Selected·Mine`.

## Featured on the home page

The landing page carries a **From the Community** section under the template gallery: six documents, the
most liked over the last three months, topped up (when fewer than six were liked in that time) with the best
of all time by likes and copies, newest first on a tie. Public posts only, credited as they are in the
gallery (Anonymous when the author chose it). The page is static, so the six load after it: placeholder cards
hold their space, and with nothing to show the section says the Community is just getting started. **Explore
the Community** leads to the gallery. The api answers `GET /api/community/featured`, cacheable for one
minute.

## Where Community is linked from

- The shared apps menu in every header (Welcome, Editor, Explorer, **Community**, Help, Telemetry).
- The shared site footer, and the marketing sitemap (`/community/`).
- The Share dialog's **Community** section, and the [help article](../018-help/help-app.md) Sharing to the Community
  under Collaboration, Sharing and Embeds.

## Abuse limits

Publishing, liking and reporting are rate limited per network by the worker's existing limit bindings. Bodies are capped
at the sizes above. Public list responses are cacheable for a short time.

## Telemetry

Under [Telemetry](../017-telemetry/telemetry.md), category `Community`, reusing the closed action vocabulary and adding
only `Liked`, `Unliked` and `Reported`. Types are preset values, never post content:

- Editor: `Community·Shared·<Category>` on publish, `Community·Changed·<Category>` on Edit Listing,
  `Community·Removed·Post` on Remove From Community.
- Community app: `Community·Opened·Post`, `Community·Liked·Post`, `Community·Unliked·Post`, `Community·Copied·Post`,
  `Community·Reported·<Reason>`, `Community·Searched·Query`, `Community·Selected·<Category|Tag|Sort>` (Tag and
  Sort from the controls inside the search box).
- Operators: `Community·Changed·<Hidden|Listed>`.
- Page views for the Community app as for any other app, under app `Community`.
- The [telemetry dashboard](../017-telemetry/telemetry.md) has a **Community** tab and a Community group of cards
  (publishing, engagement, discovery, moderation).

`<Category>` is the category id in PascalCase (`Architecture`, `Flows`, ...); `<Reason>` is `Spam`, `Offensive`,
`PersonalInfo`, `Copyright` or `Other`.

## Self-hosting

Community works with zero external services: D1 holds posts, the snapshot cache renders images, the app is static. A
self-host can leave it as is; nothing is published until someone publishes. Publishing and My Shares need sign-in, so
a build without a Clerk key offers neither; the Community app reads the same `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` as
the editor.

## Out of scope

- Featured posts and staff picks; author profile pages; comments on posts; following authors.
- Publishing a single tab; frozen snapshots.
- Sign-in inside the Community app.
