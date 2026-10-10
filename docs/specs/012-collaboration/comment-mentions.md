# Comment Mentions

Typing `@` in a comment tags a teammate by name (`@thomas-mcclean`). The
mention shows as a chip in the thread, puts the thread on the teammate's
[Activity page](../013-workspace/activity-page.md), and, if their settings allow, emails them.

It is the comment-thread sibling of [Assigned actions](assigned-actions.md): the same
people can be named (the document's team), the same Activity page collects it,
and the same kind of best-effort, server-verified email carries it.

## Who can be mentioned

The **members of the team whose library holds the document**, joined and
invited, except yourself. That is exactly the Assign Action picker's rule
([Assigned actions](assigned-actions.md) §2), for the same reason: a mention should reach someone
who can open the document and read the thread, and a teammate on another team
almost certainly cannot.

- On a **personal document** or for a **guest** there is nobody to mention.
  Typing `@` then shows one quiet row, "Mention teammates on a team document",
  and nothing is inserted.
- An **invited** member (no account yet) can be mentioned. They are keyed by
  their membership row, like an invited assignee, and get the email at their
  invite address. The Activity page finds it once they join and the lazy claim
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
- Both composers support it: the [Comment panel](comment-pin.md) card's and the comment
  popover's.

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
a thread on the named person's Activity page, and that page only ever lists
documents they can already open (the library scoping, [Activity page](../013-workspace/activity-page.md) §4).

## Reading a mention

In every thread rendering (the Comment panel's bubbles, the popover, the
presentation popover) an `@handle` that matches one of the comment's mentions
is drawn as a **chip**: semibold, in the accent, on a soft accent tint. An
`@word` that matches no mention is plain text. The export draws the text as
written.

## The Activity page

The thread index (`collab_threads`) gains `mentioned_ids`: the distinct user
ids and member ids mentioned anywhere in the thread. The Activity page's
thread query includes a thread when the reader is **mentioned** in it, as
well as when they commented or own the document, still scoped to documents they
can open. The thread row carries `mentionsYou`, and its hint reads
**Mentioned You** (it wins over "Your document"). A resolved thread leaves the
page as every thread does.

A Plan card's thread ([Items](../026-plan/items.md) "Comments") lists the same way, read straight from the
item store rather than the index (the thread lives in the item, not in tab JSON): it is included when the reader
is mentioned in it, commented in it, or owns the document, and carries the same `mentionsYou` hint
([Activity page](../013-workspace/activity-page.md) §2.5).

## The email

After a comment with mentions is added, the author's editor asks the api to
notify: `POST /api/teams/<teamId>/notify-mention` with `{ documentId,
commentText, mentions: [{ userId?, memberId? }], itemId? }`. `itemId` is set for a comment on a Plan card: it
must name an item of that document (else `404`), and the email's button then opens the card. It is signed-in only (the
teams mutation gate) and best-effort: the comment has already persisted, a
failure is swallowed, the response is `202`.

The server decides everything that matters:

- The caller is a **joined** member of the team, and the team is the
  document's team (`documents.team_id`), and the caller can access the document.
  Otherwise `404`, never probing.
- Each mention resolves to a member of that team (joined or invited) other
  than the caller; anything else is skipped silently. At most 20.
- The author name comes from the caller's verified identity (participant
  profile, else email), and the document name from the document row, never the
  body.
- Each recipient's **"Someone Mentions Me in a Comment"** preference
  (`notifyMentions`, default on) is honoured; an invited member with no
  account has no preferences and is emailed at their invite address.
- `commentText` is required, at most 5000 characters; the email quotes the
  first 280, cut at a word with an ellipsis.
- The quoted text comes from the body, not the stored tab (the request names no
  comment id), so each email is **claimed** before it goes
  (`notify_email_claims`, migration 0086): a hash of the author, document, card,
  recipient and text is sent at most once per 24 hours
  (`NOTIFY_EMAIL_DEDUPE_MS`), so a replayed request emails nobody twice, and one
  author's action-assigned and mention emails together are capped at 60 an hour
  (`NOTIFY_EMAILS_PER_SENDER_PER_HOUR`). A refused claim sends nothing and logs
  `[notify-email] skipped`; the daily cron deletes claims past the 24 hours.

The email reads **"{author} mentioned you in {document}"**, quotes the
comment, and has one button, **Open the document** (for a card's comment, **Open the card**, linking
`/document/<id>#item=<itemId>`). It is sent only when email is
configured (`RESEND_API_KEY`, [Transactional & lifecycle email (Resend)](../014-identity/transactional-email.md)).

## Setting

Settings → Email gains **Someone Mentions Me in a Comment** ("When a teammate
@mentions you in a comment."), signed-in only, like the other email toggles.

## Telemetry

Adding a comment with mentions emits `Comment · Mentioned` once (the count is
not sent), alongside the existing `Comment · Added`.

## Not in scope

- Mentioning people outside the document's team, or everyone (`@here`).
- In-app notifications beyond the Activity page.
- Editing a comment's mentions after sending (comments are not editable).
