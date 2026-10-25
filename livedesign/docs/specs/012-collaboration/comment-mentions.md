# Comment Mentions

Typing `@` in a comment tags a teammate by name (`@thomas-mcclean`). The
mention shows as a chip in the thread, puts the thread on the teammate's
[Inbox](../013-workspace/inbox.md), and, if their settings allow, emails them.

It is the comment-thread sibling of [Assigned actions](assigned-actions.md): the same
people can be named (the design's team), the same Inbox collects it,
and the same kind of best-effort, server-verified email carries it.

## Who can be mentioned

The **members of the team whose library holds the design**, joined and
invited, except yourself. That is exactly the Assign Action picker's rule
([Assigned actions](assigned-actions.md) §2), for the same reason: a mention should reach someone
who can open the design and read the thread, and a teammate on another team
almost certainly cannot.

- On a **personal design** or for a **guest** there is nobody to mention.
  Typing `@` then shows one quiet row, "Mention teammates on a team design",
  and nothing is inserted.
- An **invited** member (no account yet) can be mentioned. They are keyed by
  their membership row, like an invited assignee, and get the email at their
  invite address. The Inbox finds it once they join and the lazy claim
  identifies them.

## Writing a mention

- Typing `@` at the start of the field or after a space opens a **suggestion
  list** above the caret-side of the composer: the teammates whose name or
  handle starts with what follows the `@`, up to six, each with their initials
  disc, name and handle. Invited members carry an "Invited" tag.
- **Arrow Up / Down** move the highlight, **Enter** or **Tab** picks, **Esc**
  closes the list and leaves the text as typed. Clicking a row picks it.
  While the list is open, Enter picks rather than sends.
- Picking replaces the `@query` with the member's **handle** plus a space.
- A **handle** is the member's display name in lower kebab case (`Thomas
McClean` becomes `thomas-mcclean`, accents folded, anything else dropped).
  Two members with the same handle get `-2`, `-3` in list order. A member with
  no usable name falls back to the local part of their email.
- On send, the comment keeps only the mentions whose `@handle` is still in the
  text: deleting the handle deletes the mention.
- The comment popover's composer supports it.

## The data

A comment gains an optional list, `mentions`, alongside its text:

```
CommentMention = { userId: string | null; memberId?: string; name: string; handle: string }
```

- `userId` is the teammate's account id, null for an invited member not yet
  identified; `memberId` is their team membership row id.
- At most **20** mentions per comment; `name` and `handle` at most 100
  characters. The text is unchanged: the handles live in it as typed.

**Trust.** Mentions arrive in the tab blob on autosave, in a room delta, or
in the view-role `POST /comments` body, so the server treats them like the
comment's author fields (`rewriteCommentAuthors`): on a **new** comment the
list is sanitised (shape, caps, string fields only; anything malformed is
dropped); on an **existing** comment it is locked to what was stored, so
nobody can retarget someone else's mention. A forged mention can at worst put
a thread on the named person's Inbox, and that page only ever lists
designs they can already open (the library scoping, [Inbox](../013-workspace/inbox.md) §4).

## Reading a mention

In every thread rendering (the Collaborate panel, the popover, the
presentation popover) an `@handle` that matches one of the comment's mentions
is drawn as a **chip**: semibold, in the accent, on a soft accent tint. An
`@word` that matches no mention is plain text. The export draws the text as
written.

## The Inbox

The thread index (`collab_threads`) gains `mentioned_ids`: the distinct user
ids and member ids mentioned anywhere in the thread. The Inbox's
thread query includes a thread when the reader is **mentioned** in it, as
well as when they commented or own the design, still scoped to designs they
can open. The thread row carries `mentionsYou`, and its hint reads
**Mentioned you** (it wins over "On your design"). A resolved thread leaves the
page as every thread does.

## The email

The api sends the mention emails itself, after it stores a comment that
mentions teammates: a comment posted through the comment routes, or new
comments arriving with a tab save (`apps/api/src/routes/comment-routes.ts`,
`tab-put-route.ts`). Only a signed-in person's comment on a team design sends
them (never an API token's), and they are best-effort: the comment has
already persisted, and a failure is logged and swallowed.

The server decides everything that matters:

- The design is in a team's library, and its team is the one whose people
  can be mentioned.
- Each mention resolves to a member of that team (joined or invited) other
  than the caller; anything else is skipped silently. At most 20.
- The author name comes from the caller's verified identity (participant
  profile, else email), and the design name from the design row, never the
  body.
- Each recipient's **"Someone Mentions Me in a Comment"** preference
  (`notifyMentions`, default on) is honoured; an invited member with no
  account has no preferences and is emailed at their invite address.
- The email
  quotes the first 280 characters of the comment, cut at a word with an ellipsis.
- Each email is **claimed** before it goes (`notify_claims`, in the design's own SQLite): a hash of the author, design, recipient and the comment's text is sent at most once per 24 hours
  (`NOTIFY_EMAIL_DEDUPE_MS`), so a replayed request emails nobody twice, and one
  author's action-assigned and mention emails together are capped at 60 an hour across all their designs
  (`NOTIFY_EMAILS_PER_SENDER_PER_HOUR`, counted in the author's own per-person store by `@liveworkspace/index-app`
  `claimNotice`). A refused claim sends nothing and logs
  `[notify-email] skipped`; claims past the longest window are dropped as new ones are claimed, and a purged
  design takes its claims with it.
- A comment and an
  assigned action ([Assigned actions](assigned-actions.md)) are deduped by exact text, so a client that rewords each
  one gets past the dedupe, and the hourly cap is the bound.

The email reads **"{author} mentioned you in {design}"**, quotes the
comment, and has one button, **Open the design**. It is sent only when email is
configured (the `EMAIL` binding, [Transactional email](../014-identity/transactional-email.md)).

## Setting

Settings → Email gains **Someone Mentions Me in a Comment** ("When a teammate
@mentions you in a comment."), signed-in only, like the other email toggles.

## Telemetry

Adding a comment with mentions emits `Comment · Mentioned` once (the count is
not sent), alongside the existing `Comment · Added`.

## Not in scope

- Mentioning people outside the design's team, or everyone (`@here`).
- In-app notifications beyond the Inbox.
- Editing a comment's mentions after sending (comments are not editable).
