# Vote integrity

A live poll answer, a Q&A upvote and a Plan card vote each count one person once. This spec says who "one person"
is on each path, and what stops one browser from posing as many people or changing somebody else's answer.

## What it protects against

- **Stuffing:** one person casting many votes by presenting a new identity for each one.
- **Overwriting:** one person changing an answer somebody else cast.

Overwriting is closed outright. Stuffing is bounded rather than impossible: a guest is a browser, and many real
browsers are many votes. The bound makes a scripted flood from one network buy nothing.

## Who a voter is

Every path uses the strongest identity the server holds for the caller, in this order:

1. **A verified account** (a Clerk session or an API token over REST; a room session whose ticket carried a person
   tag). One account is one voter, whatever browser or device it votes from.
2. **A guest.** A guest id costs nothing to make (`POST /api/guest-id`), so it is never trusted to be one person.
   Guests are counted against their **network**: the caller's IPv4 address, or IPv6 /64 (`clientRateKey`). At most
   `GUEST_VOTERS_PER_NETWORK` (100) distinct guest voters per network take part in one target (below). The 101st is
   refused; one who has already taken part can always change or withdraw their vote.

The network is never stored raw. It is a SHA-256 of the target's scope and the network key (`networkTagFor`), so it
cannot be read back or matched across documents.

100 is far above a household or office on one address and well below what a flood needs. A large room behind one
address (a conference on venue wi-fi) can exceed it; past that, the extra guests cannot vote until they sign in.

## Live poll answers (the room)

The answer key is decided by the room, never taken from the sender as given ([Live poll](live-poll.md)). The room
relays an answer only once it has accepted it, and relays it under the key it decided, so a refused answer reaches
nobody's tally.

- **Account sessions** (a ticket with a person tag): one answer per account per poll. The first key the account
  answers under becomes its key; a later answer from any of its sessions replaces that one answer.
- **Other sessions** answer under their collab key with a **proof**: a per-browser secret
  (`livediagram:v2:collab-secret`, `ensureCollabSecret`) that is never relayed, never stored raw (the room keeps its
  SHA-256) and never shown. The first proof to answer under a key claims it for the poll; an answer under a claimed key
  with a different proof is refused. The collab key is public (it rides the roster), the secret is not, so nobody can
  answer as somebody else, including somebody who has left.
- **One key per session per poll.** A session that has answered under one key cannot answer under another.
- **An old client** that sends no proof answers under its server-assigned presence id, which only that same session
  can answer under again.
- **Per network:** at most `GUEST_VOTERS_PER_NETWORK` answer keys from non-account sessions per network per poll. The
  network tag is stamped by the api worker on the upgrade (`X-Verified-Network`), on every path, like the other
  `X-Verified-*` headers.

A refused answer logs `[live-poll] answer refused` with the reason (`claimed`, `session_key`, `network_cap`,
`answers_cap`), never the key or the proof.

## Q&A upvotes and Plan card votes (REST)

The voter is the authenticated caller ([Q&A board](qa-board.md), [Items](../026-plan/items.md)). A verified account
votes freely. A guest's vote that **adds** a vote (`{ type: 'vote', on: true }`, or a Plan vote of `+1`) is admitted
only if the guest has already voted in this document from this network, or the network has fewer than
`GUEST_VOTERS_PER_NETWORK` guest voters in it. Withdrawing is never refused.

The ledger is `guest_voters (document_id, network_tag, person_tag)`, migration 0075, one row per guest voter per
network per document, removed with the document. `person_tag` is `personTagFor(documentId, ownerId)`; no owner id is
stored. Admission is one D1 batch: a conditional insert, then a read of the caller's row.

A refused vote answers `429 { error: 'vote_limit' }` and logs `[vote-integrity] guest voter refused`.

## Not covered

- **Dot votes, estimates, done checks, quizzes and temperature checks** are document state written by editors
  ([Per-participant responses](participant-responses.md), [Session tools](session-tools.md)). An editor can already
  rewrite the whole document, so these stay keyed on the claimed collab key.
- **Many real browsers on many networks** are many voters. Only signing in, or a facilitator who knows the room, can
  tell them apart.
- **A Plan card's per-person count** is bounded by the board's vote budget in the editor, not by the server: one
  person's dots on one card are a facilitation rule, not an identity question.
